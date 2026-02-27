import { supabase } from "./supabaseClient.js";

const signedOutView = document.getElementById("signed-out-view");
const signedInView = document.getElementById("signed-in-view");
const emailInput = document.getElementById("email-input");
const sendMagicLinkButton = document.getElementById("send-magic-link-btn");
const signOutButton = document.getElementById("sign-out-btn");
const userEmail = document.getElementById("user-email");
const authStatus = document.getElementById("auth-status");

const subscriptionsSection = document.getElementById("subscriptions-section");
const addSubscriptionButton = document.getElementById("add-subscription-btn");
const emptyAddButton = document.getElementById("empty-add-btn");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const subscriptionsBody = document.getElementById("subscriptions-body");
const subscriptionStatus = document.getElementById("subscription-status");
const emptyState = document.getElementById("empty-state");

const subscriptionDialog = document.getElementById("subscription-dialog");
const subscriptionForm = document.getElementById("subscription-form");
const formTitle = document.getElementById("form-title");
const formError = document.getElementById("form-error");
const saveSubscriptionButton = document.getElementById("save-subscription-btn");
const cancelSubscriptionButton = document.getElementById("cancel-subscription-btn");

let currentUser = null;
let subscriptions = [];
let editingSubscriptionId = null;
let isSubmittingForm = false;
let loadingSubscriptions = false;

function setStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.style.color = isError ? "#b91c1c" : "#0f172a";
}

function setSubscriptionStatus(message, isError = false) {
  subscriptionStatus.textContent = message;
  subscriptionStatus.style.color = isError ? "#b91c1c" : "#0f172a";
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

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.dataset.id = row.id;
    editButton.textContent = "Edit";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = row.id;
    deleteButton.textContent = "Delete";

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
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

async function loadSubscriptions() {
  if (!currentUser) {
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

function renderAuthState(user) {
  const isSignedIn = Boolean(user);
  currentUser = user;

  signedOutView.hidden = isSignedIn;
  signedInView.hidden = !isSignedIn;
  subscriptionsSection.hidden = !isSignedIn;

  if (user?.email) {
    userEmail.textContent = user.email;
  } else {
    userEmail.textContent = "";
  }

  if (isSignedIn) {
    void loadSubscriptions();
  } else {
    clearSubscriptions();
  }
}

async function loadUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    setStatus(`Unable to load auth state: ${error.message}`, true);
    renderAuthState(null);
    return;
  }

  renderAuthState(data?.user ?? null);
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
    setStatus(`Error sending magic link: ${error.message}`, true);
    return;
  }

  setStatus("Magic link sent! Check your inbox.");
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
sendMagicLinkButton.addEventListener("click", sendMagicLink);
signOutButton.addEventListener("click", signOut);

supabase.auth.onAuthStateChange((event, session) => {
  console.log("Auth state changed", event);
  renderAuthState(session?.user ?? null);
});

await loadUser();
