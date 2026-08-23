use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::RngCore;

// Encrypts the bundled .env (app-wide OAuth client IDs/secrets, not per-user data) so a
// release build doesn't ship it as a plain-text file anyone can read straight out of the
// installer. This only raises the bar against casual inspection — the app still needs to
// decrypt these at startup to make OAuth calls, so this key ships in the binary too and
// won't stop a determined reverse-engineer. The real fix for a truly secret client_secret
// is a server-side token-exchange proxy; this is the cheap mitigation instead of that.
//
// The key itself is NOT a literal here — this project is open source, so anything in this
// file is public. build.rs generates it once per checkout into .enc_key (git-ignored) and
// bakes it in via cargo:rustc-env; a hardcoded key in committed source would give a public
// repo's readers the key for free, defeating the point entirely.
const NONCE_LEN: usize = 12;

fn enc_key() -> [u8; 32] {
    // env!() bakes the key straight into the binary as a plain string literal — without
    // obfuscation, `strings` on the compiled .exe would show the raw hex key instantly,
    // no decompiler needed. obfstr keeps it XOR-encoded in the binary and only decodes it
    // onto the stack at call time.
    let hex: String = obfstr::obfstr!(env!(
        "ENV_ENC_KEY_HEX",
        "ENV_ENC_KEY_HEX não definida pelo build.rs — rode `cargo build`"
    ))
    .to_string();
    let mut out = [0u8; 32];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16)
            .expect("ENV_ENC_KEY_HEX inválida (esperado hex de 64 caracteres)");
    }
    out
}

pub fn encrypt(plaintext: &[u8]) -> Vec<u8> {
    let cipher = Aes256Gcm::new_from_slice(&enc_key()).expect("chave de 32 bytes inválida");
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, plaintext).expect("falha ao cifrar .env");

    let mut out = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    out
}

pub fn decrypt(data: &[u8]) -> Result<String, String> {
    if data.len() < NONCE_LEN {
        return Err(".env criptografado inválido (tamanho insuficiente)".to_string());
    }
    let (nonce_bytes, ciphertext) = data.split_at(NONCE_LEN);
    let cipher = Aes256Gcm::new_from_slice(&enc_key()).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "falha ao decifrar .env (chave incompatível ou arquivo corrompido)".to_string())?;
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

/// Parses simple KEY=VALUE lines (same shape as a .env file) and sets each as a process
/// env var, unless it's already set — mirrors dotenvy's own "never overwrite" behavior so
/// this is a drop-in replacement for the plain-text `dotenvy::from_path` call it retired.
pub fn apply_env_str(content: &str) {
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        if std::env::var(key).is_err() {
            std::env::set_var(key, value.trim());
        }
    }
}
