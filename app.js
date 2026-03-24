import { supabase } from "./supabaseClient.js";

const signedOutView = document.getElementById("signed-out-view");
const signedInView = document.getElementById("signed-in-view");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const sendMagicLinkButton = document.getElementById("send-magic-link-btn");
const signInPasswordButton = document.getElementById("sign-in-password-btn");
const signUpPasswordButton = document.getElementById("sign-up-password-btn");
const signOutButton = document.getElementById("sign-out-btn");
const userEmail = document.getElementById("user-email");
const authStatus = document.getElementById("auth-status");
const roleStatus = document.getElementById("role-status");
const currentUserArea = document.getElementById("current-user-area");
const newSubscriptionCta = document.getElementById("new-subscription-cta");
const adminNavGroup = document.getElementById("admin-nav-group");
const navButtons = document.querySelectorAll("[data-nav-target]");
const contentPanels = document.querySelectorAll(".content-panel");

const metricTotalSubscriptions = document.getElementById("metric-total-subscriptions");
const metricActiveSubscriptions = document.getElementById("metric-active-subscriptions");
const metricUserRole = document.getElementById("metric-user-role");

const subscriptionsSection = document.getElementById("subscriptions-section");
const addSubscriptionButton = document.getElementById("add-subscription-btn");
const emptyAddButton = document.getElementById("empty-add-btn");
const subscriptionsSubtitle = document.getElementById("subscriptions-subtitle");
const emptyStateTitle = document.getElementById("empty-state-title");
const emptyStateCopy = document.getElementById("empty-state-copy");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const frequencyFilter = document.getElementById("frequency-filter");
const sortControl = document.getElementById("sort-control");
const subscriptionsBody = document.getElementById("subscriptions-body");
const subscriptionStatus = document.getElementById("subscription-status");
const emptyState = document.getElementById("empty-state");
const subscriptionsTableWrap = document.querySelector(".subscriptions-table-wrap");
const userManagementSection = document.getElementById("user-management-section");
const inviteForm = document.getElementById("invite-form");
const inviteEmailInput = document.getElementById("invite-email-input");
const inviteRoleSelect = document.getElementById("invite-role-select");
const grantAccessButton = document.getElementById("grant-access-btn");
const userManagementStatus = document.getElementById("user-management-status");
const invitesBody = document.getElementById("invites-body");
const appUsersBody = document.getElementById("app-users-body");
const adminUsersPanel = document.getElementById("admin-users-panel");
const adminInvitesPanel = document.getElementById("admin-invites-panel");

const renewalsList = document.getElementById("renewals-list");

const subscriptionDialog = document.getElementById("subscription-dialog");
const subscriptionForm = document.getElementById("subscription-form");
const formTitle = document.getElementById("form-title");
const formError = document.getElementById("form-error");
const saveSubscriptionButton = document.getElementById("save-subscription-btn");
const cancelSubscriptionButton = document.getElementById("cancel-subscription-btn");
const generatedNamePreview = document.getElementById("generated-display-name");
const formCalculatedStatus = document.getElementById("form-calculated-status");
const renewalDialog = document.getElementById("renewal-dialog");
const renewalForm = document.getElementById("renewal-form");
const renewalTargetName = document.getElementById("renewal-target-name");
const renewalFormError = document.getElementById("renewal-form-error");
const renewalCalculatedStatus = document.getElementById("renewal-calculated-status");
const saveRenewalButton = document.getElementById("save-renewal-btn");
const cancelRenewalButton = document.getElementById("cancel-renewal-btn");
const detailDialog = document.getElementById("subscription-detail-dialog");
const closeDetailButton = document.getElementById("close-detail-btn");
const detailTitle = document.getElementById("detail-title");
const detailMetadataList = document.getElementById("detail-metadata-list");
const detailCurrentTermList = document.getElementById("detail-current-term-list");
const detailRenewalHistory = document.getElementById("detail-renewal-history");

let currentUser = null;
let currentUserRole = null;
let subscriptions = [];
let renewalsBySubscription = new Map();
let editingSubscriptionId = null;
let renewingSubscriptionId = null;
let subscriptionModalMode = "create";
let isSubmittingForm = false;
let isSubmittingRenewalForm = false;
let loadingSubscriptions = false;
let activeView = "dashboard";

const ROLE_PERMISSIONS = {
  admin: { canAdd: true, canEdit: true, canDelete: true, canManageUsers: true },
  member: { canAdd: true, canEdit: true, canDelete: false, canManageUsers: false },
  viewer: { canAdd: false, canEdit: false, canDelete: false, canManageUsers: false },
};

function getCurrentPermissions() {
  return ROLE_PERMISSIONS[currentUserRole] || { canAdd: false, canEdit: false, canDelete: false };
}

function setRoleStatus(message, isError = false) {
  roleStatus.textContent = message;
  roleStatus.style.color = isError ? "#b91c1c" : "#0f172a";
}

function applyRoleUi() {
  const { canAdd, canManageUsers } = getCurrentPermissions();
  addSubscriptionButton.hidden = !canAdd;
  emptyAddButton.hidden = !canAdd;
  userManagementSection.hidden = !canManageUsers;
  adminNavGroup.hidden = !canManageUsers;
  newSubscriptionCta.hidden = !canAdd;

  if (!canManageUsers && activeView.startsWith("admin-")) {
    setActiveView("dashboard");
  }
}

function setActiveView(view) {
  activeView = view;

  contentPanels.forEach((panel) => {
    panel.classList.toggle("is-view-hidden", panel.dataset.view !== view);
  });

  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.navTarget === view);
  });

  if (view === "admin-users") {
    adminUsersPanel.hidden = false;
    adminInvitesPanel.hidden = true;
  } else if (view === "admin-invites") {
    adminUsersPanel.hidden = true;
    adminInvitesPanel.hidden = false;
  } else {
    adminUsersPanel.hidden = false;
    adminInvitesPanel.hidden = false;
  }
}

function setStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.style.color = isError ? "#b91c1c" : "#0f172a";
}

function setSubscriptionStatus(message, isError = false) {
  subscriptionStatus.textContent = message;
  subscriptionStatus.style.color = isError ? "#b91c1c" : "#0f172a";
}

function setUserManagementStatus(message, isError = false) {
  userManagementStatus.textContent = message;
  userManagementStatus.style.color = isError ? "#b91c1c" : "#0f172a";
}

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }

  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getRenewalsForSubscription(subscriptionId) {
  return renewalsBySubscription.get(subscriptionId) || [];
}

function getLegacyTermFromSubscription(row = {}) {
  const startDate = row.start_date || row.renewal_date || null;
  if (!startDate) {
    return null;
  }

  return {
    id: `legacy-${row.id || "row"}`,
    subscription_id: row.id || null,
    renewal_start_date: startDate,
    renewal_end_date: row.end_date || calculateEndDateFromValues(startDate, row.billing_cycle) || null,
    billing_cycle: row.billing_cycle || null,
    renewal_outcome: normalizeRenewalOutcome(row.renewal_outcome),
    notes: getDisplayNotes(row) || null,
    created_at: row.updated_at || row.created_at || null,
    source: "legacy-subscription",
  };
}

function sortRenewalTerms(terms = []) {
  return [...terms].sort((a, b) => {
    const aStart = new Date(a.renewal_start_date || 0).getTime();
    const bStart = new Date(b.renewal_start_date || 0).getTime();
    if (aStart !== bStart) {
      return aStart - bStart;
    }

    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
}

function getRenewalTimeline(row = {}) {
  const childRenewals = getRenewalsForSubscription(row.id);
  const timeline = childRenewals.length ? childRenewals : [];
  const hasChildTerm = childRenewals.length > 0;
  const legacyTerm = getLegacyTermFromSubscription(row);

  if (!hasChildTerm && legacyTerm) {
    timeline.push(legacyTerm);
  }

  return sortRenewalTerms(timeline);
}

function getCurrentTerm(row = {}) {
  const timeline = getRenewalTimeline(row);
  if (!timeline.length) {
    return null;
  }

  return timeline[timeline.length - 1];
}

function getStartDateValue(row = {}) {
  const term = getCurrentTerm(row);
  return term?.renewal_start_date || row.start_date || row.renewal_date || null;
}

function getEndDateValue(row = {}) {
  const term = getCurrentTerm(row);
  return term?.renewal_end_date || row.end_date || calculateSubscriptionEndDate(row) || null;
}

function normalizeRenewalOutcome(value) {
  const normalized = (value || "").toString().trim().toLowerCase();
  if (!normalized) {
    return "pending";
  }

  if (["renewed", "churned", "migrated", "pending"].includes(normalized)) {
    return normalized;
  }

  return "pending";
}

function formatSubscriptionName(row) {
  const metadata = getSubscriptionMetadata(row);
  return generateSubscriptionDisplayName(metadata, row);
}

function parseEmbeddedMetadata(notesValue) {
  const notesText = (notesValue || "").toString();
  const marker = "__SUBSCRIPTION_METADATA__:";
  const markerIndex = notesText.lastIndexOf(marker);

  if (markerIndex === -1) {
    return { metadata: null, userNotes: notesText.trim() || null };
  }

  const metadataText = notesText.slice(markerIndex + marker.length).trim();
  const userNotes = notesText.slice(0, markerIndex).trim() || null;

  if (!metadataText) {
    return { metadata: null, userNotes };
  }

  try {
    const metadata = JSON.parse(metadataText);
    return { metadata: typeof metadata === "object" && metadata ? metadata : null, userNotes };
  } catch (error) {
    console.warn("Unable to parse embedded subscription metadata.", error);
    return { metadata: null, userNotes: notesText.trim() || null };
  }
}

function getSubscriptionMetadata(row = {}) {
  const embedded = parseEmbeddedMetadata(row.notes);
  const structured = row.subscription_metadata && typeof row.subscription_metadata === "object" ? row.subscription_metadata : null;

  return {
    customerCompanyName:
      row.customer_company_name ||
      row.customer_company ||
      structured?.customerCompanyName ||
      embedded.metadata?.customerCompanyName ||
      "",
    contactName: row.contact_name || structured?.contactName || embedded.metadata?.contactName || "",
    contactEmail: row.contact_email || structured?.contactEmail || embedded.metadata?.contactEmail || "",
    contactPhone: row.contact_phone || structured?.contactPhone || embedded.metadata?.contactPhone || "",
    equipmentName:
      row.equipment_name ||
      row.device_name ||
      structured?.equipmentName ||
      embedded.metadata?.equipmentName ||
      row.product_name ||
      "",
    serialNumber: row.serial_number || structured?.serialNumber || embedded.metadata?.serialNumber || "",
  };
}

function buildSubscriptionDisplayNameParts(metadata) {
  return [metadata.customerCompanyName, metadata.equipmentName, metadata.serialNumber]
    .map((value) => (value || "").toString().trim())
    .filter(Boolean);
}

function generateSubscriptionDisplayName(metadata = {}, row = {}) {
  const parts = buildSubscriptionDisplayNameParts(metadata);

  if (parts.length >= 2) {
    return parts.join(" - ");
  }

  if (parts.length === 1) {
    return (
      parts[0] ||
      row.product_name ||
      row.plan ||
      row.name ||
      row.subscription_name ||
      "Untitled subscription"
    );
  }

  return row.product_name || row.plan || row.name || row.subscription_name || "Untitled subscription";
}

function getDisplayNotes(row) {
  return parseEmbeddedMetadata(row.notes).userNotes;
}

function buildNotesWithMetadata(notes, metadata) {
  const cleanedNotes = (notes || "").toString().trim();
  const metadataPayload = {
    customerCompanyName: metadata.customerCompanyName || "",
    contactName: metadata.contactName || "",
    contactEmail: metadata.contactEmail || "",
    contactPhone: metadata.contactPhone || "",
    equipmentName: metadata.equipmentName || "",
    serialNumber: metadata.serialNumber || "",
  };

  const hasMetadataValue = Object.values(metadataPayload).some((value) => value);
  if (!hasMetadataValue) {
    return cleanedNotes || null;
  }

  const metadataBlock = `__SUBSCRIPTION_METADATA__:${JSON.stringify(metadataPayload)}`;
  return cleanedNotes ? `${cleanedNotes}\n\n${metadataBlock}` : metadataBlock;
}

function toStatusLabel(value) {
  return (value || "Unknown")
    .toString()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseDateStartOfDay(dateInput) {
  if (!dateInput) {
    return null;
  }

  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function addMonthsClamped(dateInput, monthsToAdd) {
  const baseDate = parseDateStartOfDay(dateInput);
  if (!baseDate || !Number.isFinite(monthsToAdd)) {
    return null;
  }

  const targetYear = baseDate.getFullYear();
  const targetMonthIndex = baseDate.getMonth() + monthsToAdd;
  const targetDay = baseDate.getDate();
  const firstOfTargetMonth = new Date(targetYear, targetMonthIndex, 1);
  const lastDayOfTargetMonth = new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(targetDay, lastDayOfTargetMonth);

  return new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth(), clampedDay);
}

function toIsoDateString(dateValue) {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
    return null;
  }

  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBillingFrequencyToMonths(value) {
  const normalized = (value || "").toString().trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const directMapping = {
    monthly: 1,
    quarter: 3,
    quarterly: 3,
    "half year": 6,
    "half-year": 6,
    semiannual: 6,
    "semi-annual": 6,
    annual: 12,
    yearly: 12,
  };

  if (directMapping[normalized]) {
    return directMapping[normalized];
  }

  const numericMatch = normalized.match(/^(\d+)\s*(month|months|year|years)$/);
  if (!numericMatch) {
    return null;
  }

  const amount = Number.parseInt(numericMatch[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unit = numericMatch[2];
  return unit.startsWith("year") ? amount * 12 : amount;
}

function calculateSubscriptionEndDate(subscription = {}) {
  const startDate = subscription.start_date || subscription.renewal_date || subscription.renewal_start_date || null;
  return calculateEndDateFromValues(startDate, subscription.billing_cycle);
}

function calculateEndDateFromValues(startDate, billingCycle) {
  console.debug("calculateEndDateFromValues", { startDate, billingCycle });
  const monthsToAdd = parseBillingFrequencyToMonths(billingCycle);
  if (!startDate || !monthsToAdd) {
    return null;
  }

  return toIsoDateString(addMonthsClamped(startDate, monthsToAdd));
}

function subtractMonthsClamped(dateInput, monthsToSubtract) {
  const baseDate = parseDateStartOfDay(dateInput);
  if (!baseDate) {
    return null;
  }

  const targetYear = baseDate.getFullYear();
  const targetMonthIndex = baseDate.getMonth() - monthsToSubtract;
  const targetDay = baseDate.getDate();

  const firstOfTargetMonth = new Date(targetYear, targetMonthIndex, 1);
  const lastDayOfTargetMonth = new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(targetDay, lastDayOfTargetMonth);

  return new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth(), clampedDay);
}

function calculateSubscriptionStatus(row, today = new Date()) {
  console.debug("calculateSubscriptionStatus", { id: row?.id, today: toIsoDateString(today) });
  const currentTerm = getCurrentTerm(row);
  const legacyStatus = (row.status || "unknown").toString().trim().toLowerCase() || "unknown";
  const outcome = normalizeRenewalOutcome(currentTerm?.renewal_outcome || row.renewal_outcome);
  const endDate = parseDateStartOfDay(currentTerm?.renewal_end_date || getEndDateValue(row));
  const normalizedToday = parseDateStartOfDay(today) || new Date();
  normalizedToday.setHours(0, 0, 0, 0);

  if (outcome === "migrated") {
    return "migrated";
  }

  if (!endDate) {
    return legacyStatus;
  }

  const quoteBoundary = subtractMonthsClamped(endDate, 3);
  const invoiceBoundary = subtractMonthsClamped(endDate, 2);
  const finalWarningBoundary = subtractMonthsClamped(endDate, 1);

  if (!quoteBoundary || !invoiceBoundary || !finalWarningBoundary) {
    return legacyStatus;
  }

  if (normalizedToday < quoteBoundary) {
    return "active";
  }

  if (normalizedToday >= quoteBoundary && normalizedToday < invoiceBoundary) {
    return "quote";
  }

  if (normalizedToday >= invoiceBoundary && normalizedToday < finalWarningBoundary) {
    return "invoice";
  }

  if (normalizedToday >= finalWarningBoundary && normalizedToday < endDate) {
    return "final warning";
  }

  if (normalizedToday >= endDate) {
    if (outcome === "renewed") {
      return "active";
    }

    if (outcome === "churned" || outcome === "pending") {
      return "churned";
    }
  }

  return legacyStatus;
}

function getStartDateUrgency(row) {
  const status = safeCalculateSubscriptionStatus(row);
  if (status === "final warning") {
    return "renewal-urgent";
  }

  if (status === "invoice" || status === "quote") {
    return "renewal-warning";
  }

  const endDate = safeGetEndDateValue(row);
  if (!endDate) {
    return "renewal-none";
  }

  const dateValue = parseDateStartOfDay(endDate);
  if (!dateValue) {
    return "renewal-none";
  }

  const now = parseDateStartOfDay(new Date());
  const daysUntil = Math.floor((dateValue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return "renewal-urgent";
  }

  if (daysUntil <= 7) {
    return "renewal-warning";
  }

  return "renewal-normal";
}

function safeCalculateSubscriptionStatus(row) {
  try {
    return calculateSubscriptionStatus(row);
  } catch (error) {
    console.error("calculateSubscriptionStatus failed", { error, row });
    return ((row?.status || "unknown").toString().trim().toLowerCase() || "unknown");
  }
}

function safeGetEndDateValue(row) {
  try {
    return getEndDateValue(row);
  } catch (error) {
    console.error("getEndDateValue failed", { error, row });
    return row?.end_date || null;
  }
}

function populateFilterOptions() {
  const statuses = [...new Set(subscriptions.map((row) => safeCalculateSubscriptionStatus(row)).filter(Boolean))].sort();
  const frequencies = [...new Set(subscriptions.map((row) => (row.billing_cycle || "unspecified").toLowerCase()).filter(Boolean))].sort();

  statusFilter.innerHTML = '<option value="all">All statuses</option>';
  statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = toStatusLabel(status);
    statusFilter.appendChild(option);
  });

  frequencyFilter.innerHTML = '<option value="all">All frequencies</option>';
  frequencies.forEach((frequency) => {
    const option = document.createElement("option");
    option.value = frequency;
    option.textContent = toStatusLabel(frequency);
    frequencyFilter.appendChild(option);
  });
}

function getFilteredSubscriptions() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;
  const selectedFrequency = frequencyFilter.value;

  const filtered = subscriptions.filter((row) => {
    const matchesSearch =
      !query ||
      formatSubscriptionName(row).toLowerCase().includes(query) ||
      (getSubscriptionMetadata(row).customerCompanyName || "").toLowerCase().includes(query) ||
      (getSubscriptionMetadata(row).equipmentName || "").toLowerCase().includes(query) ||
      (getSubscriptionMetadata(row).serialNumber || "").toLowerCase().includes(query) ||
      (row.plan || "").toLowerCase().includes(query);

    const matchesStatus = selectedStatus === "all" || safeCalculateSubscriptionStatus(row) === selectedStatus;
    const matchesFrequency =
      selectedFrequency === "all" || (row.billing_cycle || "").toLowerCase() === selectedFrequency;
    return matchesSearch && matchesStatus && matchesFrequency;
  });

  const sorted = [...filtered];
  switch (sortControl.value) {
    case "start-date-desc":
      sorted.sort((a, b) => new Date(getStartDateValue(b) || 0).getTime() - new Date(getStartDateValue(a) || 0).getTime());
      break;
    case "status-asc":
      sorted.sort((a, b) => toStatusLabel(safeCalculateSubscriptionStatus(a)).localeCompare(toStatusLabel(safeCalculateSubscriptionStatus(b))));
      break;
    case "name-asc":
      sorted.sort((a, b) => formatSubscriptionName(a).localeCompare(formatSubscriptionName(b)));
      break;
    default:
      sorted.sort((a, b) => new Date(getStartDateValue(a) || 0).getTime() - new Date(getStartDateValue(b) || 0).getTime());
      break;
  }

  return sorted;
}

function renderSubscriptions(rows) {
  console.debug("renderSubscriptions", { totalRows: rows?.length || 0, storedSubscriptions: subscriptions.length });
  subscriptionsBody.innerHTML = "";
  subscriptionsSubtitle.textContent = `${subscriptions.length} total subscription${subscriptions.length === 1 ? "" : "s"}`;

  if (rows.length === 0) {
    const hasFilters =
      searchInput.value.trim().length > 0 ||
      statusFilter.value !== "all" ||
      frequencyFilter.value !== "all";

    emptyStateTitle.textContent = hasFilters ? "No matching subscriptions" : "No subscriptions yet";
    emptyStateCopy.textContent = hasFilters
      ? "Try adjusting your search or filters to find what you need."
      : "Track your first subscription to build your workspace.";
    emptyAddButton.hidden = hasFilters;
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  rows.forEach((row) => {
    try {
      const tr = document.createElement("tr");
    tr.className = "subscription-row";

    const nameTd = document.createElement("td");
    nameTd.className = "subscription-name-cell";
    const metadata = getSubscriptionMetadata(row);
    const secondaryParts = [row.plan || "No plan", row.billing_cycle || "No billing frequency"];
    nameTd.innerHTML = `<strong title="${formatSubscriptionName(row)}">${formatSubscriptionName(
      row
    )}</strong><span>${secondaryParts.join(" • ")}</span>`;
    tr.appendChild(nameTd);

    const customerTd = document.createElement("td");
    customerTd.textContent = metadata.customerCompanyName || "—";
    tr.appendChild(customerTd);

    const cycleTd = document.createElement("td");
    cycleTd.textContent = row.billing_cycle || "—";
    tr.appendChild(cycleTd);

    const startDateTd = document.createElement("td");
    const startDate = getStartDateValue(row);
    startDateTd.textContent = formatDate(startDate) || "No start date";
    startDateTd.className = `renewal-cell ${getStartDateUrgency(row)}`;
    tr.appendChild(startDateTd);

    const endDateTd = document.createElement("td");
    const endDate = safeGetEndDateValue(row);
    endDateTd.textContent = formatDate(endDate) || "No end date";
    tr.appendChild(endDateTd);

    const statusTd = document.createElement("td");
    const statusPill = document.createElement("span");
    const statusValue = safeCalculateSubscriptionStatus(row);
    statusPill.className = `status-pill status-${statusValue.replace(/\s+/g, "-")}`;
    statusPill.textContent = toStatusLabel(statusValue);
    statusTd.appendChild(statusPill);
    tr.appendChild(statusTd);

    const actionsTd = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "actions action-row";

    const { canEdit, canDelete } = getCurrentPermissions();

    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.className = "secondary table-action";
    viewButton.dataset.action = "view";
    viewButton.dataset.id = row.id;
    viewButton.textContent = "View";
    actions.appendChild(viewButton);

    if (canEdit) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "secondary table-action";
      editButton.dataset.action = "edit";
      editButton.dataset.id = row.id;
      editButton.textContent = "Edit";
      actions.appendChild(editButton);

      const renewButton = document.createElement("button");
      renewButton.type = "button";
      renewButton.className = "secondary table-action";
      renewButton.dataset.action = "renew";
      renewButton.dataset.id = row.id;
      renewButton.textContent = "Renew";
      actions.appendChild(renewButton);
    }

    if (canDelete) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "secondary table-action danger-action";
      deleteButton.dataset.action = "delete";
      deleteButton.dataset.id = row.id;
      deleteButton.textContent = "Delete";
      actions.appendChild(deleteButton);
    }

    actionsTd.appendChild(actions);
    tr.appendChild(actionsTd);

      subscriptionsBody.appendChild(tr);
    } catch (rowError) {
      console.error("renderSubscriptions row error", { rowId: row?.id, rowError, row });
    }
  });
}

function updateDashboardMetrics() {
  const activeCount = subscriptions.filter((row) => safeCalculateSubscriptionStatus(row) === "active").length;
  metricTotalSubscriptions.textContent = String(subscriptions.length);
  metricActiveSubscriptions.textContent = String(activeCount);
  metricUserRole.textContent = currentUserRole || "signed out";
}

function renderRenewalsPanel() {
  if (!subscriptions.length) {
    renewalsList.innerHTML = '<div class="renewal-item"><p>No end date data yet. Add subscriptions to populate this view.</p></div>';
    return;
  }

  const upcomingRows = subscriptions
    .filter((row) => getEndDateValue(row))
    .sort((a, b) => new Date(getEndDateValue(a)).getTime() - new Date(getEndDateValue(b)).getTime())
    .slice(0, 6);

  if (!upcomingRows.length) {
    renewalsList.innerHTML = '<div class="renewal-item"><p>No end dates found.</p></div>';
    return;
  }

  renewalsList.innerHTML = "";

  upcomingRows.forEach((row) => {
    const endDate = getEndDateValue(row);
    const item = document.createElement("article");
    item.className = "renewal-item";
    item.innerHTML = `<p><strong>${formatSubscriptionName(row)}</strong> • ${row.plan || "No plan"}</p><p>${formatDate(
      endDate
    )} • ${toStatusLabel(safeCalculateSubscriptionStatus(row))}</p>`;
    renewalsList.appendChild(item);
  });
}

function refreshVisibleSubscriptions() {
  const filtered = getFilteredSubscriptions();
  renderSubscriptions(filtered);
}

function setBusyState(isBusy) {
  loadingSubscriptions = isBusy;
  subscriptionsSection.classList.toggle("is-loading", isBusy);
  addSubscriptionButton.disabled = isBusy;
  emptyAddButton.disabled = isBusy;
  searchInput.disabled = isBusy;
  statusFilter.disabled = isBusy;
  frequencyFilter.disabled = isBusy;
  sortControl.disabled = isBusy;
  subscriptionsTableWrap?.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function clearSubscriptions() {
  subscriptions = [];
  renewalsBySubscription = new Map();
  populateFilterOptions();
  subscriptionsBody.innerHTML = "";
  emptyState.hidden = true;
  setSubscriptionStatus("");
  renderRenewalsPanel();
  updateDashboardMetrics();
}

function clearUserManagementTables() {
  invitesBody.innerHTML = "";
  appUsersBody.innerHTML = "";
  setUserManagementStatus("");
}

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function renderInvites(rows) {
  invitesBody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No pending invites.";
    tr.appendChild(td);
    invitesBody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    const emailTd = document.createElement("td");
    emailTd.textContent = row.email || "";
    tr.appendChild(emailTd);

    const roleTd = document.createElement("td");
    roleTd.textContent = row.role || "";
    tr.appendChild(roleTd);

    const createdTd = document.createElement("td");
    createdTd.textContent = formatTimestamp(row.created_at);
    tr.appendChild(createdTd);

    const actionsTd = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "secondary";
    removeButton.dataset.action = "remove-invite";
    removeButton.dataset.id = row.id;
    removeButton.textContent = "Remove invite";
    actionsTd.appendChild(removeButton);
    tr.appendChild(actionsTd);

    invitesBody.appendChild(tr);
  });
}

function renderAppUsers(rows) {
  appUsersBody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "No app users found.";
    tr.appendChild(td);
    appUsersBody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const values = [row.user_id || "", row.role || "", formatTimestamp(row.created_at)];
    values.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    appUsersBody.appendChild(tr);
  });
}

async function loadUserManagement() {
  const { canManageUsers } = getCurrentPermissions();

  if (!canManageUsers) {
    clearUserManagementTables();
    return;
  }

  setUserManagementStatus("Loading users and invites...");

  const [{ data: invitesData, error: invitesError }, { data: appUsersData, error: appUsersError }] =
    await Promise.all([
      supabase.from("app_invites").select("id, email, role, created_at").order("created_at", { ascending: false }),
      supabase.from("app_users").select("user_id, role, created_at").order("created_at", { ascending: false }),
    ]);

  if (invitesError || appUsersError) {
    const message = invitesError?.message || appUsersError?.message || "Unknown error loading user management.";
    setUserManagementStatus(`Unable to load user management: ${message}`, true);
    return;
  }

  renderInvites(invitesData || []);
  renderAppUsers(appUsersData || []);
  setUserManagementStatus("User management loaded.");
}

function buildRenewalsMap(rows = []) {
  const grouped = new Map();
  rows.forEach((row) => {
    const subscriptionId = row.subscription_id;
    if (!subscriptionId) {
      return;
    }

    const renewalRecord = {
      ...row,
      renewal_start_date: row.renewal_start_date || row.start_date || null,
      renewal_end_date: row.renewal_end_date || row.end_date || null,
      billing_cycle: row.billing_cycle || row.billing_frequency || null,
      renewal_outcome: normalizeRenewalOutcome(row.renewal_outcome || row.outcome),
    };

    if (!grouped.has(subscriptionId)) {
      grouped.set(subscriptionId, []);
    }

    grouped.get(subscriptionId).push(renewalRecord);
  });

  grouped.forEach((terms, subscriptionId) => {
    grouped.set(subscriptionId, sortRenewalTerms(terms));
  });

  return grouped;
}

async function loadRenewals() {
  const normalizedErrorMessage = (message = "") => message.toLowerCase();
  const isMissingTableError = (message = "") => {
    const normalizedMessage = normalizedErrorMessage(message);
    return normalizedMessage.includes("does not exist") || normalizedMessage.includes("relation");
  };
  const isMissingColumnError = (message = "") => normalizedErrorMessage(message).includes("column");

  const currentSchemaResult = await supabase
    .from("subscription_renewals")
    .select("*")
    .order("start_date", { ascending: true, nullsFirst: false });

  let data = currentSchemaResult.data;
  let error = currentSchemaResult.error;

  if (error && isMissingColumnError(error.message)) {
    const legacySchemaResult = await supabase
      .from("subscription_renewals")
      .select("*")
      .order("renewal_start_date", { ascending: true, nullsFirst: false });
    data = legacySchemaResult.data;
    error = legacySchemaResult.error;
  }

  if (error) {
    if (isMissingTableError(error.message) || isMissingColumnError(error.message)) {
      console.warn("loadRenewals fallback: renewal table/columns unavailable", error.message);
      renewalsBySubscription = new Map();
      return;
    }

    throw error;
  }

  renewalsBySubscription = buildRenewalsMap(data || []);
}

async function loadSubscriptions() {
  if (!currentUser || !currentUserRole) {
    clearSubscriptions();
    return;
  }

  setBusyState(true);
  setSubscriptionStatus("Loading subscriptions...");
  console.debug("loadSubscriptions start");

  const queryResult = await supabase
    .from("subscriptions")
    .select("*")
    .order("start_date", { ascending: true, nullsFirst: false });

  let data = null;
  let error = null;

  if (queryResult.error && queryResult.error.message?.toLowerCase().includes("column")) {
    const legacyResult = await supabase.from("subscriptions").select("*").order("renewal_date", { ascending: true, nullsFirst: false });
    data = legacyResult.data;
    error = legacyResult.error;
  } else {
    data = queryResult.data;
    error = queryResult.error;
  }

  setBusyState(false);

  if (error) {
    setSubscriptionStatus(`Unable to load subscriptions: ${error.message}`, true);
    console.error("loadSubscriptions error", error);
    return;
  }

  console.debug("loadSubscriptions query result", { rows: data?.length || 0 });
  subscriptions = (data || []).filter((row) => !!row && typeof row === "object");
  try {
    await loadRenewals();
  } catch (renewalsError) {
    console.error("loadRenewals error", renewalsError);
    renewalsBySubscription = new Map();
    setSubscriptionStatus(`Subscriptions loaded, but renewals are unavailable: ${renewalsError.message}`, true);
  }
  populateFilterOptions();
  refreshVisibleSubscriptions();
  renderRenewalsPanel();
  updateDashboardMetrics();
  if (!subscriptionStatus.textContent || !subscriptionStatus.textContent.includes("unavailable")) {
    setSubscriptionStatus("Subscriptions loaded.");
  }
}

function extractMissingColumnName(errorMessage = "") {
  const match = errorMessage.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation/i);
  return match?.[1] || null;
}

async function insertSubscriptionWithFallback(payload) {
  let workingPayload = { ...payload };
  let attempts = 0;

  while (attempts < 8) {
    attempts += 1;
    console.debug("createSubscription insert attempt", { attempts, payload: workingPayload });
    const { error } = await supabase.from("subscriptions").insert(workingPayload);
    if (!error) {
      return null;
    }

    const missingColumn = extractMissingColumnName(error.message || "");
    if (!missingColumn || !(missingColumn in workingPayload)) {
      return error;
    }

    console.warn("createSubscription dropping missing column", { missingColumn });
    delete workingPayload[missingColumn];
  }

  return new Error("Unable to save subscription: schema mismatch fallback exhausted.");
}

function openAddForm() {
  openSubscriptionModal("create");
}

function applySubscriptionModalMode(mode) {
  subscriptionModalMode = mode;
  const isReadOnly = mode === "view";
  const isEditMode = mode === "edit";

  formTitle.textContent = isReadOnly ? "View subscription" : isEditMode ? "Edit subscription" : "Add subscription";
  saveSubscriptionButton.hidden = isReadOnly;
  saveSubscriptionButton.disabled = isReadOnly;
  saveSubscriptionButton.textContent = isEditMode ? "Update" : "Save";
  subscriptionForm.classList.toggle("is-readonly", isReadOnly);

  const formFields = subscriptionForm.querySelectorAll("input, select, textarea");
  formFields.forEach((field) => {
    if (["generated-display-name", "form-calculated-status", "calculated-end-date"].includes(field.id)) {
      field.readOnly = true;
      return;
    }

    field.disabled = isReadOnly;
  });
}

function fillSubscriptionForm(row = {}) {
  const metadata = getSubscriptionMetadata(row);
  const userNotes = getDisplayNotes(row);

  subscriptionForm.elements.customer_company_name.value = metadata.customerCompanyName || "";
  subscriptionForm.elements.contact_name.value = metadata.contactName || "";
  subscriptionForm.elements.contact_email.value = metadata.contactEmail || "";
  subscriptionForm.elements.contact_phone.value = metadata.contactPhone || "";
  subscriptionForm.elements.equipment_name.value = metadata.equipmentName || "";
  subscriptionForm.elements.serial_number.value = metadata.serialNumber || "";
  subscriptionForm.elements.plan.value = row.plan || "";
  ensureSelectHasOption(subscriptionForm.elements.billing_cycle, row.billing_cycle || "1 year");
  subscriptionForm.elements.billing_cycle.value = row.billing_cycle || "1 year";
  subscriptionForm.elements.start_date.value = row.start_date || row.renewal_date || "";
  if (formCalculatedStatus) {
    formCalculatedStatus.value = toStatusLabel(calculateSubscriptionStatus(row));
  }
  subscriptionForm.elements.notes.value = userNotes || "";
  updateCalculatedStatusPreview();
  updateCalculatedEndDatePreview();
  updateGeneratedNamePreview();
}

function openSubscriptionModal(mode, row = null) {
  const { canAdd, canEdit } = getCurrentPermissions();
  const wantsCreate = mode === "create";
  const wantsEdit = mode === "edit";

  if ((wantsCreate && !canAdd) || (wantsEdit && !canEdit)) {
    setSubscriptionStatus("Your role is not allowed to perform this action.", true);
    return;
  }

  editingSubscriptionId = wantsEdit ? row?.id || null : null;
  formError.textContent = "";
  subscriptionForm.reset();
  ensureSelectHasOption(subscriptionForm.elements.billing_cycle, "1 year");
  subscriptionForm.elements.billing_cycle.value = "1 year";

  if (row) {
    fillSubscriptionForm(row);
  } else {
    updateCalculatedStatusPreview();
    updateCalculatedEndDatePreview();
    updateGeneratedNamePreview();
  }

  applySubscriptionModalMode(mode);

  subscriptionDialog.showModal();
}

function getFormPayload() {
  const formData = new FormData(subscriptionForm);
  const customerCompanyName = (formData.get("customer_company_name") || "").toString().trim();
  const equipmentName = (formData.get("equipment_name") || "").toString().trim();
  const serialNumber = (formData.get("serial_number") || "").toString().trim();

  if (!customerCompanyName && !equipmentName && !serialNumber) {
    throw new Error("Enter at least a customer company, equipment/device, or serial number.");
  }

  const metadata = {
    customerCompanyName,
    contactName: (formData.get("contact_name") || "").toString().trim(),
    contactEmail: (formData.get("contact_email") || "").toString().trim(),
    contactPhone: (formData.get("contact_phone") || "").toString().trim(),
    equipmentName,
    serialNumber,
  };
  const notes = (formData.get("notes") || "").toString();
  const calculatedEndDate = calculateSubscriptionEndDate({
    start_date: (formData.get("start_date") || "").toString() || null,
    billing_cycle: (formData.get("billing_cycle") || "").toString().trim() || null,
  });

  const payload = {
    product_name: equipmentName || null,
    serial_number: serialNumber || null,
    customer_company_name: customerCompanyName || null,
    contact_name: metadata.contactName || null,
    contact_email: metadata.contactEmail || null,
    contact_phone: metadata.contactPhone || null,
    equipment_name: equipmentName || null,
    subscription_metadata: metadata,
    plan: (formData.get("plan") || "").toString().trim() || null,
    billing_cycle: (formData.get("billing_cycle") || "1 year").toString().trim() || "1 year",
    start_date: (formData.get("start_date") || "").toString() || null,
    end_date: calculatedEndDate,
    renewal_outcome: "pending",
    status: "unknown",
    notes: buildNotesWithMetadata(notes, metadata),
  };

  payload.status = calculateSubscriptionStatus(payload);
  return payload;
}

function toLegacyPayload(payload) {
  const computedStatus = calculateSubscriptionStatus(payload);
  return {
    product_name: payload.product_name,
    plan: payload.plan,
    billing_cycle: payload.billing_cycle,
    renewal_date: payload.start_date,
    status: computedStatus || payload.status,
    notes: payload.notes,
  };
}

function ensureSelectHasOption(selectElement, value) {
  if (!value) {
    return;
  }

  const hasOption = Array.from(selectElement.options).some((option) => option.value === value);

  if (!hasOption) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  }
}

function updateGeneratedNamePreview() {
  if (!generatedNamePreview) {
    return;
  }

  const metadata = {
    customerCompanyName: subscriptionForm.elements.customer_company_name?.value || "",
    equipmentName: subscriptionForm.elements.equipment_name?.value || "",
    serialNumber: subscriptionForm.elements.serial_number?.value || "",
  };

  generatedNamePreview.value = generateSubscriptionDisplayName(metadata, {});
}

function updateCalculatedStatusPreview() {
  if (!formCalculatedStatus) {
    return;
  }

  const calculatedEndDate = calculateSubscriptionEndDate({
    start_date: subscriptionForm.elements.start_date?.value || null,
    billing_cycle: subscriptionForm.elements.billing_cycle?.value || null,
  });

  const previewPayload = {
    end_date: calculatedEndDate,
    renewal_outcome: "pending",
    status: "unknown",
  };

  formCalculatedStatus.value = toStatusLabel(calculateSubscriptionStatus(previewPayload));
}

function updateCalculatedEndDatePreview() {
  const calculatedEndDateInput = subscriptionForm.elements.calculated_end_date;
  if (!calculatedEndDateInput) {
    return;
  }

  const calculatedEndDate = calculateSubscriptionEndDate({
    start_date: subscriptionForm.elements.start_date?.value || null,
    billing_cycle: subscriptionForm.elements.billing_cycle?.value || null,
  });
  calculatedEndDateInput.value = calculatedEndDate || "";
}

function renderDetailList(container, rows) {
  container.innerHTML = "";
  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value || "—";
    container.appendChild(dt);
    container.appendChild(dd);
  });
}

function openSubscriptionDetail(row) {
  const metadata = getSubscriptionMetadata(row);
  const currentTerm = getCurrentTerm(row);
  const history = getRenewalTimeline(row);

  detailTitle.textContent = formatSubscriptionName(row);
  renderDetailList(detailMetadataList, [
    ["Customer", metadata.customerCompanyName || "—"],
    ["Contact", metadata.contactName || "—"],
    ["Email", metadata.contactEmail || "—"],
    ["Phone", metadata.contactPhone || "—"],
    ["Equipment", metadata.equipmentName || "—"],
    ["Serial", metadata.serialNumber || "—"],
    ["Plan", row.plan || "—"],
    ["Billing frequency", row.billing_cycle || "—"],
    ["Base start date", row.start_date || row.renewal_date || "—"],
    ["Notes", getDisplayNotes(row) || "—"],
  ]);

  renderDetailList(detailCurrentTermList, [
    ["Status", toStatusLabel(calculateSubscriptionStatus(row))],
    ["Term start", formatDate(currentTerm?.renewal_start_date) || "—"],
    ["Term end", formatDate(currentTerm?.renewal_end_date) || "—"],
    ["Outcome", toStatusLabel(currentTerm?.renewal_outcome || "pending")],
  ]);

  detailRenewalHistory.innerHTML = "";
  if (!history.length) {
    detailRenewalHistory.innerHTML = '<article class="renewal-item"><p>No renewal history yet.</p></article>';
  } else {
    history.forEach((term, index) => {
      const item = document.createElement("article");
      item.className = "renewal-item";
      item.innerHTML = `<p><strong>Term ${index + 1}</strong> • ${toStatusLabel(term.renewal_outcome || "pending")}</p>
      <p>${formatDate(term.renewal_start_date)} → ${formatDate(term.renewal_end_date)}</p>
      <p>${term.notes || "No notes"}</p>`;
      detailRenewalHistory.appendChild(item);
    });
  }

  detailDialog.showModal();
}

function updateRenewalPreview() {
  const startDate = renewalForm.elements.renewal_start_date?.value || null;
  const billingCycle = renewalForm.elements.billing_cycle?.value || null;
  const outcome = normalizeRenewalOutcome(renewalForm.elements.renewal_outcome?.value);
  const endDate = calculateSubscriptionEndDate({ start_date: startDate, billing_cycle: billingCycle });

  renewalForm.elements.renewal_end_date.value = endDate || "";
  renewalCalculatedStatus.value = toStatusLabel(calculateSubscriptionStatus({ end_date: endDate, renewal_outcome: outcome }));
}

function openRenewalModal(row) {
  const { canEdit } = getCurrentPermissions();
  if (!canEdit) {
    setSubscriptionStatus("Your role is not allowed to renew subscriptions.", true);
    return;
  }

  renewingSubscriptionId = row?.id || null;
  renewalTargetName.textContent = formatSubscriptionName(row);
  renewalFormError.textContent = "";
  renewalForm.reset();
  renewalForm.elements.billing_cycle.value = row?.billing_cycle || "1 year";
  renewalForm.elements.renewal_outcome.value = "pending";
  renewalForm.elements.renewal_start_date.value = getEndDateValue(row) || "";
  updateRenewalPreview();
  renewalDialog.showModal();
}

async function saveRenewal(event) {
  event.preventDefault();

  if (isSubmittingRenewalForm || !renewingSubscriptionId) {
    return;
  }

  const { canEdit } = getCurrentPermissions();
  if (!canEdit) {
    renewalFormError.textContent = "Your role is not allowed to renew subscriptions.";
    return;
  }

  const startDate = (renewalForm.elements.renewal_start_date.value || "").trim();
  const billingCycle = (renewalForm.elements.billing_cycle.value || "").trim();
  const outcome = normalizeRenewalOutcome(renewalForm.elements.renewal_outcome.value);
  const notes = (renewalForm.elements.notes.value || "").trim() || null;
  const endDate = calculateSubscriptionEndDate({ start_date: startDate, billing_cycle: billingCycle });

  if (!startDate || !billingCycle || !endDate) {
    renewalFormError.textContent = "Provide renewal start date and billing frequency.";
    return;
  }

  isSubmittingRenewalForm = true;
  saveRenewalButton.disabled = true;
  renewalFormError.textContent = "";

  const renewalPayload = {
    subscription_id: renewingSubscriptionId,
    start_date: startDate,
    end_date: endDate,
    billing_frequency: billingCycle,
    renewal_outcome: outcome,
    status: calculateSubscriptionStatus({ end_date: endDate, renewal_outcome: outcome }),
    notes,
  };

  let { error } = await supabase.from("subscription_renewals").insert(renewalPayload);

  if (error && (error.message || "").toLowerCase().includes("column")) {
    const legacyRenewalPayload = {
      subscription_id: renewingSubscriptionId,
      renewal_start_date: startDate,
      renewal_end_date: endDate,
      billing_cycle: billingCycle,
      renewal_outcome: outcome,
      status: renewalPayload.status,
      notes,
    };
    ({ error } = await supabase.from("subscription_renewals").insert(legacyRenewalPayload));
  }

  isSubmittingRenewalForm = false;
  saveRenewalButton.disabled = false;

  if (error) {
    renewalFormError.textContent = `Unable to save renewal: ${error.message}`;
    return;
  }

  renewalDialog.close();
  setSubscriptionStatus("Renewal saved.");
  renewingSubscriptionId = null;
  await loadSubscriptions();
}

async function saveSubscription(event) {
  event.preventDefault();

  if (isSubmittingForm) {
    return;
  }

  if (subscriptionModalMode === "view") {
    formError.textContent = "View mode is read-only. Use Edit to update this subscription.";
    return;
  }

  const { canAdd, canEdit } = getCurrentPermissions();
  if ((editingSubscriptionId && !canEdit) || (!editingSubscriptionId && !canAdd)) {
    formError.textContent = "Your role is not allowed to perform this action.";
    return;
  }

  formError.textContent = "";

  let payload;

  try {
    payload = getFormPayload();
    console.debug("createSubscription payload", payload);
  } catch (error) {
    formError.textContent = error.message;
    return;
  }

  if (editingSubscriptionId) {
    const existingSubscription = subscriptions.find((subscription) => subscription.id === editingSubscriptionId);
    payload.renewal_outcome = normalizeRenewalOutcome(existingSubscription?.renewal_outcome || payload.renewal_outcome);
  }

  isSubmittingForm = true;
  saveSubscriptionButton.disabled = true;

  if (editingSubscriptionId) {
    let { error } = await supabase.from("subscriptions").update(payload).eq("id", editingSubscriptionId);

    if (error && error.message?.toLowerCase().includes("column")) {
      ({ error } = await supabase.from("subscriptions").update(toLegacyPayload(payload)).eq("id", editingSubscriptionId));
    }

    if (error) {
      formError.textContent = `Unable to save: ${error.message}`;
      isSubmittingForm = false;
      saveSubscriptionButton.disabled = false;
      return;
    }

    subscriptionDialog.close();
    setSubscriptionStatus("Subscription updated successfully.");
  } else {
    const { error: userError, data } = await supabase.auth.getUser();

    if (userError || !data?.user) {
      formError.textContent = userError?.message || "Unable to determine signed-in user.";
      isSubmittingForm = false;
      saveSubscriptionButton.disabled = false;
      return;
    }

    const insertPayload = {
      ...payload,
      created_by: data.user.id,
    };

    let error = await insertSubscriptionWithFallback(insertPayload);

    if (error && error.message?.toLowerCase().includes("column")) {
      const {
        serial_number,
        customer_company_name,
        contact_name,
        contact_email,
        contact_phone,
        equipment_name,
        subscription_metadata,
        start_date,
        created_by,
        end_date,
        renewal_outcome,
        ...legacyInsertPayload
      } = insertPayload;
      legacyInsertPayload.renewal_date = start_date;
      legacyInsertPayload.status = calculateSubscriptionStatus(legacyInsertPayload);
      console.debug("createSubscription legacy payload", legacyInsertPayload);
      ({ error } = await supabase.from("subscriptions").insert(legacyInsertPayload));
    }

    if (error) {
      formError.textContent = `Unable to save: ${error.message}`;
      isSubmittingForm = false;
      saveSubscriptionButton.disabled = false;
      return;
    }

    subscriptionDialog.close();
    setSubscriptionStatus("Subscription added successfully.");
  }

  isSubmittingForm = false;
  saveSubscriptionButton.disabled = false;
  await loadSubscriptions();
}

async function deleteSubscription(id) {
  const { canDelete } = getCurrentPermissions();

  if (!canDelete) {
    setSubscriptionStatus("Your role does not allow deleting subscriptions.", true);
    return;
  }

  if (loadingSubscriptions) {
    return;
  }

  const row = subscriptions.find((subscription) => subscription.id === id);
  const displayName = row ? formatSubscriptionName(row) : "this subscription";
  const confirmed = window.confirm(`Delete ${displayName}?`);

  if (!confirmed) {
    return;
  }

  setBusyState(true);
  setSubscriptionStatus("Deleting subscription...");

  const { error } = await supabase.from("subscriptions").delete().eq("id", id);

  if (error) {
    setBusyState(false);
    setSubscriptionStatus(`Unable to delete: ${error.message}`, true);
    return;
  }

  setSubscriptionStatus("Subscription deleted.");
  await loadSubscriptions();
}

function handleTableClick(event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (!id) {
    return;
  }

  const row = subscriptions.find((subscription) => subscription.id === id);

  if (action === "edit" && row) {
    openSubscriptionModal("edit", row);
  }

  if (action === "view" && row) {
    openSubscriptionDetail(row);
  }

  if (action === "renew" && row) {
    openRenewalModal(row);
  }

  if (action === "delete") {
    void deleteSubscription(id);
  }
}

async function fetchUserRole(userId) {
  const { data, error } = await supabase
    .from("app_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.role ? data.role.toLowerCase() : null;
}

async function getInviteForEmail(email) {
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const { data, error } = await supabase
    .from("app_invites")
    .select("id, role")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function ensureAppUserFromInvite(user) {
  if (!user?.id || !user?.email) {
    return null;
  }

  const existingRole = await fetchUserRole(user.id);

  if (existingRole) {
    return existingRole;
  }

  const invite = await getInviteForEmail(user.email);

  if (!invite?.role) {
    return null;
  }

  const normalizedRole = invite.role.toLowerCase();
  const { error: upsertError } = await supabase.from("app_users").upsert(
    {
      user_id: user.id,
      role: normalizedRole,
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    throw upsertError;
  }

  const { error: deleteInviteError } = await supabase.from("app_invites").delete().eq("id", invite.id);

  if (deleteInviteError) {
    console.warn("Unable to delete invite after provisioning user", deleteInviteError);
  }

  return normalizedRole;
}

async function renderAuthState(user) {
  const isSignedIn = Boolean(user);
  currentUser = user;
  currentUserRole = null;

  signedOutView.hidden = isSignedIn;
  signedInView.hidden = !isSignedIn;
  subscriptionsSection.hidden = !isSignedIn;

  if (user?.email) {
    userEmail.textContent = user.email;
    currentUserArea.textContent = user.email;
  } else {
    userEmail.textContent = "";
    currentUserArea.textContent = "Not signed in";
  }

  if (!isSignedIn) {
    setRoleStatus("Role: signed out");
    metricUserRole.textContent = "signed out";
    applyRoleUi();
    clearSubscriptions();
    clearUserManagementTables();
    setActiveView("dashboard");
    return;
  }

  setRoleStatus("Role: loading...");

  try {
    const role = await ensureAppUserFromInvite(user);

    if (!role) {
      setRoleStatus("Role: not authorised", true);
      metricUserRole.textContent = "not authorised";
      subscriptionsSection.hidden = true;
      applyRoleUi();
      clearSubscriptions();
      clearUserManagementTables();
      setStatus("You are signed in but not authorised to use this app. Contact an admin.", true);
      return;
    }

    currentUserRole = role;
    const hasKnownRole = Boolean(ROLE_PERMISSIONS[role]);

    if (!hasKnownRole) {
      setRoleStatus(`Role: ${role} (read-only)`);
      subscriptionsSection.hidden = false;
      setStatus(`Signed in with unrecognised role \"${role}\". Read-only access applied.`, true);
    } else {
      setRoleStatus(`Role: ${role}`);
    }

    metricUserRole.textContent = role;
    applyRoleUi();
    subscriptionsSection.hidden = false;
    void loadSubscriptions();
    void loadUserManagement();
  } catch (error) {
    console.error("fetchUserRole error", error);
    setRoleStatus("Role: unavailable", true);
    subscriptionsSection.hidden = true;
    applyRoleUi();
    clearSubscriptions();
    clearUserManagementTables();
    setStatus(`Signed in, but unable to load your role: ${error.message}`, true);
  }
}

async function grantAccess(event) {
  event.preventDefault();

  const { canManageUsers } = getCurrentPermissions();

  if (!canManageUsers) {
    setUserManagementStatus("Your role does not allow managing users.", true);
    return;
  }

  const email = inviteEmailInput.value.trim().toLowerCase();
  const role = inviteRoleSelect.value;

  if (!email) {
    setUserManagementStatus("Please provide an email address.", true);
    return;
  }

  grantAccessButton.disabled = true;
  setUserManagementStatus("Granting access...");

  const { error } = await supabase.from("app_invites").upsert(
    {
      email,
      role,
    },
    { onConflict: "email" }
  );

  grantAccessButton.disabled = false;

  if (error) {
    setUserManagementStatus(`Unable to grant access: ${error.message}`, true);
    return;
  }

  inviteEmailInput.value = "";
  inviteRoleSelect.value = "member";
  setUserManagementStatus("Access granted. Invite saved.");
  await loadUserManagement();
}

async function removeInvite(id) {
  const { canManageUsers } = getCurrentPermissions();

  if (!canManageUsers) {
    setUserManagementStatus("Your role does not allow managing users.", true);
    return;
  }

  const { error } = await supabase.from("app_invites").delete().eq("id", id);

  if (error) {
    setUserManagementStatus(`Unable to remove invite: ${error.message}`, true);
    return;
  }

  setUserManagementStatus("Invite removed.");
  await loadUserManagement();
}

function handleInvitesClick(event) {
  const button = event.target.closest("button[data-action='remove-invite']");

  if (!button?.dataset.id) {
    return;
  }

  void removeInvite(button.dataset.id);
}

async function loadUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    setStatus(`Unable to load auth state: ${error.message}`, true);
    renderAuthState(null);
    return;
  }

  await renderAuthState(data?.user ?? null);
}

async function sendMagicLink() {
  const email = emailInput.value.trim();

  if (!email) {
    setStatus("Please enter your email address.", true);
    return;
  }

  sendMagicLinkButton.disabled = true;
  setStatus("Sending magic link...");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });

  sendMagicLinkButton.disabled = false;

  if (error) {
    const isRateLimited = error.status === 429 || error.message.toLowerCase().includes("rate limit");

    if (isRateLimited) {
      setStatus("Email rate limited. Use password sign-in or try later.", true);
      return;
    }

    setStatus(`Error sending magic link: ${error.message}`, true);
    return;
  }

  setStatus("Magic link sent! Check your inbox.");
}

function getAuthCredentials() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email) {
    setStatus("Please enter your email address.", true);
    return null;
  }

  if (!password) {
    setStatus("Please enter your password.", true);
    return null;
  }

  return { email, password };
}

async function signInWithPassword() {
  const credentials = getAuthCredentials();

  if (!credentials) {
    return;
  }

  signInPasswordButton.disabled = true;
  setStatus("Signing in with password...");

  const { error } = await supabase.auth.signInWithPassword(credentials);
  signInPasswordButton.disabled = false;

  if (error) {
    setStatus(`Error signing in with password: ${error.message}`, true);
    return;
  }

  setStatus("Signed in with password.");
}

async function signUpWithPassword() {
  const credentials = getAuthCredentials();

  if (!credentials) {
    return;
  }

  signUpPasswordButton.disabled = true;
  setStatus("Creating account...");

  const { error, data } = await supabase.auth.signUp(credentials);
  signUpPasswordButton.disabled = false;

  if (error) {
    setStatus(`Error signing up with password: ${error.message}`, true);
    return;
  }

  if (data?.user && !data.session) {
    setStatus("Account created. Check your email to confirm your account, then sign in.");
    return;
  }

  setStatus("Signed up with password.");
}

async function signOut() {
  signOutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  signOutButton.disabled = false;

  if (error) {
    setStatus(`Error signing out: ${error.message}`, true);
    return;
  }

  setStatus("Signed out.");
}

function handleNavClick(event) {
  const button = event.target.closest("[data-nav-target]");

  if (!button?.dataset.navTarget) {
    return;
  }

  setActiveView(button.dataset.navTarget);
}

searchInput.addEventListener("input", refreshVisibleSubscriptions);
statusFilter.addEventListener("change", refreshVisibleSubscriptions);
frequencyFilter.addEventListener("change", refreshVisibleSubscriptions);
sortControl.addEventListener("change", refreshVisibleSubscriptions);
addSubscriptionButton.addEventListener("click", openAddForm);
emptyAddButton.addEventListener("click", openAddForm);
newSubscriptionCta.addEventListener("click", () => {
  setActiveView("subscriptions");
  openSubscriptionModal("create");
});
document.querySelector(".sidebar-nav").addEventListener("click", handleNavClick);
subscriptionsBody.addEventListener("click", handleTableClick);
subscriptionForm.addEventListener("submit", saveSubscription);
["customer_company_name", "equipment_name", "serial_number"].forEach((fieldName) => {
  subscriptionForm.elements[fieldName]?.addEventListener("input", updateGeneratedNamePreview);
});
["start_date", "billing_cycle"].forEach((fieldName) => {
  subscriptionForm.elements[fieldName]?.addEventListener("input", updateCalculatedStatusPreview);
  subscriptionForm.elements[fieldName]?.addEventListener("change", updateCalculatedStatusPreview);
  subscriptionForm.elements[fieldName]?.addEventListener("input", updateCalculatedEndDatePreview);
  subscriptionForm.elements[fieldName]?.addEventListener("change", updateCalculatedEndDatePreview);
});
cancelSubscriptionButton.addEventListener("click", () => subscriptionDialog.close());
renewalForm.addEventListener("submit", saveRenewal);
["renewal_start_date", "billing_cycle", "renewal_outcome"].forEach((fieldName) => {
  renewalForm.elements[fieldName]?.addEventListener("input", updateRenewalPreview);
  renewalForm.elements[fieldName]?.addEventListener("change", updateRenewalPreview);
});
cancelRenewalButton.addEventListener("click", () => renewalDialog.close());
closeDetailButton.addEventListener("click", () => detailDialog.close());
inviteForm.addEventListener("submit", grantAccess);
invitesBody.addEventListener("click", handleInvitesClick);
sendMagicLinkButton.addEventListener("click", sendMagicLink);
signInPasswordButton.addEventListener("click", signInWithPassword);
signUpPasswordButton.addEventListener("click", signUpWithPassword);
signOutButton.addEventListener("click", signOut);

supabase.auth.onAuthStateChange((event, session) => {
  console.log("Auth state changed", event);
  void renderAuthState(session?.user ?? null);
});

await loadUser();
