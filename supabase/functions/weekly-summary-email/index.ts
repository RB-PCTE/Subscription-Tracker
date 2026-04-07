import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type SubscriptionRow = {
  id: string;
  product_name: string | null;
  plan: string | null;
  customer: string | null;
  customer_company_name: string | null;
  serial_number: string | null;
  status: string | null;
  billing_cycle: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  quote_progress: string | null;
  invoice_progress: string | null;
  final_warning_progress: string | null;
  renewal_workflow_note: string | null;
};

type RenewalRow = {
  id: string;
  subscription_id: string;
  start_date: string | null;
  end_date: string | null;
  renewal_outcome: string | null;
  created_at: string | null;
};

type WorkflowHistoryRow = {
  subscription_id: string;
  stage: string;
  progress_value: string;
  note: string | null;
  created_at: string;
};

type SummaryItem = {
  subscriptionName: string;
  customer: string;
  renewalEndDate: string;
  status: string;
  workflow: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "Subscription Tracker <no-reply@example.com>";
const SUMMARY_RECIPIENT = Deno.env.get("WEEKLY_SUMMARY_RECIPIENT") ?? "you@example.com";
const CRON_SECRET = Deno.env.get("WEEKLY_SUMMARY_CRON_SECRET") ?? "";

const DAY_MS = 1000 * 60 * 60 * 24;

function parseDateStartOfDay(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function toIsoDate(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function subtractMonthsClamped(input: Date, monthsToSubtract: number): Date {
  const base = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const targetYear = base.getUTCFullYear();
  const targetMonthIndex = base.getUTCMonth() - monthsToSubtract;
  const firstOfTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex, 1));
  const lastDay = new Date(Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const clampedDay = Math.min(base.getUTCDate(), lastDay);

  return new Date(Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth(), clampedDay));
}

function normalizeOutcome(value: string | null | undefined): "renewed" | "churned" | "migrated" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "churned" || normalized === "migrated") {
    return normalized;
  }

  return "renewed";
}

function labelize(value: string | null | undefined): string {
  return (value ?? "unknown")
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSubscriptionName(subscription: SubscriptionRow): string {
  const customer = (subscription.customer ?? subscription.customer_company_name ?? "").trim();
  const product = (subscription.product_name ?? subscription.plan ?? "").trim();
  const serial = (subscription.serial_number ?? "").trim();
  return [customer, product, serial].filter(Boolean).join(" - ") || subscription.product_name || subscription.plan || "Untitled subscription";
}

function determineStatus(subscription: SubscriptionRow, latestRenewal: RenewalRow | null, today: Date): string {
  const outcome = normalizeOutcome(latestRenewal?.renewal_outcome);
  if (outcome === "migrated") {
    return "migrated";
  }

  if (outcome === "churned") {
    return "churned";
  }

  const endDate = parseDateStartOfDay(latestRenewal?.end_date ?? subscription.end_date ?? null);
  const legacyStatus = (subscription.status ?? "unknown").trim().toLowerCase() || "unknown";
  if (!endDate) {
    return legacyStatus;
  }

  if (today > endDate) {
    return "attn required";
  }

  const quoteBoundary = subtractMonthsClamped(endDate, 3);
  const invoiceBoundary = subtractMonthsClamped(endDate, 2);
  const finalWarningBoundary = subtractMonthsClamped(endDate, 1);

  if (today < quoteBoundary) {
    return "active";
  }

  if (today >= quoteBoundary && today < invoiceBoundary) {
    return "quote";
  }

  if (today >= invoiceBoundary && today < finalWarningBoundary) {
    return "invoice";
  }

  if (today >= finalWarningBoundary && today <= endDate) {
    return "final warning";
  }

  return legacyStatus;
}

function collectWorkflow(subscription: SubscriptionRow): string {
  const chunks: string[] = [];
  if (subscription.quote_progress && subscription.quote_progress !== "not started") {
    chunks.push(`Quote: ${labelize(subscription.quote_progress)}`);
  }
  if (subscription.invoice_progress && subscription.invoice_progress !== "not started") {
    chunks.push(`Invoice: ${labelize(subscription.invoice_progress)}`);
  }
  if (subscription.final_warning_progress && subscription.final_warning_progress !== "not started") {
    chunks.push(`Final warning: ${labelize(subscription.final_warning_progress)}`);
  }
  if (subscription.renewal_workflow_note) {
    chunks.push(`Note: ${subscription.renewal_workflow_note}`);
  }

  return chunks.join(" • ") || "—";
}

function buildEmailHtml({
  windowStart,
  windowEnd,
  metrics,
  problemSubscriptions,
  upcomingWork,
  recentUpdates,
}: {
  windowStart: string;
  windowEnd: string;
  metrics: Record<string, number>;
  problemSubscriptions: SummaryItem[];
  upcomingWork: SummaryItem[];
  recentUpdates: string[];
}): string {
  const renderRows = (items: SummaryItem[]) => {
    if (!items.length) {
      return `<tr><td colspan="5" style="padding:10px;border:1px solid #d1d5db;color:#64748b;">None this week.</td></tr>`;
    }

    return items
      .map(
        (item) => `<tr>
        <td style="padding:10px;border:1px solid #d1d5db;">${escapeHtml(item.subscriptionName)}</td>
        <td style="padding:10px;border:1px solid #d1d5db;">${escapeHtml(item.customer)}</td>
        <td style="padding:10px;border:1px solid #d1d5db;">${escapeHtml(item.renewalEndDate)}</td>
        <td style="padding:10px;border:1px solid #d1d5db;">${escapeHtml(labelize(item.status))}</td>
        <td style="padding:10px;border:1px solid #d1d5db;">${escapeHtml(item.workflow)}</td>
      </tr>`,
      )
      .join("\n");
  };

  const recentUpdatesHtml = recentUpdates.length
    ? `<ul>${recentUpdates.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")}</ul>`
    : "<p style=\"color:#64748b;\">No notable updates in the last 7 days.</p>";

  return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:20px;">
    <div style="max-width:920px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">
      <h1 style="margin-top:0;">Weekly Subscription Ops Summary</h1>
      <p style="margin-bottom:20px;color:#475569;">Reporting window: ${escapeHtml(windowStart)} to ${escapeHtml(windowEnd)}</p>

      <h2>Summary</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
        <tr>
          <td style="padding:8px;border:1px solid #d1d5db;"><strong>Total subscriptions</strong><br />${metrics.totalSubscriptions}</td>
          <td style="padding:8px;border:1px solid #d1d5db;"><strong>Active</strong><br />${metrics.activeSubscriptions}</td>
          <td style="padding:8px;border:1px solid #d1d5db;"><strong>Due in 30 days</strong><br />${metrics.dueIn30Days}</td>
          <td style="padding:8px;border:1px solid #d1d5db;"><strong>Due in 60 days</strong><br />${metrics.dueIn60Days}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #d1d5db;"><strong>Needs attention</strong><br />${metrics.needsAttention}</td>
          <td style="padding:8px;border:1px solid #d1d5db;"><strong>Final warning</strong><br />${metrics.finalWarning}</td>
          <td style="padding:8px;border:1px solid #d1d5db;"><strong>Churned (last 7 days)</strong><br />${metrics.churnedLast7Days}</td>
          <td style="padding:8px;border:1px solid #d1d5db;"><strong>Migrated (last 7 days)</strong><br />${metrics.migratedLast7Days}</td>
        </tr>
      </table>

      <h2>Problem subscriptions</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:10px;border:1px solid #d1d5db;background:#f1f5f9;">Subscription</th>
            <th style="text-align:left;padding:10px;border:1px solid #d1d5db;background:#f1f5f9;">Customer</th>
            <th style="text-align:left;padding:10px;border:1px solid #d1d5db;background:#f1f5f9;">Renewal/end date</th>
            <th style="text-align:left;padding:10px;border:1px solid #d1d5db;background:#f1f5f9;">Status</th>
            <th style="text-align:left;padding:10px;border:1px solid #d1d5db;background:#f1f5f9;">Workflow progress</th>
          </tr>
        </thead>
        <tbody>${renderRows(problemSubscriptions)}</tbody>
      </table>

      <h2>Upcoming work (next 60 days)</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:10px;border:1px solid #d1d5db;background:#f1f5f9;">Subscription</th>
            <th style="text-align:left;padding:10px;border:1px solid #d1d5db;background:#f1f5f9;">Customer</th>
            <th style="text-align:left;padding:10px;border:1px solid #d1d5db;background:#f1f5f9;">Renewal/end date</th>
            <th style="text-align:left;padding:10px;border:1px solid #d1d5db;background:#f1f5f9;">Status</th>
            <th style="text-align:left;padding:10px;border:1px solid #d1d5db;background:#f1f5f9;">Workflow progress</th>
          </tr>
        </thead>
        <tbody>${renderRows(upcomingWork)}</tbody>
      </table>

      <h2>Recent updates</h2>
      ${recentUpdatesHtml}
    </div>
  </body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response("Missing Supabase environment configuration.", { status: 500 });
  }

  if (!RESEND_API_KEY) {
    return new Response("Missing RESEND_API_KEY secret.", { status: 500 });
  }

  if (CRON_SECRET) {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== CRON_SECRET) {
      return new Response("Unauthorized.", { status: 401 });
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const [{ data: subscriptions, error: subscriptionsError }, { data: renewals, error: renewalsError }, { data: workflowHistory, error: workflowHistoryError }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select(
          "id, product_name, plan, customer, customer_company_name, serial_number, status, billing_cycle, start_date, end_date, renewal_date, quote_progress, invoice_progress, final_warning_progress, renewal_workflow_note",
        ),
      supabase
        .from("subscription_renewals")
        .select("id, subscription_id, start_date, end_date, renewal_outcome, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("subscription_workflow_history")
        .select("subscription_id, stage, progress_value, note, created_at")
        .gte("created_at", new Date(Date.now() - 7 * DAY_MS).toISOString())
        .order("created_at", { ascending: false }),
    ]);

  if (subscriptionsError || renewalsError || workflowHistoryError) {
    return new Response(
      JSON.stringify({
        subscriptionsError: subscriptionsError?.message,
        renewalsError: renewalsError?.message,
        workflowHistoryError: workflowHistoryError?.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const today = parseDateStartOfDay(new Date().toISOString()) ?? new Date();
  const next30 = addDays(today, 30);
  const next60 = addDays(today, 60);
  const sevenDaysAgo = addDays(today, -7);

  const renewalsBySubscription = new Map<string, RenewalRow[]>();
  (renewals ?? []).forEach((renewal) => {
    const items = renewalsBySubscription.get(renewal.subscription_id) ?? [];
    items.push(renewal);
    renewalsBySubscription.set(renewal.subscription_id, items);
  });

  const summaryRows = (subscriptions ?? []).map((subscription) => {
    const subRenewals = renewalsBySubscription.get(subscription.id) ?? [];
    const latestRenewal = subRenewals.length ? subRenewals[subRenewals.length - 1] : null;
    const status = determineStatus(subscription, latestRenewal, today);
    const endDate = parseDateStartOfDay(latestRenewal?.end_date ?? subscription.end_date ?? null);
    const customer = (subscription.customer ?? subscription.customer_company_name ?? "—").trim() || "—";

    return {
      subscription,
      status,
      endDate,
      customer,
      workflow: collectWorkflow(subscription),
      name: formatSubscriptionName(subscription),
    };
  });

  const metrics = {
    totalSubscriptions: summaryRows.length,
    activeSubscriptions: summaryRows.filter((row) => row.status === "active").length,
    dueIn30Days: summaryRows.filter((row) => row.endDate && row.endDate >= today && row.endDate <= next30).length,
    dueIn60Days: summaryRows.filter((row) => row.endDate && row.endDate >= today && row.endDate <= next60).length,
    needsAttention: summaryRows.filter((row) => row.status === "attn required").length,
    finalWarning: summaryRows.filter((row) => row.status === "final warning").length,
    churnedLast7Days: (renewals ?? []).filter((renewal) => normalizeOutcome(renewal.renewal_outcome) === "churned" && parseDateStartOfDay(renewal.created_at) && parseDateStartOfDay(renewal.created_at)! >= sevenDaysAgo).length,
    migratedLast7Days: (renewals ?? []).filter((renewal) => normalizeOutcome(renewal.renewal_outcome) === "migrated" && parseDateStartOfDay(renewal.created_at) && parseDateStartOfDay(renewal.created_at)! >= sevenDaysAgo).length,
  };

  const toSummaryItem = (row: (typeof summaryRows)[number]): SummaryItem => ({
    subscriptionName: row.name,
    customer: row.customer,
    renewalEndDate: toIsoDate(row.endDate),
    status: row.status,
    workflow: row.workflow,
  });

  const problemSubscriptions = summaryRows
    .filter((row) => {
      if (row.status === "final warning" || row.status === "attn required") {
        return true;
      }

      if (!row.endDate) {
        return false;
      }

      return row.endDate < today;
    })
    .sort((a, b) => (a.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 20)
    .map(toSummaryItem);

  const upcomingWork = summaryRows
    .filter((row) => row.endDate && row.endDate >= today && row.endDate <= next60 && ["quote", "invoice", "final warning"].includes(row.status))
    .sort((a, b) => (a.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 25)
    .map(toSummaryItem);

  const recentUpdates: string[] = [];

  (workflowHistory ?? []).slice(0, 8).forEach((entry) => {
    const sub = summaryRows.find((row) => row.subscription.id === entry.subscription_id);
    recentUpdates.push(
      `${toIsoDate(parseDateStartOfDay(entry.created_at))}: ${sub?.name ?? "Subscription"} — ${labelize(entry.stage)} updated to ${labelize(entry.progress_value)}${entry.note ? ` (${entry.note})` : ""}`,
    );
  });

  (renewals ?? [])
    .filter((renewal) => {
      const createdAt = parseDateStartOfDay(renewal.created_at);
      return createdAt && createdAt >= sevenDaysAgo;
    })
    .slice(-8)
    .forEach((renewal) => {
      const sub = summaryRows.find((row) => row.subscription.id === renewal.subscription_id);
      recentUpdates.push(
        `${toIsoDate(parseDateStartOfDay(renewal.created_at))}: ${sub?.name ?? "Subscription"} renewal marked ${labelize(normalizeOutcome(renewal.renewal_outcome))}.`,
      );
    });

  const html = buildEmailHtml({
    windowStart: toIsoDate(sevenDaysAgo),
    windowEnd: toIsoDate(today),
    metrics,
    problemSubscriptions,
    upcomingWork,
    recentUpdates: recentUpdates.slice(0, 14),
  });

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1";
  if (dryRun) {
    return new Response(JSON.stringify({ recipient: SUMMARY_RECIPIENT, metrics, html }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [SUMMARY_RECIPIENT],
      subject: `Weekly Subscription Ops Summary (${toIsoDate(today)})`,
      html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return new Response(errorBody, { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, recipient: SUMMARY_RECIPIENT, metrics }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
