import { invoke } from "@tauri-apps/api/core";

const REMEMBER_KEY = "rememberLogin";

export const rememberLogin = $state({
  /** Saves the UCLA logon after a successful manual login and fills it in next time. On by default. */
  on: localStorage.getItem(REMEMBER_KEY) !== "false",
  /** Logon ID saved in the OS keyring, if any. */
  saved: undefined as string | undefined,
});

export async function loadSavedLogin(): Promise<void> {
  rememberLogin.saved = (await invoke<string | null>("saved_login_name")) ?? undefined;
}

export function setRememberLogin(on: boolean): void {
  rememberLogin.on = on;
  localStorage.setItem(REMEMBER_KEY, String(on));
}

export async function forgetLogin(): Promise<void> {
  await invoke("forget_login");
  rememberLogin.saved = undefined;
}
