//! Reads the Bruin Learn and Gradescope login cookies out of Chrome, Chromium or Brave on Linux.
//!
//! Each profile keeps cookies in an SQLite file, session cookies included, with values encrypted by
//! AES-128-CBC. The key comes from the password "peanuts" (`v10` values, no keyring) or from a
//! secret the browser stored in the desktop keyring (`v11` values).

use crate::{SavedCookie, SESSION_HOSTS};
use aes::cipher::{BlockModeDecrypt, KeyIvInit, block_padding::Pkcs7};
use rusqlite::{Connection, OpenFlags};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Config folder under `~/.config`, and the `application` name its keyring secret is stored under.
const BROWSERS: [(&str, &str); 4] = [
    ("google-chrome", "chrome"),
    ("google-chrome-beta", "chrome"),
    ("chromium", "chromium"),
    ("BraveSoftware/Brave-Browser", "brave"),
];

/// From database version 24, each decrypted value starts with the SHA-256 of its cookie's domain.
const DOMAIN_HASH_VERSION: u32 = 24;

struct Profile {
    cookies: PathBuf,
    keyring_app: &'static str,
}

/// Cookie files of every Chromium-family profile, newest first.
fn profiles(home: &Path) -> Vec<Profile> {
    let mut found: Vec<(SystemTime, Profile)> = BROWSERS
        .iter()
        .filter_map(|(dir, app)| Some((std::fs::read_dir(home.join(".config").join(dir)).ok()?, *app)))
        .flat_map(|(entries, app)| entries.flatten().map(move |e| (e.path(), app)))
        .flat_map(|(p, app)| [p.join("Network/Cookies"), p.join("Cookies")].map(|f| (f, app)))
        .filter_map(|(f, app)| {
            let modified = f.metadata().ok()?.modified().ok()?;
            Some((modified, Profile { cookies: f, keyring_app: app }))
        })
        .collect();
    found.sort_by(|a, b| b.0.cmp(&a.0));
    found.into_iter().map(|(_, p)| p).collect()
}

/// AES key for one encryption version. `v11` asks the keyring, which may show an unlock prompt.
fn key(version: &[u8], keyring_app: &str) -> Result<[u8; 16], String> {
    let password = match version {
        b"v10" => b"peanuts".to_vec(),
        b"v11" => {
            let out = std::process::Command::new("secret-tool")
                .args(["lookup", "application", keyring_app])
                .output()
                .map_err(|e| format!("Reading Chrome's key from the keyring needs secret-tool: {e}"))?;
            if !out.status.success() || out.stdout.is_empty() {
                return Err(format!("Chrome's key ({keyring_app}) was not found in the keyring"));
            }
            out.stdout
        }
        other => return Err(format!("Unknown Chrome cookie encryption {}", String::from_utf8_lossy(other))),
    };
    let mut key = [0u8; 16];
    pbkdf2::pbkdf2_hmac::<sha1::Sha1>(&password, b"saltysalt", 1, &mut key);
    Ok(key)
}

fn decrypt(encrypted: &[u8], key: &[u8; 16], host: &str, db_version: u32) -> Result<String, String> {
    let mut buf = encrypted[3..].to_vec();
    let plain = cbc::Decryptor::<aes::Aes128>::new(key.into(), &[b' '; 16].into())
        .decrypt_padded::<Pkcs7>(&mut buf)
        .map_err(|_| format!("Could not decrypt the Chrome cookie for {host}"))?;
    let value = if db_version >= DOMAIN_HASH_VERSION {
        // The hash doubles as a check that the key was right.
        let (hash, value) = plain.split_at(32);
        if hash != Sha256::digest(host.as_bytes()).as_slice() {
            return Err(format!("Chrome cookie for {host} decrypted to the wrong value"));
        }
        value
    } else {
        plain
    };
    String::from_utf8(value.to_vec()).map_err(|e| e.to_string())
}

/// Cookies for both sites from one profile. Third-party partitioned cookies are skipped.
fn read_profile(profile: &Profile) -> Result<Vec<SavedCookie>, String> {
    // immutable=1 skips locking, so this works while Chrome has the file open.
    let uri = format!("file:{}?immutable=1", profile.cookies.display());
    let db = Connection::open_with_flags(uri, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI)
        .map_err(|e| e.to_string())?;
    let db_version: u32 = db
        .query_row("SELECT value FROM meta WHERE key = 'version'", [], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .parse()
        .map_err(|e: std::num::ParseIntError| e.to_string())?;
    let mut query = db
        .prepare(
            "SELECT host_key, name, value, encrypted_value, path, is_secure, is_httponly FROM cookies \
             WHERE top_frame_site_key = ''",
        )
        .map_err(|e| e.to_string())?;
    let rows = query
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, Vec<u8>>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, bool>(5)?,
                r.get::<_, bool>(6)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut key_for: Option<(Vec<u8>, [u8; 16])> = None;
    let mut cookies = Vec::new();
    for row in rows {
        let (host, name, value, encrypted, path, secure, http_only) = row.map_err(|e| e.to_string())?;
        if !SESSION_HOSTS.iter().any(|h| host.trim_start_matches('.').ends_with(h)) {
            continue;
        }
        let value = if encrypted.is_empty() {
            value
        } else {
            let version = &encrypted[..3];
            if key_for.as_ref().is_none_or(|(v, _)| v != version) {
                key_for = Some((version.to_vec(), key(version, profile.keyring_app)?));
            }
            decrypt(&encrypted, &key_for.as_ref().unwrap().1, &host, db_version)?
        };
        cookies.push(SavedCookie { name, value, domain: Some(host), path: Some(path), secure, http_only });
    }
    Ok(cookies)
}

/// Cookies for both sites from the newest Chromium-family profile signed into Bruin Learn.
pub fn session_cookies(home: &Path) -> Result<Option<Vec<SavedCookie>>, String> {
    for profile in profiles(home) {
        let cookies = read_profile(&profile)?;
        let signed_in = cookies
            .iter()
            .any(|c| c.domain.as_deref().is_some_and(|d| d.ends_with("bruinlearn.ucla.edu")) && c.name == "canvas_session");
        if signed_in {
            return Ok(Some(cookies));
        }
    }
    Ok(None)
}
