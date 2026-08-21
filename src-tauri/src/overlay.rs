use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};

pub type OverlayTx = broadcast::Sender<String>;

pub struct OverlayState {
    pub tx: OverlayTx,
    pub last: Mutex<Option<String>>,
    pub port: u16,
}

impl OverlayState {
    pub fn new(tx: OverlayTx, port: u16) -> Arc<Self> {
        Arc::new(Self {
            tx,
            last: Mutex::new(None),
            port,
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
    let mut rx = state.tx.subscribe();
    let last = state.last.lock().await.clone();
    let (mut sender, mut receiver) = socket.split();

    if let Some(msg) = last {
        if sender.send(Message::Text(msg.into())).await.is_err() {
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
}

fn overlay_html(port: u16) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Poll Overlay</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: transparent; font-family: 'Segoe UI', sans-serif; padding: 16px; }}
  #poll {{ display: none; background: rgba(0,0,0,0.75); border-radius: 16px; padding: 18px 20px; max-width: 420px; backdrop-filter: blur(8px); }}
  #poll.visible {{ display: block; }}
  #question {{ color: #fff; font-size: 15px; font-weight: 700; margin-bottom: 14px; line-height: 1.4; }}
  .opt {{ margin-bottom: 10px; }}
  .opt-header {{ display: flex; justify-content: space-between; margin-bottom: 4px; }}
  .opt-label {{ color: #e4e4e7; font-size: 13px; font-weight: 500; }}
  .opt-count {{ color: #a1a1aa; font-size: 12px; }}
  .bar-bg {{ background: rgba(255,255,255,0.1); border-radius: 99px; height: 10px; overflow: hidden; }}
  .bar {{ height: 100%; border-radius: 99px; background: #6366f1; transition: width 0.4s ease; }}
  .bar.winner {{ background: #818cf8; }}
  #footer {{ margin-top: 10px; display: flex; justify-content: space-between; align-items: center; }}
  #total {{ color: #71717a; font-size: 11px; }}
  #badge {{ font-size: 11px; padding: 2px 8px; border-radius: 99px; background: rgba(255,255,255,0.1); color: #a1a1aa; }}
  #badge.ended {{ background: rgba(99,102,241,0.3); color: #a5b4fc; }}
</style>
</head>
<body>
<div id="poll">
  <div id="question"></div>
  <div id="options"></div>
  <div id="footer">
    <span id="total"></span>
    <span id="badge"></span>
  </div>
</div>
<script>
(function(){{
  var port = {port};
  var ws, retryTimer, stopped = false;

  function connect() {{
    if (stopped) return;
    ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.onmessage = function(e) {{
      try {{ render(JSON.parse(e.data)); }} catch(ex) {{}}
    }};
    ws.onclose = function() {{
      if (!stopped) retryTimer = setTimeout(connect, 2000);
    }};
  }}

  function render(payload) {{
    var d = payload.data;
    if (!d || d.status === 'idle') return;

    var total = d.options.reduce(function(s, o) {{ return s + o.votes; }}, 0);
    var isEnded = d.status === 'ended';
    var winnerVotes = isEnded ? Math.max.apply(null, d.options.map(function(o){{ return o.votes; }})) : -1;

    document.getElementById('question').textContent = d.question;

    var html = '';
    d.options.forEach(function(opt, i) {{
      var pct = total > 0 ? Math.round(opt.votes / total * 100) : 0;
      var isWin = isEnded && opt.votes === winnerVotes && total > 0;
      html += '<div class="opt">'
        + '<div class="opt-header">'
        + '<span class="opt-label">' + (i+1) + '. ' + esc(opt.label) + (isWin ? ' 🏆' : '') + '</span>'
        + '<span class="opt-count">' + opt.votes + ' (' + pct + '%)</span>'
        + '</div>'
        + '<div class="bar-bg"><div class="bar' + (isWin ? ' winner' : '') + '" style="width:' + pct + '%"></div></div>'
        + '</div>';
    }});
    document.getElementById('options').innerHTML = html;

    document.getElementById('total').textContent = total + ' voto' + (total !== 1 ? 's' : '');
    var badge = document.getElementById('badge');
    badge.textContent = isEnded ? 'Encerrada' : 'Ao vivo';
    badge.className = 'badge' + (isEnded ? ' ended' : '');

    document.getElementById('poll').className = 'poll visible';
    document.getElementById('poll').setAttribute('id','poll');
    document.getElementById('poll').style.display = 'block';
  }}

  function esc(s) {{
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }}

  connect();
  window.addEventListener('beforeunload', function() {{ stopped = true; ws && ws.close(); }});
}})();
</script>
</body>
</html>"#,
        port = port
    )
}
