use std::path::Path;

fn main() {
    // Encryption key for the bundled .env.enc (see src/env_crypto.rs). This must never be a
    // literal in source — the project is open source, so anything committed is public. It's
    // generated once per checkout into .enc_key (git-ignored, same treatment as .env) and
    // baked into the binary at compile time via cargo:rustc-env, picked up by env!() in
    // env_crypto.rs. Re-running `cargo run --bin encrypt_env` after key generation keeps
    // .env.enc in sync — it always encrypts with whatever key this build sees.
    let key_path = Path::new(env!("CARGO_MANIFEST_DIR")).join(".enc_key");

    if !key_path.exists() {
        use rand::RngCore;
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        let hex: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
        std::fs::write(&key_path, &hex).expect("failed to write .enc_key");
    }

    let hex = std::fs::read_to_string(&key_path).expect("failed to read .enc_key");
    println!("cargo:rustc-env=ENV_ENC_KEY_HEX={}", hex.trim());
    println!("cargo:rerun-if-changed={}", key_path.display());

    tauri_build::build()
}
