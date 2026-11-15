//! Reads the Bruin Learn and Gradescope login cookies out of a running (or restorable) Firefox session.
//!
//! Both sites sign in with session cookies, which Firefox never writes to `cookies.sqlite`.
//! It keeps them in its session-restore file instead: lz4-compressed JSON in Mozilla's "mozlz4" wrapper.

use crate::SavedCookie;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

const HOSTS: [&str; 2] = ["bruinlearn.ucla.edu", "gradescope.com"];
const MAGIC: &[u8] = b"mozLz40\0";

#[derive(Deserialize)]
struct Session {
    #[serde(default)]
    cookies: Vec<FfCookie>,
}

#[derive(Deserialize)]
struct FfCookie {
    host: String,
    name: String,
    value: String,
    path: Option<String>,
    #[serde(default)]
    secure: bool,
    #[serde(default)]
    httponly: bool,
    #[serde(default, rename = "originAttributes")]
    origin: Origin,
}

#[derive(Deserialize, Default)]
struct Origin {
    #[serde(default, rename = "partitionKey")]
    partition_key: String,
    #[serde(default, rename = "userContextId")]
    container: u32,
}

/// Session files of every Firefox profile, newest first. `recovery.jsonlz4` exists while Firefox
/// runs; `sessionstore.jsonlz4` is written on exit when "restore previous session" is on.
fn session_files(home: &Path) -> Vec<PathBuf> {
    let roots = [home.join(".mozilla/firefox"), home.join(".config/mozilla/firefox")];
    let mut files: Vec<(SystemTime, PathBuf)> = roots
        .iter()
        .filter_map(|root| std::fs::read_dir(root).ok())
        .flatten()
        .flatten()
        .flat_map(|profile| {
            let p = profile.path();
            [p.join("sessionstore-backups/recovery.jsonlz4"), p.join("sessionstore.jsonlz4")]
        })
        .filter_map(|f| Some((f.metadata().ok()?.modified().ok()?, f)))
        .collect();
    files.sort_by(|a, b| b.0.cmp(&a.0));
    files.into_iter().map(|(_, f)| f).collect()
}

fn read_session(file: &Path) -> Result<Session, String> {
    let data = std::fs::read(file).map_err(|e| format!("{}: {e}", file.display()))?;
    if !data.starts_with(MAGIC) {
        return Err(format!("{} is not a mozlz4 file", file.display()));
    }
    let size = u32::from_le_bytes(data[8..12].try_into().unwrap()) as usize;
    let json = lz4_flex::block::decompress(&data[12..], size).map_err(|e| e.to_string())?;
    serde_json::from_slice(&json).map_err(|e| e.to_string())
}

/// Cookies for both sites from the newest Firefox session that is signed into Bruin Learn.
/// Cookies from containers and third-party partitions are skipped.
pub fn session_cookies(home: &Path) -> Result<Vec<SavedCookie>, String> {
    for file in session_files(home) {
        let cookies: Vec<FfCookie> = read_session(&file)?
            .cookies
            .into_iter()
            .filter(|c| c.origin.partition_key.is_empty() && c.origin.container == 0)
            .filter(|c| HOSTS.iter().any(|h| c.host.trim_start_matches('.').ends_with(h)))
            .collect();
        if cookies.iter().any(|c| c.host.ends_with("bruinlearn.ucla.edu") && c.name == "canvas_session") {
            return Ok(cookies
                .into_iter()
                .map(|c| SavedCookie {
                    name: c.name,
                    value: c.value,
                    domain: Some(c.host),
                    path: c.path,
                    secure: c.secure,
                    http_only: c.httponly,
                })
                .collect());
        }
    }
    Err("No Firefox session signed into Bruin Learn was found".into())
}
