import { supabase } from "./supabaseClient.js";

const signedOutView = document.getElementById("signed-out-view");
const signedInView = document.getElementById("signed-in-view");
const emailInput = document.getElementById("email-input");
const sendMagicLinkButton = document.getElementById("send-magic-link-btn");
const signOutButton = document.getElementById("sign-out-btn");
const userEmail = document.getElementById("user-email");
const authStatus = document.getElementById("auth-status");

function setStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.style.color = isError ? "#b91c1c" : "#0f172a";
}

function renderAuthState(user) {
  const isSignedIn = Boolean(user);

  signedOutView.hidden = isSignedIn;
  signedInView.hidden = !isSignedIn;

  if (user?.email) {
    userEmail.textContent = user.email;
  } else {
    userEmail.textContent = "";
  }

  if (isSignedIn) {
    console.log("Signed in", { id: user.id, email: user.email });
  } else {
    console.log("Signed out");
  }
}

async function loadUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    setStatus(`Unable to load auth state: ${error.message}`, true);
    console.error("getUser error", error);
    renderAuthState(null);
    return;
  }

  const currentUser = data?.user ?? null;
  renderAuthState(currentUser);
}

async function sendMagicLink() {
  const email = emailInput.value.trim();

  if (!email) {
    setStatus("Please enter your email address.", true);
    return;
  }

  setStatus("Sending magic link...");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });

  if (error) {
    setStatus(`Error sending magic link: ${error.message}`, true);
    console.error("signInWithOtp error", error);
    return;
  }

  setStatus("Magic link sent! Check your inbox.");
}

async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    setStatus(`Error signing out: ${error.message}`, true);
    console.error("signOut error", error);
    return;
  }

  setStatus("Signed out.");
}

sendMagicLinkButton.addEventListener("click", sendMagicLink);
signOutButton.addEventListener("click", signOut);

supabase.auth.onAuthStateChange((event, session) => {
  const currentUser = session?.user ?? null;
  console.log("Auth state changed", event, currentUser ? { id: currentUser.id, email: currentUser.email } : null);
  renderAuthState(currentUser);
});

await loadUser();
