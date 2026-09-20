use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::header,
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};

use crate::oauth::{CallbackParams, OAuthCoordinator};

const LOGO_PNG: &[u8] = include_bytes!("../icons/128x128.png");
// AIFF (the file this was dropped in as) isn't reliably decodable by Chromium on Windows — the
// exact engine both WebView2 (dashboard) and OBS's CEF (overlay) are built on — so it's converted
// to MP3 up front (see src-tauri/sounds/) rather than shipping the original and hoping playback
// works.
const ROULETTE_WINNER_SOUND: &[u8] = include_bytes!("../sounds/roulette-winner.mp3");
// Plays while the wheel is spinning, cut off as soon as the winner reveal fires — it's longer
// than any SPIN_DURATION_OPTIONS value (engine.ts), so it never plays to completion by design.
const ROULETTE_SPIN_SOUND: &[u8] = include_bytes!("../sounds/roulette-spin.mp3");

pub type OverlayTx = broadcast::Sender<String>;

pub struct OverlayState {
    pub tx: OverlayTx,
    pub last: Mutex<Option<String>>,
    pub port: u16,
    pub oauth: OAuthCoordinator,
    last_seq: AtomicU64,
}

impl OverlayState {
    pub fn new(tx: OverlayTx, port: u16) -> Arc<Self> {
        Arc::new(Self {
            tx,
            last: Mutex::new(None),
            port,
            oauth: OAuthCoordinator::default(),
            last_seq: AtomicU64::new(0),
        })
    }

    // Every browser-side broadcast is its own fire-and-forget `invoke` call (see
    // src/lib/roulette/overlay.ts and usePollStore.ts) — nothing awaits the previous one before
    // starting the next. Several issued in quick succession (e.g. one component's unmount
    // "cleared" racing the next component's mount "preview" on a section/mode switch) can have
    // their async IPC round-trips land here out of order, leaving a stale message as the cached
    // `last` state a newly connecting OBS browser source gets replayed. Each payload carries a
    // monotonically increasing `seq` (src/lib/overlaySeq.ts); dropping anything that doesn't
    // strictly advance it makes the outcome depend on send order, not arrival order. A payload
    // with no parseable `seq` (a malformed or future non-JS caller) is always accepted.
    pub async fn broadcast(&self, msg: String) {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&msg) {
            if let Some(seq) = value.get("seq").and_then(|v| v.as_u64()) {
                let prev = self.last_seq.fetch_max(seq, Ordering::SeqCst);
                if seq <= prev {
                    log::info!("[overlay] dropping out-of-order broadcast (seq {seq} <= {prev})");
                    return;
                }
            }
        }
        *self.last.lock().await = Some(msg.clone());
        let _ = self.tx.send(msg);
    }
}

pub fn create_overlay_channel() -> (OverlayTx, broadcast::Receiver<String>) {
    broadcast::channel(32)
}

pub async fn start_overlay_server(state: Arc<OverlayState>) {
    let app = Router::new()
        .route("/", get(html_handler))
        .route("/ws", get(ws_handler))
        .route("/oauth/kick/callback", get(kick_oauth_callback))
        .with_state(Arc::clone(&state));

    let addr = format!("0.0.0.0:{}", state.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| panic!("Failed to bind overlay server on {addr}: {e}"));

    log::info!("Overlay server listening on {addr}");
    axum::serve(listener, app).await.expect("Overlay server error");
}

async fn html_handler(State(state): State<Arc<OverlayState>>) -> impl IntoResponse {
    // This page is regenerated (and its embedded JS changes) on every app update, but OBS's
    // Browser Source is backed by CEF, which — with no cache-control header telling it not to —
    // has repeatedly been observed serving a stale cached copy after a rebuild, silently running
    // old animation/rendering logic. no-store makes every load (including OBS's periodic
    // "Refresh cache of current page") fetch the current version instead of a stale one.
    (
        [(header::CACHE_CONTROL, "no-store, no-cache, must-revalidate")],
        Html(overlay_html(state.port)),
    )
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<OverlayState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: Arc<OverlayState>) {
    log::info!("[overlay] OBS/browser source conectado ao WebSocket");
    let mut rx = state.tx.subscribe();
    let last = state.last.lock().await.clone();
    let (mut sender, mut receiver) = socket.split();

    if let Some(msg) = last {
        if sender.send(Message::Text(msg.into())).await.is_err() {
            log::info!("[overlay] conexão encerrada ao enviar estado inicial");
            return;
        }
    }

    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = receiver.next().await {
        if matches!(msg, Message::Close(_)) {
            break;
        }
    }

    send_task.abort();
    log::info!("[overlay] OBS/browser source desconectado do WebSocket");
}

async fn kick_oauth_callback(
    State(state): State<Arc<OverlayState>>,
    Query(params): Query<CallbackParams>,
) -> impl IntoResponse {
    let ok = state.oauth.resolve("kick", params).await;
    oauth_callback_page(ok)
}

// This renders in the system browser (not the app's webview) after the OAuth redirect
// completes, so it has no access to the app's Settings.locale — plumbing that through would
// need shared state synced from the frontend for a page the user sees once per login. Shown
// bilingually instead, which is simpler and correct regardless of the app's language.
fn oauth_callback_page(ok: bool) -> Html<String> {
    let (title, body) = if ok {
        ("Conectado! / Connected!", "Pode fechar esta aba e voltar para o SnaitySoft Polls.<br/>You can close this tab and go back to SnaitySoft Polls.")
    } else {
        (
            "Falha na autorização / Authorization failed",
            "Algo deu errado. Volte ao SnaitySoft Polls e tente novamente.<br/>Something went wrong. Go back to SnaitySoft Polls and try again.",
        )
    };
    Html(format!(
        r#"<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>{title}</title>
        <style>body{{font-family:sans-serif;background:#18181b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}}
        div{{text-align:center}}</style></head>
        <body><div><h2>{title}</h2><p>{body}</p></div></body></html>"#
    ))
}

fn overlay_html(port: u16) -> String {
    let logo_b64 = STANDARD.encode(LOGO_PNG);
    let winner_sound_b64 = STANDARD.encode(ROULETTE_WINNER_SOUND);
    let spin_sound_b64 = STANDARD.encode(ROULETTE_SPIN_SOUND);
    format!(
        r#"<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Poll Overlay</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  /* Sized and centered for a full 1920x1080 Browser Source (the OBS standard) — set the source
     to that resolution and the poll/roulette lands centered in it, ready to reposition or scale
     as one unit in the scene, instead of being pinned to the top-left corner of whatever
     smaller canvas the source happened to be cropped to. */
  html, body {{ width: 100%; height: 100%; }}
  body {{
    background: transparent; font-family: 'Segoe UI', system-ui, sans-serif;
    display: flex; align-items: center; justify-content: center;
  }}
  #poll {{
    display: none;
    position: relative;
    background: linear-gradient(160deg, rgba(15,9,35,0.97) 0%, rgba(28,13,54,0.97) 55%, rgba(19,10,40,0.97) 100%);
    border: 1px solid rgba(139,92,246,0.35);
    border-radius: 20px;
    padding: 22px 26px;
    max-width: 640px;
    box-shadow: 0 0 0 1px rgba(139,92,246,0.12), 0 25px 60px rgba(76,29,149,0.35), 0 0 40px rgba(99,102,241,0.15);
    backdrop-filter: blur(10px);
  }}
  #poll.visible {{ display: block; }}

  .header {{ display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }}
  .logo {{ width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0; box-shadow: 0 4px 14px rgba(99,102,241,0.4); }}
  .titleblock {{ flex: 1; min-width: 0; }}
  .badge-poll {{
    display: inline-flex; align-items: center; gap: 5px;
    background: linear-gradient(90deg,#6366f1,#a855f7);
    color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 0.06em;
    padding: 3px 9px; border-radius: 999px; text-transform: uppercase;
    margin-bottom: 6px;
  }}
  #question {{
    color: #fff; font-size: 24px; font-weight: 800; line-height: 1.15;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }}
  .badge-live {{
    display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
    background: rgba(239,68,68,0.16); border: 1px solid rgba(239,68,68,0.45);
    color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.04em;
    padding: 6px 12px; border-radius: 999px; text-transform: uppercase;
  }}
  .badge-live .dot {{
    width: 7px; height: 7px; border-radius: 50%; background: #ef4444;
    box-shadow: 0 0 6px #ef4444;
    animation: pulse 1.4s ease-in-out infinite;
  }}
  @keyframes pulse {{ 0%,100% {{ opacity: 1; }} 50% {{ opacity: 0.35; }} }}

  #options {{ display: flex; flex-direction: column; gap: 12px; }}
  .opt {{ display: flex; align-items: center; gap: 10px; }}
  .opt-num {{
    width: 30px; height: 30px; flex-shrink: 0; border-radius: 9px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
    color: #fff; font-weight: 800; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
  }}
  .opt-body {{ flex: 1; min-width: 0; }}
  .opt-row {{ display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 5px; }}
  .opt-label {{ display: flex; align-items: center; gap: 6px; color: #e4e4e7; font-size: 14px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
  .opt-count {{ color: #fff; font-size: 14px; font-weight: 700; flex-shrink: 0; white-space: nowrap; }}
  .bar-bg {{ background: rgba(255,255,255,0.07); border-radius: 999px; height: 9px; overflow: hidden; }}
  .bar {{ height: 100%; border-radius: 999px; background: rgba(255,255,255,0.18); transition: width 0.5s ease; }}
  .bar.winner {{ background: linear-gradient(90deg, #38bdf8, #a855f7, #ec4899); }}

  .footer {{ display: flex; justify-content: space-between; align-items: center; margin-top: 18px; }}
  .votes {{ display: flex; align-items: center; gap: 6px; color: #a1a1aa; font-size: 12px; font-weight: 600; }}
  .badge-status {{
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 700; padding: 5px 11px; border-radius: 999px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #d4d4d8;
  }}
  .badge-status.active {{ background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.4); color: #c7d2fe; }}

  #roulette {{
    display: none;
    position: relative;
    /* No fixed width: .wheel-wrap is sized dynamically from the actual OBS canvas (often much
       bigger than any width fixed here would allow), and its own `margin: 0 auto` centering only
       works if this parent is at least as wide as it — a smaller fixed parent made the wheel
       overflow flush-left instead of centered, since auto-margins collapse to 0 on overflow. */
    text-align: center;
  }}
  #roulette.visible {{ display: block; }}
  .wheel-wrap {{ position: relative; width: 240px; height: 240px; margin: 0 auto 16px; }}
  .wheel-pointer {{
    position: absolute; top: -15px; left: 50%; transform: translateX(-50%); z-index: 2;
    width: 26px; height: 22px; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.5));
  }}
  .wheel-disc {{
    position: relative; overflow: hidden;
    width: 240px; height: 240px; border-radius: 50%;
    border: 8px solid #14121f; box-shadow: 0 0 0 2px rgba(167,139,250,0.55), 0 10px 30px rgba(0,0,0,0.5);
  }}
  .seg-label {{
    position: absolute; top: 50%; left: 50%; height: 0;
    display: flex; align-items: center; pointer-events: none;
    transform-origin: 0 0; padding-left: 28px;
  }}
  .seg-label span {{
    display: inline-block; max-width: 84px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: #fff; font-weight: 800; font-size: 12px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.65), 0 0 3px rgba(0,0,0,0.45);
  }}
  .wheel-hub {{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }}
  .wheel-hub span {{
    width: 46px; height: 46px; border-radius: 50%; background: #14121f;
    border: 3px solid #a78bfa; box-shadow: 0 0 10px rgba(167,139,250,0.5);
  }}
  .roulette-pill {{
    display: inline-flex; align-items: center; gap: 7px;
    background: #14121f; border: 1.5px solid rgba(167,139,250,0.5);
    color: #e9d5ff; font-size: 12px; font-weight: 700;
    padding: 7px 16px; border-radius: 999px;
  }}
  /* --rw-scale is set from JS as wheelPx/240 so the result card (crown/text/padding/border)
     grows and shrinks together with however big the wheel itself ends up rendering — including
     when the wheel is sized from the OBS canvas's own dimensions rather than a fixed px value.
     --rw-scale-sqrt grows slower — used only for the winner name — so a long name doesn't
     truncate more aggressively on a huge wheel than it would have on a small one. */
  #roulette-winner {{
    --rw-scale: 1;
    --rw-scale-sqrt: 1;
    display: none;
    position: absolute;
    top: 50%; left: 50%;
    z-index: 10;
    width: max-content;
    max-width: 135%;
    min-width: 50%;
    background: #14121f;
    border: calc(2px * var(--rw-scale)) solid #a78bfa;
    clip-path: polygon(
      14px 0, calc(100% - 14px) 0, 100% 14px,
      100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%,
      0 calc(100% - 14px), 0 14px
    );
    padding: calc(16px * var(--rw-scale)) calc(22px * var(--rw-scale));
    text-align: center;
  }}
  /* The reveal pop and the glow pulse are two separate animations on the same element: pop runs
     once (its final keyframe holds the resting transform via "forwards"), glow loops forever
     while visible. Both restart cleanly each spin because display:none fully unmounts them. */
  #roulette-winner.visible {{
    display: block;
    animation: rw-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both, rw-glow 1.8s ease-in-out 0.5s infinite;
  }}
  @keyframes rw-pop {{
    0% {{ transform: translate(-50%, -50%) scale(0.4); opacity: 0; }}
    100% {{ transform: translate(-50%, -50%) scale(1); opacity: 1; }}
  }}
  @keyframes rw-glow {{
    0%, 100% {{ box-shadow: 0 0 calc(20px * var(--rw-scale)) rgba(167,139,250,0.35); }}
    50% {{ box-shadow: 0 0 calc(46px * var(--rw-scale)) rgba(167,139,250,0.75); }}
  }}
  #roulette-winner .crown {{
    font-size: calc(20px * var(--rw-scale)); margin-bottom: calc(2px * var(--rw-scale));
    display: inline-block; animation: rw-crown-bounce 1.1s ease-in-out 0.5s infinite;
  }}
  @keyframes rw-crown-bounce {{
    0%, 100% {{ transform: translateY(0) rotate(0deg); }}
    50% {{ transform: translateY(-15%) rotate(-6deg); }}
  }}
  #roulette-winner .tag {{
    color: #c4b5fd; font-size: calc(11px * var(--rw-scale)); text-transform: uppercase; letter-spacing: 0.12em;
    font-weight: 800; margin-bottom: calc(6px * var(--rw-scale));
  }}
  #roulette-winner .label-row {{
    display: flex; align-items: center; justify-content: center; gap: calc(10px * var(--rw-scale));
  }}
  #roulette-winner .label {{
    color: #fff; font-size: calc(22px * var(--rw-scale-sqrt)); font-weight: 800; line-height: 1.2;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1 1 auto;
  }}
  #roulette-winner .chevron {{
    color: #a78bfa; font-size: calc(16px * var(--rw-scale)); font-weight: 800; flex-shrink: 0;
  }}
  .confetti-piece {{
    position: absolute; top: 50%; left: 50%; width: 8px; height: 14px;
    z-index: 11; pointer-events: none; opacity: 1;
    animation: confetti-burst 1.3s cubic-bezier(0.15, 0.7, 0.3, 1) forwards;
  }}
  @keyframes confetti-burst {{
    0% {{ transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }}
    100% {{ transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.5); opacity: 0; }}
  }}
</style>
</head>
<body>
<div id="poll">
  <div class="header">
    <img class="logo" src="data:image/png;base64,{logo_b64}" alt="" />
    <div class="titleblock">
      <span class="badge-poll">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 16V10"/><path d="M12 16V6"/><path d="M17 16v-4"/></svg>
        Poll
      </span>
      <div id="question"></div>
    </div>
    <span id="live-badge" class="badge-live" style="display:none">
      <span class="dot"></span>
      Ao vivo
    </span>
  </div>

  <div id="options"></div>

  <div class="footer">
    <span class="votes">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <span id="total"></span>
    </span>
    <span id="status-badge" class="badge-status"></span>
  </div>
</div>

<div id="roulette">
  <div class="wheel-wrap" id="wheel-wrap">
    <svg class="wheel-pointer" id="wheel-pointer" viewBox="0 0 26 22" fill="none">
      <path d="M13 21 L2 2 L24 2 Z" stroke='#a78bfa' stroke-width="2.5" stroke-linejoin="round" fill='#170f2e'/>
    </svg>
    <div class="wheel-disc" id="wheel-disc"></div>
    <div class="wheel-hub"><span id="wheel-hub-inner"></span></div>
    <div id="roulette-winner">
      <div class="crown">&#128081;</div>
      <div class="tag">Resultado</div>
      <div class="label-row">
        <span class="chevron">&#10095;</span>
        <span class="label" id="roulette-winner-label"></span>
        <span class="chevron" style="transform:scaleX(-1)">&#10095;</span>
      </div>
    </div>
  </div>
  <div class="roulette-pill" id="roulette-count">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    <span id="roulette-count-text"></span>
  </div>
</div>
<script>
(function(){{
  var port = {port};
  var ws, retryTimer, stopped = false;
  var liveBadge = document.getElementById('live-badge');
  var WHEEL_COLORS = ['#3987e5','#d95926','#199e70','#c98500','#d55181','#008300','#9085e9','#e66767','#17a2b8','#eab308','#a16207','#64748b'];
  var roulette = {{ lastSpinId: 0, soundEnabled: true, soundVolume: 0.7 }};
  // ?view=poll or ?view=roulette lets each OBS Browser Source subscribe to just one panel —
  // add one Browser Source per URL to place/size the poll and the roulette independently.
  // No param (or any other value) keeps the combined behavior: whichever was broadcast last.
  var view = new URLSearchParams(location.search).get('view');

  function connect() {{
    if (stopped) return;
    ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.onopen = function() {{ liveBadge.style.display = 'inline-flex'; }};
    ws.onmessage = function(e) {{
      try {{
        var payload = JSON.parse(e.data);
        var isRoulette = payload.type === 'roulette_spin' || payload.type === 'roulette_cleared';
        if (view === 'poll' && isRoulette) return;
        if (view === 'roulette' && !isRoulette) return;

        if (payload.type === 'roulette_spin') {{
          document.getElementById('poll').classList.remove('visible');
          renderRoulette(payload.data);
        }} else if (payload.type === 'roulette_cleared') {{
          stopSpinSound();
          document.getElementById('roulette').classList.remove('visible');
        }} else {{
          document.getElementById('roulette').classList.remove('visible');
          render(payload);
        }}
      }} catch(ex) {{}}
    }};
    ws.onclose = function() {{
      liveBadge.style.display = 'none';
      if (!stopped) retryTimer = setTimeout(connect, 2000);
    }};
  }}

  // Mirrors the dashboard's RouletteWheel.tsx animation math exactly (same segment layout,
  // same pointer-at-12-o'clock convention, same spinId-derived extra-turns) so the OBS overlay
  // spins in visual lockstep with what the streamer sees on their own screen.
  function renderRoulette(d) {{
    // The wheel is sized off the actual OBS canvas (window.innerHeight/innerWidth for this
    // Browser Source), not a fixed pixel base — a fixed base always looks tiny on a real
    // 1920x1080 source no matter what multiplier "Tamanho da roda" applies. "Padrão" fills
    // about half the shorter viewport dimension, "Enorme" about three quarters; hub/pointer/
    // label metrics all derive from the resulting wheelPx (not the raw scale) so they keep the
    // same proportions as the 240px-base design at any size.
    // Carried on every payload (see RouletteSpinOptions in src/lib/roulette/overlay.ts) so
    // playSpinSound/playWinSound — fired later from their own timers, not from here — always use
    // whatever the streamer last set in "Personalizar roleta" rather than a stale value.
    roulette.soundEnabled = d.soundEnabled !== false;
    roulette.soundVolume = (typeof d.soundVolume === 'number' ? d.soundVolume : 70) / 100;

    var scale = (typeof d.scale === 'number' && d.scale > 0) ? d.scale : 1;
    var viewportBasis = Math.min(window.innerHeight, window.innerWidth);
    var wheelPx = Math.round(Math.min(viewportBasis * 0.95, viewportBasis * 0.5 * scale));
    var hubPx = Math.round(wheelPx * (46 / 240));
    var wrap = document.getElementById('wheel-wrap');
    wrap.style.width = wheelPx + 'px';
    wrap.style.height = wheelPx + 'px';
    var pointer = document.getElementById('wheel-pointer');
    pointer.style.top = -Math.round(wheelPx * (15 / 240)) + 'px';
    pointer.style.width = Math.round(wheelPx * (26 / 240)) + 'px';
    pointer.style.height = Math.round(wheelPx * (22 / 240)) + 'px';
    document.getElementById('wheel-hub-inner').style.width = hubPx + 'px';
    document.getElementById('wheel-hub-inner').style.height = hubPx + 'px';
    var rwWinner = document.getElementById('roulette-winner');
    rwWinner.style.setProperty('--rw-scale', wheelPx / 240);
    rwWinner.style.setProperty('--rw-scale-sqrt', Math.sqrt(wheelPx / 240));

    var entries = d.entries || [];
    var total = 0;
    for (var i = 0; i < entries.length; i++) {{ total += entries[i].weight; }}
    if (total <= 0) total = 1;

    var wheelColors = (d.colors && d.colors.length) ? d.colors : WHEEL_COLORS;
    var acc = 0, stops = [], segments = {{}};
    entries.forEach(function(entry, i) {{
      var start = acc / total * 360;
      acc += entry.weight;
      var end = acc / total * 360;
      var color = wheelColors[i % wheelColors.length];
      stops.push(color + ' ' + start + 'deg ' + end + 'deg');
      segments[entry.id] = {{ start: start, end: end, label: entry.label }};
    }});

    var disc = document.getElementById('wheel-disc');
    disc.style.width = wheelPx + 'px';
    disc.style.height = wheelPx + 'px';
    disc.style.background = stops.length ? 'conic-gradient(' + stops.join(', ') + ')' : '#27272a';

    // Text on every slice, no matter how many entries — same reasoning as RouletteWheel.tsx:
    // width is sized from actual available radius (not a flat scale multiply) so a bigger wheel
    // fits meaningfully longer names, and font size also shrinks with entry count (not just
    // wheel scale) since at N entries a slice is only 360/N degrees wide, i.e. roughly
    // (2*pi*radius/N)px of arc at the label's radius — text taller than that visibly bleeds into
    // the neighboring slice's color. The 0.62 factor leaves clearance for line-height/AA rather
    // than sizing text to the exact geometric limit.
    var labelsHtml = '';
    if (d.showLabels !== false && entries.length > 0) {{
      var labelPad = Math.round(hubPx / 2 + 4);
      var labelMaxWidth = Math.max(40, Math.round(wheelPx / 2 - 5 - labelPad - 6));
      var midRadius = labelPad + labelMaxWidth / 2;
      var arcBoundFont = (2 * Math.PI * midRadius * 0.62) / entries.length;
      var labelFont = Math.max(5, Math.min(Math.round(12 * Math.sqrt(scale)), Math.round(arcBoundFont)));
      entries.forEach(function(entry) {{
        var seg = segments[entry.id];
        var mid = (seg.start + seg.end) / 2;
        var wrapperRotation = mid - 90;
        // Same fix as the dashboard's RouletteWheel.tsx: nothing counter-rotates the label
        // glyphs, so the left half of the wheel would render them upside down without this
        // extra 180deg turn on just the span (which flips it in place, not its position).
        var normalized = ((wrapperRotation % 360) + 360) % 360;
        var needsFlip = normalized > 90 && normalized < 270;
        var spanTransform = needsFlip ? 'transform:rotate(180deg);' : '';
        // The hub-clearance gap (padding-left) lives on this wrapper div, not the span — a
        // span rotating 180deg around its own center only stays in place when that center IS
        // the visual text's center, which padding on the span itself would throw off.
        labelsHtml += '<div class="seg-label" style="transform:rotate(' + wrapperRotation + 'deg);padding-left:' + labelPad + 'px;">'
          + '<span style="max-width:' + labelMaxWidth + 'px;font-size:' + labelFont + 'px;' + spanTransform + '">'
          + esc(entry.label) + '</span></div>';
      }});
    }}
    disc.innerHTML = labelsHtml;

    document.getElementById('roulette-winner').classList.remove('visible');
    document.getElementById('roulette-count-text').textContent =
      entries.length + ' participante' + (entries.length !== 1 ? 's' : '');
    // spinId 0 means this is just a live "who/what's in the running" preview (see
    // broadcastRoulettePreview in src/lib/roulette/overlay.ts) — the wheel spinning is its own
    // "in progress" indicator, so the count pill only shows before that, and only for the
    // chat-keyword draw (real viewers "participating") — the plain list draw sends
    // showParticipantCount:false since its entries are just items.
    var showCount = d.spinId === 0 && d.showParticipantCount === true;
    document.getElementById('roulette-count').style.display = showCount ? 'inline-flex' : 'none';

    if (d.spinId !== roulette.lastSpinId) {{
      roulette.lastSpinId = d.spinId;
      var target = segments[d.winnerId];
      if (target) {{
        var midAngle = (target.start + target.end) / 2;
        // Mirrors RouletteWheel.tsx's identical fix: scaled by durationMs (relative to the 5s
        // default) so "Longo" actually spins more instead of the same rotation in slow motion.
        var extraSpins = Math.round((5 + (d.spinId % 3)) * (d.durationMs / 5000));
        var delta = (((360 - midAngle) % 360) + 360) % 360;
        var finalRotation = delta + extraSpins * 360;

        // Snap back to a fixed 0deg baseline before animating, rather than continuing from
        // wherever the wheel last stopped. The dashboard (RouletteWheel.tsx) runs the identical
        // sequence from the identical baseline, so the two land on the same rotation distance
        // every time — accumulating from each side's own history is what let them drift apart.
        disc.style.transition = 'none';
        disc.style.transform = 'rotate(0deg)';
        void disc.offsetHeight;
        disc.style.transition = 'transform ' + d.durationMs + 'ms cubic-bezier(0.15, 0.65, 0.15, 1)';
        disc.style.transform = 'rotate(' + finalRotation + 'deg)';
        playSpinSound();

        setTimeout(function() {{
          stopSpinSound();
          document.getElementById('roulette-count').style.display = 'none';
          document.getElementById('roulette-winner-label').textContent = target.label;
          document.getElementById('roulette-winner').classList.add('visible');
          burstConfetti(wrap);
          playWinSound();
        }}, d.durationMs + 100);
      }}
    }}

    document.getElementById('roulette').classList.add('visible');
  }}

  function esc(s) {{
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }}

  var CONFETTI_COLORS = ['#f472b6','#facc15','#4ade80','#60a5fa','#a78bfa','#fb923c','#f87171'];

  // Bursts small colored pieces outward from the winner card's center, each with a randomized
  // angle/distance/spin driven entirely by the confetti-burst keyframe via CSS custom
  // properties — cheap to spawn a few dozen of and they clean themselves up after the animation.
  function burstConfetti(container) {{
    for (var i = 0; i < 40; i++) {{
      var angle = Math.random() * Math.PI * 2;
      var dist = 90 + Math.random() * 200;
      var dx = Math.cos(angle) * dist;
      var dy = Math.sin(angle) * dist - 60;
      var piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.setProperty('--dx', dx.toFixed(0) + 'px');
      piece.style.setProperty('--dy', dy.toFixed(0) + 'px');
      piece.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
      container.appendChild(piece);
      (function(p) {{ setTimeout(function() {{ p.remove(); }}, 1600); }})(piece);
    }}
  }}

  // Embedded as a data URI (see ROULETTE_WINNER_SOUND in overlay.rs) so there's nothing to fetch
  // over the network — a game-show winner bell, converted to MP3 since the original AIFF isn't
  // reliably decodable by Chromium on Windows (what both WebView2 and OBS's CEF are built on).
  var WINNER_SOUND_SRC = 'data:audio/mpeg;base64,{winner_sound_b64}';
  // Same embedding approach, played for the duration of the spin itself and cut off the instant
  // the winner reveal fires (see spinSound.currentAudio below) — it's longer than any spin
  // duration, so it's always interrupted rather than played to completion.
  var SPIN_SOUND_SRC = 'data:audio/mpeg;base64,{spin_sound_b64}';
  var spinSound = {{ currentAudio: null }};

  // Browsers/OBS's embedded CEF can block audio until a user gesture; this is best-effort and
  // silently no-ops if playback is rejected.
  function playWinSound() {{
    if (!roulette.soundEnabled) return;
    try {{
      var audio = new Audio(WINNER_SOUND_SRC);
      audio.volume = roulette.soundVolume;
      var p = audio.play();
      if (p && p.catch) p.catch(function() {{}});
    }} catch (ex) {{}}
  }}

  function playSpinSound() {{
    stopSpinSound();
    if (!roulette.soundEnabled) return;
    try {{
      var audio = new Audio(SPIN_SOUND_SRC);
      audio.volume = roulette.soundVolume;
      spinSound.currentAudio = audio;
      var p = audio.play();
      if (p && p.catch) p.catch(function() {{}});
    }} catch (ex) {{}}
  }}

  function stopSpinSound() {{
    var audio = spinSound.currentAudio;
    if (!audio) return;
    try {{ audio.pause(); }} catch (ex) {{}}
    spinSound.currentAudio = null;
  }}

  function render(payload) {{
    var d = payload.data;
    if (!d || d.status === 'idle') {{
      document.getElementById('poll').classList.remove('visible');
      return;
    }}

    var total = d.options.reduce(function(s, o) {{ return s + o.votes; }}, 0);
    var isEnded = d.status === 'ended';
    var winnerVotes = isEnded ? Math.max.apply(null, d.options.map(function(o){{ return o.votes; }})) : -1;

    document.getElementById('question').textContent = d.question;

    var html = '';
    d.options.forEach(function(opt, i) {{
      var pct = total > 0 ? Math.round(opt.votes / total * 100) : 0;
      var isWin = isEnded && opt.votes === winnerVotes && total > 0;
      html += '<div class="opt">'
        + '<div class="opt-num">' + (i+1) + '</div>'
        + '<div class="opt-body">'
        + '<div class="opt-row">'
        + '<span class="opt-label">' + (isWin ? '🏆 ' : '') + esc(opt.label) + '</span>'
        + '<span class="opt-count">' + opt.votes + ' (' + pct + '%)</span>'
        + '</div>'
        + '<div class="bar-bg"><div class="bar' + (isWin ? ' winner' : '') + '" style="width:' + pct + '%"></div></div>'
        + '</div>'
        + '</div>';
    }});
    document.getElementById('options').innerHTML = html;

    document.getElementById('total').textContent = total + ' voto' + (total !== 1 ? 's' : '');

    var statusBadge = document.getElementById('status-badge');
    if (isEnded) {{
      statusBadge.className = 'badge-status';
      statusBadge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg> Encerrada';
    }} else {{
      statusBadge.className = 'badge-status active';
      statusBadge.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#818cf8;display:inline-block;"></span> Ativa';
    }}

    document.getElementById('poll').classList.add('visible');
  }}

  connect();
  window.addEventListener('beforeunload', function() {{ stopped = true; ws && ws.close(); }});
}})();
</script>
</body>
</html>"#,
        port = port,
        logo_b64 = logo_b64,
        winner_sound_b64 = winner_sound_b64,
        spin_sound_b64 = spin_sound_b64,
    )
}
