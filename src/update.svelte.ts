import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/** Set just before installing, so the restarted app can say the update finished. */
const JUST_UPDATED_KEY = "justUpdated";
/** How long "Updated!" stays after restarting into a new version. */
const DONE_MS = 5000;

export const update = $state({
  /** A newer release on GitHub, once found. */
  available: undefined as Update | undefined,
  installing: false,
  /** True for a few seconds after restarting into a new version. */
  done: localStorage.getItem(JUST_UPDATED_KEY) !== null,
  error: undefined as string | undefined,
});

if (update.done) {
  localStorage.removeItem(JUST_UPDATED_KEY);
  setTimeout(() => (update.done = false), DONE_MS);
}

/**
 * Looks for a newer release once, at launch. Offline or GitHub unreachable just means no update is
 * offered this time, so the failure is only logged.
 */
export async function checkForUpdate(): Promise<void> {
  try {
    update.available = (await check()) ?? undefined;
  } catch (e) {
    console.error("Update check failed:", e);
  }
}

/**
 * Downloads and installs the update, then restarts into the new version. The flag is saved before
 * installing because on Windows the installer closes the app itself.
 */
export async function installUpdate(): Promise<void> {
  const available = update.available!;
  update.installing = true;
  try {
    await available.download();
    localStorage.setItem(JUST_UPDATED_KEY, available.version);
    await available.install();
    await relaunch();
  } catch (e) {
    localStorage.removeItem(JUST_UPDATED_KEY);
    update.installing = false;
    update.error = `Update failed: ${e}`;
  }
}
