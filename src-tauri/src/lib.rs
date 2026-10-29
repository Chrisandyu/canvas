use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::webview::{Cookie, PageLoadEvent};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder};

const UNAUTHORIZED: &str = "unauthorized";

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

/// Opens the site's login page in its own window. Emits `logged-in` with the site name once signed in.
#[tauri::command]
fn login(app: AppHandle, site: Site) -> Result<(), String> {
    let label = format!("login-{}", site.name());
    if let Some(existing) = app.get_webview_window(&label) {
        return existing.set_focus().map_err(|e| e.to_string());
    }
    let url: Url = format!("{}/login", site.base()).parse().unwrap();
    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url))
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
#[derive(Serialize, Deserialize)]
struct SavedCookie {
    name: String,
    value: String,
    domain: Option<String>,
    path: Option<String>,
    secure: bool,
    http_only: bool,
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
    let file = cookies_file(app)?;
    std::fs::create_dir_all(file.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&file, serde_json::to_string(&saved).unwrap()).map_err(|e| e.to_string())?;
    // Session cookies are as good as a password; keep them readable by this user only.
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())
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
        let res = client
            .get(&u)
            .header("Cookie", &cookie)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if res.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(UNAUTHORIZED.into());
        }
        if !res.status().is_success() {
            return Err(format!("{} returned {}", path, res.status()));
        }
        url = next_link(res.headers());
        let body = res.text().await.map_err(|e| e.to_string())?;
        // Canvas prefixes session-authenticated JSON with `while(1);` to block JSON hijacking.
        let json = body.strip_prefix("while(1);").unwrap_or(&body);
        pages.push(serde_json::from_str(json).map_err(|e| format!("{path}: {e}"))?);
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
        .map_err(|e| e.to_string())?;
    // Signed out: some pages answer 401, others redirect to the login page.
    if res.status() == reqwest::StatusCode::UNAUTHORIZED || res.url().path().starts_with("/login") {
        return Err(UNAUTHORIZED.into());
    }
    if !res.status().is_success() {
        return Err(format!("Gradescope {} returned {}", path, res.status()));
    }
    let body = res.text().await.map_err(|e| e.to_string())?;
    cache_write(&app, Site::Gradescope, &path, &body)?;
    Ok(body)
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
                .build()
                .unwrap(),
        )
        .invoke_handler(tauri::generate_handler![login, restore_session, api_get, gradescope_get, cache_get])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
