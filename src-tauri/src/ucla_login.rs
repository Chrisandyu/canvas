//! Remembers the UCLA logon ID and password typed into a login window, and fills them in next time.
//!
//! A script on UCLA's sign-in page hands the typed login to `stash_login` when the form is sent.
//! It is only saved, in the OS keyring, once that window reaches a signed-in page, so a wrong
//! password is never kept. The form is filled in but never sent automatically: repeatedly sending a
//! stale password could lock the account.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

const KEYRING_SERVICE: &str = "edu.ucla.canvasclient";
const KEYRING_USER: &str = "ucla-logon";

#[derive(Serialize, Deserialize, Clone)]
struct Credentials {
    username: String,
    password: String,
}

/// Logins sent from each login window, waiting to be saved once that window signs in.
#[derive(Default)]
pub struct PendingLogins(Mutex<HashMap<String, Credentials>>);

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

fn saved() -> Result<Option<Credentials>, String> {
    match entry()?.get_password() {
        Ok(json) => Ok(Some(serde_json::from_str(&json).map_err(|e| e.to_string())?)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Script for a login window: fills the UCLA sign-in form with the saved login (if `remember`) and
/// reports what was typed when the form is sent.
pub fn script(remember: bool) -> Result<String, String> {
    let fill = if remember { saved()? } else { None };
    Ok(include_str!("ucla_login.js")
        .replace("__SAVED__", &serde_json::to_string(&fill).unwrap())
        .replace("__REMEMBER__", &remember.to_string()))
}

/// Called from UCLA's sign-in page as the form is sent. Held until the window signs in.
#[tauri::command]
pub fn stash_login(
    window: tauri::WebviewWindow,
    pending: tauri::State<'_, PendingLogins>,
    username: String,
    password: String,
) {
    pending.0.lock().unwrap().insert(window.label().into(), Credentials { username, password });
}

/// Saves the login sent from window `label`, now that it has signed in.
pub fn save_pending(app: &AppHandle, label: &str) -> Result<(), String> {
    let Some(credentials) = app.state::<PendingLogins>().0.lock().unwrap().remove(label) else {
        return Ok(());
    };
    entry()?
        .set_password(&serde_json::to_string(&credentials).unwrap())
        .map_err(|e| e.to_string())
}

pub fn drop_pending(app: &AppHandle, label: &str) {
    app.state::<PendingLogins>().0.lock().unwrap().remove(label);
}

/// The saved logon ID, for Settings. The password only ever goes to UCLA's sign-in page.
#[tauri::command]
pub fn saved_login_name() -> Result<Option<String>, String> {
    Ok(saved()?.map(|c| c.username))
}

#[tauri::command]
pub fn forget_login() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
