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

const subscriptionsSection = document.getElementById("subscriptions-section");
const addSubscriptionButton = document.getElementById("add-subscription-btn");
const emptyAddButton = document.getElementById("empty-add-btn");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const subscriptionsBody = document.getElementById("subscriptions-body");
const subscriptionStatus = document.getElementById("subscription-status");
const emptyState = document.getElementById("empty-state");
const userManagementSection = document.getElementById("user-management-section");
const inviteForm = document.getElementById("invite-form");
const inviteEmailInput = document.getElementById("invite-email-input");
const inviteRoleSelect = document.getElementById("invite-role-select");
const grantAccessButton = document.getElementById("grant-access-btn");
const userManagementStatus = document.getElementById("user-management-status");
const invitesBody = document.getElementById("invites-body");
const appUsersBody = document.getElementById("app-users-body");

const subscriptionDialog = document.getElementById("subscription-dialog");
const subscriptionForm = document.getElementById("subscription-form");
const formTitle = document.getElementById("form-title");
const formError = document.getElementById("form-error");
const saveSubscriptionButton = document.getElementById("save-subscription-btn");
const cancelSubscriptionButton = document.getElementById("cancel-subscription-btn");

let currentUser = null;
let currentUserRole = null;
let subscriptions = [];
let editingSubscriptionId = null;
let isSubmittingForm = false;
let loadingSubscriptions = false;

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

function formatAmount(row) {
  if (row.cost_amount === null || row.cost_amount === undefined || row.cost_amount === "") {
    return "";
  }

  const currency = row.cost_currency || "AUD";
  return `${currency} ${Number(row.cost_amount).toFixed(2)}`;
}

function formatDate(dateString) {
  return dateString || "";
}

function getFilteredSubscriptions() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  return subscriptions.filter((row) => {
    const matchesSearch =
      !query ||
      (row.vendor_name || "").toLowerCase().includes(query) ||
      (row.product_name || "").toLowerCase().includes(query) ||
      (row.plan || "").toLowerCase().includes(query);

    const matchesStatus = selectedStatus === "all" || (row.status || "").toLowerCase() === selectedStatus;

    return matchesSearch && matchesStatus;
  });
}

function renderSubscriptions(rows) {
  subscriptionsBody.innerHTML = "";

  if (rows.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    const fields = [
      row.vendor_name || "",
      row.product_name || "",
      row.plan || "",
      formatAmount(row),
      row.billing_cycle || "",
      formatDate(row.renewal_date),
      row.status || "",
    ];

    fields.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    const actionsTd = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "actions";

    const { canEdit, canDelete } = getCurrentPermissions();

    if (canEdit) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.dataset.action = "edit";
      editButton.dataset.id = row.id;
      editButton.textContent = "Edit";
      actions.appendChild(editButton);
    }

    if (canDelete) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.dataset.action = "delete";
      deleteButton.dataset.id = row.id;
      deleteButton.textContent = "Delete";
      actions.appendChild(deleteButton);
    }

    actionsTd.appendChild(actions);
    tr.appendChild(actionsTd);

    subscriptionsBody.appendChild(tr);
  });
}

function refreshVisibleSubscriptions() {
  const filtered = getFilteredSubscriptions();
  renderSubscriptions(filtered);
}

function setBusyState(isBusy) {
  loadingSubscriptions = isBusy;
  addSubscriptionButton.disabled = isBusy;
  emptyAddButton.disabled = isBusy;
  searchInput.disabled = isBusy;
  statusFilter.disabled = isBusy;
}

function clearSubscriptions() {
  subscriptions = [];
  subscriptionsBody.innerHTML = "";
  emptyState.hidden = true;
  setSubscriptionStatus("");
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

async function loadSubscriptions() {
  if (!currentUser || !currentUserRole) {
    clearSubscriptions();
    return;
  }

  setBusyState(true);
  setSubscriptionStatus("Loading subscriptions...");

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .order("renewal_date", { ascending: true, nullsFirst: false });

  setBusyState(false);

  if (error) {
    setSubscriptionStatus(`Unable to load subscriptions: ${error.message}`, true);
    console.error("loadSubscriptions error", error);
    return;
  }

  subscriptions = data || [];
  refreshVisibleSubscriptions();
  setSubscriptionStatus("Subscriptions loaded.");
}

function openAddForm() {
  const { canAdd } = getCurrentPermissions();

  if (!canAdd) {
    setSubscriptionStatus("Your role does not allow adding subscriptions.", true);
    return;
  }

  editingSubscriptionId = null;
  formTitle.textContent = "Add subscription";
  formError.textContent = "";
  subscriptionForm.reset();
  subscriptionForm.elements.cost_currency.value = "AUD";
  subscriptionForm.elements.billing_cycle.value = "monthly";
  subscriptionForm.elements.status.value = "active";
  subscriptionDialog.showModal();
}

function openEditForm(row) {
  const { canEdit } = getCurrentPermissions();

  if (!canEdit) {
    setSubscriptionStatus("Your role does not allow editing subscriptions.", true);
    return;
  }

  editingSubscriptionId = row.id;
  formTitle.textContent = "Edit subscription";
  formError.textContent = "";

  subscriptionForm.elements.vendor_name.value = row.vendor_name || "";
  subscriptionForm.elements.product_name.value = row.product_name || "";
  subscriptionForm.elements.plan.value = row.plan || "";
  subscriptionForm.elements.cost_amount.value = row.cost_amount ?? "";
  subscriptionForm.elements.cost_currency.value = row.cost_currency || "AUD";
  subscriptionForm.elements.billing_cycle.value = row.billing_cycle || "monthly";
  subscriptionForm.elements.renewal_date.value = row.renewal_date || "";
  subscriptionForm.elements.status.value = row.status || "active";
  subscriptionForm.elements.notes.value = row.notes || "";

  subscriptionDialog.showModal();
}

function getFormPayload() {
  const formData = new FormData(subscriptionForm);
  const vendorName = (formData.get("vendor_name") || "").toString().trim();

  if (!vendorName) {
    throw new Error("Vendor name is required.");
  }

  const costAmountRaw = (formData.get("cost_amount") || "").toString().trim();

  return {
    vendor_name: vendorName,
    product_name: (formData.get("product_name") || "").toString().trim() || null,
    plan: (formData.get("plan") || "").toString().trim() || null,
    cost_amount: costAmountRaw ? Number(costAmountRaw) : null,
    cost_currency: (formData.get("cost_currency") || "AUD").toString().trim() || "AUD",
    billing_cycle: (formData.get("billing_cycle") || "monthly").toString().trim() || "monthly",
    renewal_date: (formData.get("renewal_date") || "").toString() || null,
    status: (formData.get("status") || "active").toString(),
    notes: (formData.get("notes") || "").toString().trim() || null,
  };
}

async function saveSubscription(event) {
  event.preventDefault();

  if (isSubmittingForm) {
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
  } catch (error) {
    formError.textContent = error.message;
    return;
  }

  isSubmittingForm = true;
  saveSubscriptionButton.disabled = true;

  if (editingSubscriptionId) {
    const { error } = await supabase.from("subscriptions").update(payload).eq("id", editingSubscriptionId);

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

    const { error } = await supabase.from("subscriptions").insert(insertPayload);

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
  const vendor = row?.vendor_name || "this vendor";
  const confirmed = window.confirm(`Delete subscription for ${vendor}?`);

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
    openEditForm(row);
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
  } else {
    userEmail.textContent = "";
  }

  if (!isSignedIn) {
    setRoleStatus("Role: signed out");
    applyRoleUi();
    clearSubscriptions();
    clearUserManagementTables();
    return;
  }

  setRoleStatus("Role: loading...");

  try {
    const role = await ensureAppUserFromInvite(user);

    if (!role) {
      setRoleStatus("Role: not authorised", true);
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

searchInput.addEventListener("input", refreshVisibleSubscriptions);
statusFilter.addEventListener("change", refreshVisibleSubscriptions);
addSubscriptionButton.addEventListener("click", openAddForm);
emptyAddButton.addEventListener("click", openAddForm);
subscriptionsBody.addEventListener("click", handleTableClick);
subscriptionForm.addEventListener("submit", saveSubscription);
cancelSubscriptionButton.addEventListener("click", () => subscriptionDialog.close());
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
