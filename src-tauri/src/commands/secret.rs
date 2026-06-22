//! OS keychain storage for provider API keys (security fix H5).
//!
//! Provider keys used to live in localStorage under reversible base64
//! (providerStore.ts). On Windows + macOS we store them in the OS credential
//! vault instead — Windows Credential Manager / macOS Keychain, via the
//! `keyring` crate. Both backends ship with the OS, so no extra system library
//! is pulled in, and the secret is bound to the user's login.
//!
//! Linux desktop and the web build have no robust uniform secret store here
//! (the secret-service backend needs libdbus/gnome-keyring and breaks on
//! headless/minimal setups), so those keep the obfuscated-localStorage path:
//! on those targets the commands compile to a stub that reports "unsupported",
//! and the frontend (providerStore.hydrateProviderKeys) falls back.

/// Keychain service name. The "account" is the provider id (ollama / openai /
/// anthropic). Keep this stable — changing it would orphan stored keys.
#[cfg(any(target_os = "windows", target_os = "macos"))]
const SERVICE: &str = "com.locallyuncensored.providerkeys";

#[cfg(any(target_os = "windows", target_os = "macos"))]
#[tauri::command]
pub fn secret_set(account: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &account).map_err(|e| e.to_string())?;
    // An empty value means "no key" — delete rather than store an empty secret,
    // so a cleared key never lingers in the vault.
    if value.is_empty() {
        return match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        };
    }
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
#[tauri::command]
pub fn secret_get(account: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE, &account).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
#[tauri::command]
pub fn secret_delete(account: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &account).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// ── Non-keychain platforms (Linux desktop) ──────────────────────────────
// The commands still exist so `invoke('secret_get', …)` resolves, but they
// report unsupported. The frontend treats any error here as "no keychain" and
// keeps using the obfuscated-localStorage path — identical to today's behavior.

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
#[tauri::command]
pub fn secret_set(_account: String, _value: String) -> Result<(), String> {
    Err("keychain unsupported on this platform".into())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
#[tauri::command]
pub fn secret_get(_account: String) -> Result<Option<String>, String> {
    Err("keychain unsupported on this platform".into())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
#[tauri::command]
pub fn secret_delete(_account: String) -> Result<(), String> {
    Err("keychain unsupported on this platform".into())
}
