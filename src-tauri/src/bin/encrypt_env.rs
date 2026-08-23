// Run this before building a release: `cargo run --bin encrypt_env`
// Reads src-tauri/.env (plain text, git-ignored) and writes src-tauri/.env.enc — the
// encrypted file that actually gets bundled as a resource (see tauri.conf.json). Re-run
// it any time .env changes; .env.enc is git-ignored too and gets regenerated locally.
use app_lib::env_crypto;

fn main() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let src = std::path::Path::new(manifest_dir).join(".env");
    let dest = std::path::Path::new(manifest_dir).join(".env.enc");

    let plaintext = std::fs::read(&src).unwrap_or_else(|e| {
        eprintln!("Falha ao ler {}: {e}", src.display());
        std::process::exit(1);
    });

    let encrypted = env_crypto::encrypt(&plaintext);

    std::fs::write(&dest, &encrypted).unwrap_or_else(|e| {
        eprintln!("Falha ao escrever {}: {e}", dest.display());
        std::process::exit(1);
    });

    println!("OK: {} -> {}", src.display(), dest.display());
}
