use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};

use crate::oauth::{CallbackParams, OAuthCoordinator};

const LOGO_PNG: &[u8] = include_bytes!("../icons/128x128.png");

pub type OverlayTx = broadcast::Sender<String>;

pub struct OverlayState {
    pub tx: OverlayTx,
    pub last: Mutex<Option<String>>,
    pub port: u16,
    pub oauth: OAuthCoordinator,
}

impl OverlayState {
    pub fn new(tx: OverlayTx, port: u16) -> Arc<Self> {
        Arc::new(Self {
            tx,
            last: Mutex::new(None),
            port,
            oauth: OAuthCoordinator::default(),
        })
    }

    pub async fn broadcast(&self, msg: String) {
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
    Html(overlay_html(state.port))
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

fn oauth_callback_page(ok: bool) -> Html<String> {
    let (title, body) = if ok {
        ("Conectado!", "Pode fechar esta aba e voltar para o SnaitySoft Polls.")
    } else {
        ("Falha na autorização", "Algo deu errado. Volte ao SnaitySoft Polls e tente novamente.")
    };
    Html(format!(
        r#"<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>{title}</title>
        <style>body{{font-family:sans-serif;background:#18181b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}}
        div{{text-align:center}}</style></head>
        <body><div><h2>{title}</h2><p>{body}</p></div></body></html>"#
    ))
}

fn overlay_html(port: u16) -> String {
    let logo_b64 = STANDARD.encode(LOGO_PNG);
    format!(
        r#"<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Poll Overlay</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: transparent; font-family: 'Segoe UI', system-ui, sans-serif; padding: 20px; }}
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
<script>
(function(){{
  var port = {port};
  var ws, retryTimer, stopped = false;
  var liveBadge = document.getElementById('live-badge');

  function connect() {{
    if (stopped) return;
    ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.onopen = function() {{ liveBadge.style.display = 'inline-flex'; }};
    ws.onmessage = function(e) {{
      try {{ render(JSON.parse(e.data)); }} catch(ex) {{}}
    }};
    ws.onclose = function() {{
      liveBadge.style.display = 'none';
      if (!stopped) retryTimer = setTimeout(connect, 2000);
    }};
  }}

  function esc(s) {{
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
    )
}
