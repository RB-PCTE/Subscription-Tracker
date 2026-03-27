-- Support stage-specific Renewal Workbench progress values used by the Workbench UI.
-- Keep legacy values valid for backward compatibility with existing data.

alter table public.subscriptions
  drop constraint if exists subscriptions_quote_progress_ck,
  drop constraint if exists subscriptions_invoice_progress_ck,
  drop constraint if exists subscriptions_final_warning_progress_ck;

alter table public.subscriptions
  add constraint subscriptions_quote_progress_ck
  check (
    quote_progress in (
      'not started', 'drafting', 'sent', 'follow up needed', 'accepted', 'declined',
      'contact issues'
    )
  ),
  add constraint subscriptions_invoice_progress_ck
  check (
    invoice_progress in (
      'not started', 'prepared', 'sent', 'awaiting payment', 'paid',
      'po received', 'eft unpaid', 'eft paid'
    )
  ),
  add constraint subscriptions_final_warning_progress_ck
  check (
    final_warning_progress in (
      'not started', 'sent', 'follow up needed', 'escalated', 'closed',
      'churning', 'po promised', 'eft unpaid'
    )
  );
