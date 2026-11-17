// Listing the app's commands makes each one need a permission (see capabilities/). That is what
// lets UCLA's sign-in page call `stash_login` and nothing else.
const COMMANDS: &[&str] = &[
    "login",
    "logout",
    "restore_session",
    "resume_session",
    "import_browser_session",
    "api_get",
    "gradescope_get",
    "cache_get",
    "download_file",
    "read_file",
    "save_file",
    "on_laptop_screen",
    "stash_login",
    "saved_login_name",
    "forget_login",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
