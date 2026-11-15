#[cfg(target_os = "linux")]
mod chrome;
mod firefox;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::webview::{Cookie, PageLoadEvent};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder};

const UNAUTHORIZED: &str = "unauthorized";
/// Returned when a request can't reach the server at all, so the app can keep showing saved data.
const OFFLINE: &str = "offline";

fn send_error(e: reqwest::Error) -> String {
    if e.is_connect() || e.is_timeout() {
        OFFLINE.into()
    } else {
        e.to_string()
    }
}

const SITES: [Site; 2] = [Site::Canvas, Site::Gradescope];

#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum Site {
    Canvas,
    Gradescope,
}

impl Site {
    fn base(self) -> &'static str {
        match self {
            Site::Canvas => "https://bruinlearn.ucla.edu",
            Site::Gradescope => "https://www.gradescope.com",
        }
    }

    fn name(self) -> &'static str {
        match self {
            Site::Canvas => "canvas",
            Site::Gradescope => "gradescope",
        }
    }

    /// True once the login window has landed on a signed-in page.
    fn is_signed_in(self, url: &Url) -> bool {
        let host = url.host_str() == Url::parse(self.base()).unwrap().host_str();
        let path = url.path();
        host && match self {
            Site::Canvas => !path.starts_with("/login"),
            Site::Gradescope => path.starts_with("/account") || path.starts_with("/courses"),
        }
    }
}

/// Opens the site's login page in its own window. Emits `logged-in` with the site name once signed in,
/// and `login-closed` when the window goes away (after success, or because the user closed it).
#[tauri::command]
fn login(app: AppHandle, site: Site) -> Result<(), String> {
    let label = format!("login-{}", site.name());
    if let Some(existing) = app.get_webview_window(&label) {
        return existing.set_focus().map_err(|e| e.to_string());
    }
    let url: Url = format!("{}/login", site.base()).parse().unwrap();
    let window = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url))
        .title(format!("Log in to {}", site.name()))
        .inner_size(520.0, 720.0)
        .on_page_load(move |window, payload| {
            if payload.event() == PageLoadEvent::Finished && site.is_signed_in(payload.url()) {
                let w = window.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = save_cookies(w.app_handle()) {
                        eprintln!("saving session failed: {e}");
                    }
                    w.emit("logged-in", site.name()).unwrap();
                    w.close()
                });
            }
        })
        .build()
        .map_err(|e| e.to_string())?;
    window.on_window_event(move |e| {
        if matches!(e, tauri::WindowEvent::Destroyed) {
            app.emit("login-closed", site.name()).unwrap();
        }
    });
    Ok(())
}

/// Cookie header built from the session the login window stored in the shared webview cookie jar.
fn session_cookie(app: &AppHandle, site: Site) -> Result<String, String> {
    let main = app.get_webview_window("main").ok_or("main window missing")?;
    let cookies = main
        .cookies_for_url(site.base().parse().unwrap())
        .map_err(|e| e.to_string())?;
    Ok(cookies
        .iter()
        .map(|c| format!("{}={}", c.name(), c.value()))
        .collect::<Vec<_>>()
        .join("; "))
}

/// A cookie as stored on disk. WebKit drops session cookies on exit, and both sites use them,
/// so the app keeps its own copy to stay signed in across restarts.
/// Sites whose login cookies are copied from a browser.
pub const SESSION_HOSTS: [&str; 2] = ["bruinlearn.ucla.edu", "gradescope.com"];

#[derive(Serialize, Deserialize)]
pub struct SavedCookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub secure: bool,
    pub http_only: bool,
}

fn cookies_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("cookies.json"))
}

fn save_cookies(app: &AppHandle) -> Result<(), String> {
    let main = app.get_webview_window("main").ok_or("main window missing")?;
    let mut saved = Vec::new();
    for site in SITES {
        for c in main.cookies_for_url(site.base().parse().unwrap()).map_err(|e| e.to_string())? {
            saved.push(SavedCookie {
                name: c.name().into(),
                value: c.value().into(),
                domain: c.domain().map(Into::into),
                path: c.path().map(Into::into),
                secure: c.secure().unwrap_or(false),
                http_only: c.http_only().unwrap_or(false),
            });
        }
    }
    write_cookies(app, &saved)
}

fn write_cookies(app: &AppHandle, saved: &[SavedCookie]) -> Result<(), String> {
    let file = cookies_file(app)?;
    std::fs::create_dir_all(file.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&file, serde_json::to_string(saved).unwrap()).map_err(|e| e.to_string())?;
    restrict_to_user(&file)
}

/// Session cookies are as good as a password; keep them readable by this user only.
#[cfg(unix)]
fn restrict_to_user(file: &std::path::Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(file, std::fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())
}

/// On Windows the app data folder is already private to the user's account.
#[cfg(windows)]
fn restrict_to_user(_file: &std::path::Path) -> Result<(), String> {
    Ok(())
}

/// Puts saved cookies back into the webview cookie store. Called once before the first request.
#[tauri::command]
async fn restore_session(app: AppHandle) -> Result<(), String> {
    let file = cookies_file(&app)?;
    if !file.exists() {
        return Ok(());
    }
    let saved: Vec<SavedCookie> =
        serde_json::from_str(&std::fs::read_to_string(file).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    apply_cookies(&app, saved)
}

/// Signs out of both sites: forgets the saved session, the webview's cookies and the downloaded data.
/// Theme, course names and done marks live in localStorage and are kept.
#[tauri::command]
async fn logout(app: AppHandle) -> Result<(), String> {
    let main = app.get_webview_window("main").ok_or("main window missing")?;
    for site in SITES {
        for c in main.cookies_for_url(site.base().parse().unwrap()).map_err(|e| e.to_string())? {
            main.delete_cookie(c).map_err(|e| e.to_string())?;
        }
    }
    let file = cookies_file(&app)?;
    if file.exists() {
        std::fs::remove_file(file).map_err(|e| e.to_string())?;
    }
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    if cache.exists() {
        std::fs::remove_dir_all(cache).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Copies the Bruin Learn and Gradescope logins from Firefox into the app and saves them.
#[tauri::command]
async fn import_browser_session(app: AppHandle) -> Result<(), String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let cookies = browser_cookies(&home)?.ok_or(NO_SESSION)?;
    write_cookies(&app, &cookies)?;
    apply_cookies(&app, cookies)
}

#[cfg(target_os = "linux")]
const NO_SESSION: &str = "No Firefox or Chrome window signed into Bruin Learn was found";
#[cfg(not(target_os = "linux"))]
const NO_SESSION: &str = "No Firefox window signed into Bruin Learn was found";

/// Login cookies from the first browser that is signed into Bruin Learn: Firefox, then Chrome.
fn browser_cookies(home: &std::path::Path) -> Result<Option<Vec<SavedCookie>>, String> {
    if let Some(cookies) = firefox::session_cookies(home)? {
        return Ok(Some(cookies));
    }
    #[cfg(target_os = "linux")]
    return chrome::session_cookies(home);
    #[cfg(not(target_os = "linux"))]
    Ok(None)
}

fn apply_cookies(app: &AppHandle, saved: Vec<SavedCookie>) -> Result<(), String> {
    let main = app.get_webview_window("main").ok_or("main window missing")?;
    for c in saved {
        let mut cookie = Cookie::build((c.name, c.value)).secure(c.secure).http_only(c.http_only);
        if let Some(d) = c.domain {
            cookie = cookie.domain(d);
        }
        if let Some(p) = c.path {
            cookie = cookie.path(p);
        }
        main.set_cookie(cookie.build()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Next page URL from a Canvas `Link` header.
fn next_link(headers: &reqwest::header::HeaderMap) -> Option<String> {
    let link = headers.get("link")?.to_str().ok()?;
    link.split(',').find_map(|part| {
        let (url, rel) = part.split_once(';')?;
        rel.contains("rel=\"next\"")
            .then(|| url.trim().trim_start_matches('<').trim_end_matches('>').to_string())
    })
}

fn cache_file(app: &AppHandle, site: Site, path: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join(site.name());
    let name: String = path
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    Ok(dir.join(name))
}

fn cache_write(app: &AppHandle, site: Site, path: &str, body: &str) -> Result<(), String> {
    let file = cache_file(app, site, path)?;
    std::fs::create_dir_all(file.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&file, body).map_err(|e| e.to_string())
}

/// One page of a Canvas API response, plus the URL of the next page if there is one.
async fn canvas_page(client: &reqwest::Client, cookie: &str, url: &str) -> Result<(Value, Option<String>), String> {
    let res = client
        .get(url)
        .header("Cookie", cookie)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(send_error)?;
    if res.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(UNAUTHORIZED.into());
    }
    if !res.status().is_success() {
        return Err(format!("{url} returned {}", res.status()));
    }
    let next = next_link(res.headers());
    let body = res.text().await.map_err(send_error)?;
    // Canvas prefixes session-authenticated JSON with `while(1);` to block JSON hijacking.
    let json = body.strip_prefix("while(1);").unwrap_or(&body);
    let value = serde_json::from_str(json).map_err(|e| format!("{url}: {e}"))?;
    Ok((value, next))
}

/// GET a Canvas API path (e.g. `/courses`), following pagination. Arrays are concatenated.
#[tauri::command]
async fn api_get(
    app: AppHandle,
    client: tauri::State<'_, reqwest::Client>,
    path: String,
) -> Result<Value, String> {
    let cookie = session_cookie(&app, Site::Canvas)?;
    let mut url = Some(format!("{}/api/v1{path}", Site::Canvas.base()));
    let mut pages: Vec<Value> = Vec::new();

    while let Some(u) = url {
        let (page, next) = canvas_page(&client, &cookie, &u).await?;
        pages.push(page);
        url = next;
    }

    let value = if pages.len() == 1 {
        pages.pop().unwrap()
    } else {
        Value::Array(
            pages
                .into_iter()
                .flat_map(|p| p.as_array().cloned().unwrap_or_default())
                .collect(),
        )
    };

    cache_write(&app, Site::Canvas, &path, &value.to_string())?;
    Ok(value)
}

/// GET a Gradescope page as HTML. Gradescope has no student API, so the frontend parses the page.
#[tauri::command]
async fn gradescope_get(
    app: AppHandle,
    client: tauri::State<'_, reqwest::Client>,
    path: String,
) -> Result<String, String> {
    let cookie = session_cookie(&app, Site::Gradescope)?;
    let res = client
        .get(format!("{}{path}", Site::Gradescope.base()))
        .header("Cookie", &cookie)
        .send()
        .await
        .map_err(send_error)?;
    // Signed out: some pages answer 401, others redirect to the login page.
    if res.status() == reqwest::StatusCode::UNAUTHORIZED || res.url().path().starts_with("/login") {
        return Err(UNAUTHORIZED.into());
    }
    if !res.status().is_success() {
        return Err(format!("Gradescope {} returned {}", path, res.status()));
    }
    let body = res.text().await.map_err(send_error)?;
    cache_write(&app, Site::Gradescope, &path, &body)?;
    Ok(body)
}

/// Opens a Canvas file in the system's default app. Each file is downloaded once into the cache,
/// so later opens are instant and work offline.
#[tauri::command]
async fn open_file(app: AppHandle, client: tauri::State<'_, reqwest::Client>, id: u64) -> Result<(), String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("files");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let prefix = format!("{id}-");
    let existing = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .map(|f| f.path())
        .find(|p| p.file_name().unwrap().to_string_lossy().starts_with(&prefix));

    let path = match existing {
        Some(p) => p,
        None => {
            let cookie = session_cookie(&app, Site::Canvas)?;
            let url = format!("{}/api/v1/files/{id}", Site::Canvas.base());
            let (meta, _) = canvas_page(&client, &cookie, &url).await?;
            let name = meta["display_name"].as_str().ok_or("file has no name")?.replace(['/', '\0'], "_");
            let download = meta["url"].as_str().ok_or("file has no download link")?;
            // reqwest drops the Cookie header when Canvas redirects to its file storage host.
            let res = client.get(download).header("Cookie", &cookie).send().await.map_err(send_error)?;
            if !res.status().is_success() {
                return Err(format!("Downloading {name} returned {}", res.status()));
            }
            let bytes = res.bytes().await.map_err(send_error)?;
            let path = dir.join(format!("{prefix}{name}"));
            // Write then rename, so a failed download never leaves a half file that looks complete.
            let partial = dir.join(format!(".{prefix}partial"));
            std::fs::write(&partial, &bytes).map_err(|e| e.to_string())?;
            std::fs::rename(&partial, &path).map_err(|e| e.to_string())?;
            path
        }
    };
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}

/// Last cached response body for a path, or null if never fetched.
#[tauri::command]
fn cache_get(app: AppHandle, site: Site, path: String) -> Result<Option<String>, String> {
    let file = cache_file(&app, site, &path)?;
    if !file.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(file).map(Some).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // UCLA Canvas's firewall returns 403 for requests without a User-Agent.
        .manage(
            reqwest::Client::builder()
                .user_agent("Canvas/0.1")
                .connect_timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap(),
        )
        .invoke_handler(tauri::generate_handler![login, logout, restore_session, import_browser_session, api_get, gradescope_get, cache_get, open_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
