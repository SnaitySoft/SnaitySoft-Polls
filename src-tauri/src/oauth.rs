use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tauri::State;
use tauri_plugin_opener::OpenerExt;
use tokio::sync::{oneshot, Mutex};

use crate::overlay::OverlayState;

// Twitch's "Public" client type (no client secret) only documents the Device Code Grant
// Flow — no callback/redirect involved, so it needs none of this coordinator machinery.
// Kick uses the classic Authorization Code flow, which needs a redirect callback resolved
// from the matching axum route in overlay.rs — the coordinator tracks one pending flow per
// provider name (currently just "kick") so it stays generic if another provider needs it.

#[derive(serde::Deserialize)]
pub struct CallbackParams {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

struct PendingFlow {
    state: String,
    tx: oneshot::Sender<Result<String, String>>,
}

#[derive(Default)]
pub struct OAuthCoordinator {
    pending: Mutex<HashMap<String, PendingFlow>>,
}

impl OAuthCoordinator {
    async fn begin(&self, provider: &str) -> (String, oneshot::Receiver<Result<String, String>>) {
        let flow_state = random_state();
        let (tx, rx) = oneshot::channel();
        let mut guard = self.pending.lock().await;
        guard.insert(
            provider.to_string(),
            PendingFlow {
                state: flow_state.clone(),
                tx,
            },
        );
        (flow_state, rx)
    }

    /// Called from the axum callback route. Returns true if a matching pending flow was resolved.
    pub async fn resolve(&self, provider: &str, params: CallbackParams) -> bool {
        let mut guard = self.pending.lock().await;
        let Some(pending) = guard.remove(provider) else {
            return false;
        };

        let result = match (&params.state, &params.code, &params.error) {
            (Some(s), Some(code), _) if *s == pending.state => Ok(code.clone()),
            (_, _, Some(err)) => Err(err.clone()),
            _ => Err("callback inválido".to_string()),
        };

        let ok = result.is_ok();
        let _ = pending.tx.send(result);
        ok
    }
}

fn random_state() -> String {
    use rand::Rng;
    let bytes: [u8; 16] = rand::thread_rng().gen();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// PKCE (RFC 7636) — the Kick OAuth flow requires it alongside the client secret.
fn generate_pkce_verifier() -> String {
    use rand::distributions::Alphanumeric;
    use rand::Rng;
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect()
}

fn pkce_challenge_s256(verifier: &str) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    use sha2::{Digest, Sha256};
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

async fn await_code(rx: oneshot::Receiver<Result<String, String>>) -> Result<String, String> {
    match tokio::time::timeout(Duration::from_secs(120), rx).await {
        Ok(Ok(Ok(code))) => Ok(code),
        Ok(Ok(Err(e))) => Err(e),
        Ok(Err(_)) => Err("canal de callback fechado".to_string()),
        Err(_) => Err("tempo esgotado aguardando autorização".to_string()),
    }
}

fn env_var(name: &str) -> Result<String, String> {
    std::env::var(name).map_err(|_| format!("{name} não configurado no .env do app"))
}

/// Sends the request and parses the JSON body, surfacing the provider's own error
/// message on non-2xx responses instead of the generic reqwest status-code error.
async fn send_and_parse<T: serde::de::DeserializeOwned>(req: reqwest::RequestBuilder) -> Result<T, String> {
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let body = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("HTTP {status}: {body}"));
    }

    serde_json::from_str(&body).map_err(|e| format!("resposta inesperada ({e}): {body}"))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchBotLogin {
    pub username: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitchDeviceStart {
    pub user_code: String,
    pub verification_uri: String,
    pub device_code: String,
    pub interval: u64,
    pub expires_in: u64,
}

#[derive(serde::Deserialize)]
struct TwitchDeviceResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
}

#[derive(serde::Deserialize)]
struct TwitchTokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
}

#[derive(serde::Deserialize)]
struct TwitchUsersResponse {
    data: Vec<TwitchUserEntry>,
}

#[derive(serde::Deserialize)]
struct TwitchUserEntry {
    login: String,
}

const TWITCH_SCOPES: &str = "chat:read chat:edit";

#[tauri::command]
pub async fn twitch_oauth_device_start(app: tauri::AppHandle) -> Result<TwitchDeviceStart, String> {
    let client_id = env_var("TWITCH_CLIENT_ID")?;

    let http = reqwest::Client::new();
    let device: TwitchDeviceResponse = send_and_parse(http.post("https://id.twitch.tv/oauth2/device").form(&[
        ("client_id", client_id.as_str()),
        ("scopes", TWITCH_SCOPES),
    ]))
    .await?;

    // best-effort — if the browser doesn't open, the UI still shows the code + URL to open manually
    let _ = app.opener().open_url(&device.verification_uri, None::<&str>);

    Ok(TwitchDeviceStart {
        user_code: device.user_code,
        verification_uri: device.verification_uri,
        device_code: device.device_code,
        interval: device.interval,
        expires_in: device.expires_in,
    })
}

#[tauri::command]
pub async fn twitch_oauth_device_poll(
    device_code: String,
    interval: u64,
    expires_in: u64,
) -> Result<TwitchBotLogin, String> {
    let client_id = env_var("TWITCH_CLIENT_ID")?;
    let http = reqwest::Client::new();
    let deadline = tokio::time::Instant::now() + Duration::from_secs(expires_in);
    let poll_delay = Duration::from_secs(interval.max(1));

    let token: TwitchTokenResponse = loop {
        if tokio::time::Instant::now() >= deadline {
            return Err("tempo esgotado aguardando autorização".to_string());
        }
        tokio::time::sleep(poll_delay).await;

        let resp = http
            .post("https://id.twitch.tv/oauth2/token")
            .form(&[
                ("client_id", client_id.as_str()),
                ("scopes", TWITCH_SCOPES),
                ("device_code", device_code.as_str()),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = resp.status();
        let body = resp.text().await.map_err(|e| e.to_string())?;

        if status.is_success() {
            break serde_json::from_str(&body).map_err(|e| format!("resposta inesperada ({e}): {body}"))?;
        }
        if !body.contains("authorization_pending") {
            return Err(format!("HTTP {status}: {body}"));
        }
    };

    let users: TwitchUsersResponse = send_and_parse(
        http.get("https://api.twitch.tv/helix/users")
            .header("Client-Id", &client_id)
            .bearer_auth(&token.access_token),
    )
    .await?;

    let username = users
        .data
        .into_iter()
        .next()
        .map(|u| u.login)
        .ok_or_else(|| "não foi possível identificar o usuário do bot".to_string())?;

    Ok(TwitchBotLogin {
        username,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in,
    })
}

#[tauri::command]
pub async fn twitch_oauth_refresh(refresh_token: String) -> Result<RefreshResult, String> {
    let client_id = env_var("TWITCH_CLIENT_ID")?;

    let http = reqwest::Client::new();
    let token: TwitchTokenResponse = send_and_parse(http.post("https://id.twitch.tv/oauth2/token").form(&[
        ("client_id", client_id.as_str()),
        ("refresh_token", refresh_token.as_str()),
        ("grant_type", "refresh_token"),
    ]))
    .await?;

    Ok(RefreshResult {
        access_token: token.access_token,
        refresh_token: Some(token.refresh_token),
        expires_in: token.expires_in,
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KickBotLogin {
    pub username: String,
    pub user_id: u64,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

#[derive(serde::Deserialize)]
struct KickTokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
}

#[derive(serde::Deserialize)]
struct KickUsersResponse {
    data: Vec<KickUserEntry>,
}

#[derive(serde::Deserialize)]
struct KickUserEntry {
    user_id: u64,
    name: String,
}

const KICK_SCOPES: &str = "chat:write channel:read user:read";

#[tauri::command]
pub async fn kick_oauth_login(
    app: tauri::AppHandle,
    state: State<'_, Arc<OverlayState>>,
) -> Result<KickBotLogin, String> {
    let client_id = env_var("KICK_CLIENT_ID")?;
    let client_secret = env_var("KICK_CLIENT_SECRET")?;

    let code_verifier = generate_pkce_verifier();
    let code_challenge = pkce_challenge_s256(&code_verifier);

    let (flow_state, rx) = state.oauth.begin("kick").await;
    let redirect_uri = format!("http://localhost:{}/oauth/kick/callback", state.port);
    let auth_url = format!(
        "https://id.kick.com/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(KICK_SCOPES),
        flow_state,
        code_challenge,
    );

    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| e.to_string())?;

    let code = await_code(rx).await?;

    let http = reqwest::Client::new();
    let token: KickTokenResponse = send_and_parse(http.post("https://id.kick.com/oauth/token").form(&[
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("code", code.as_str()),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri.as_str()),
        ("code_verifier", code_verifier.as_str()),
    ]))
    .await?;

    let users: KickUsersResponse = send_and_parse(
        http.get("https://api.kick.com/public/v1/users")
            .bearer_auth(&token.access_token),
    )
    .await?;

    let user = users
        .data
        .into_iter()
        .next()
        .ok_or_else(|| "não foi possível identificar o usuário do bot".to_string())?;

    Ok(KickBotLogin {
        username: user.name,
        user_id: user.user_id,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in,
    })
}

#[tauri::command]
pub async fn kick_oauth_refresh(refresh_token: String) -> Result<RefreshResult, String> {
    let client_id = env_var("KICK_CLIENT_ID")?;
    let client_secret = env_var("KICK_CLIENT_SECRET")?;

    let http = reqwest::Client::new();
    let token: KickTokenResponse = send_and_parse(http.post("https://id.kick.com/oauth/token").form(&[
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("refresh_token", refresh_token.as_str()),
        ("grant_type", "refresh_token"),
    ]))
    .await?;

    Ok(RefreshResult {
        access_token: token.access_token,
        refresh_token: Some(token.refresh_token),
        expires_in: token.expires_in,
    })
}
