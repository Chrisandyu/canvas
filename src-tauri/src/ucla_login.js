// Runs on every page of a login window; only acts on UCLA's sign-in form.
(() => {
  if (location.host !== "shb.ais.ucla.edu" || window !== window.top) return;
  const saved = __SAVED__;
  const remember = __REMEMBER__;
  addEventListener("DOMContentLoaded", () => {
    const user = document.getElementById("logon");
    const pass = document.getElementById("pass");
    if (!user || !pass) return;
    if (saved && !user.value) {
      user.value = saved.username;
      pass.value = saved.password;
    }
    if (!remember) return;
    // Holds the form until the app has the login, then sends it on with the same button, since the
    // server reads the button's name. The page unloading could otherwise cut the hand-over short.
    let handedOver = false;
    user.form.addEventListener("submit", (e) => {
      if (handedOver) return;
      e.preventDefault();
      const button = e.submitter;
      // Inside then(), so even a missing Tauri bridge can't stop the form from being sent.
      Promise.resolve()
        .then(() => window.__TAURI_INTERNALS__.invoke("stash_login", { username: user.value, password: pass.value }))
        .catch((err) => console.error("Saving the login failed:", err))
        .finally(() => {
          handedOver = true;
          user.form.requestSubmit(button);
        });
    });
  });
})();
