use serde_json::Value;

// YouTube's Data API v3 charges quota per liveChatMessages.list call, which exhausts the
// free 10,000/day quota within a couple hours of continuous polling. This module instead
// talks to the same internal ("innertube") endpoint youtube.com's own web player uses to
// render live chat — no API key, no OAuth, no quota, but also undocumented and unsupported:
// it can change or start rejecting requests without notice. Posting messages still goes
// through the official, quota-cheap Data API v3 (see oauth.rs / the frontend's say()).
const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())
}

fn find_between(haystack: &str, prefix: &str) -> Option<String> {
    let start = haystack.find(prefix)? + prefix.len();
    let rest = &haystack[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

/// Users paste whatever the browser gave them — a youtube.com/watch?v=, a youtu.be short
/// link, a /live/ link, or (rarely) just the bare 11-char video ID. Extract the ID from
/// whichever shape shows up, trimming trailing query params like "&feature=share".
fn extract_video_id(input: &str) -> Option<String> {
    let input = input.trim();

    let after_marker = |marker: &str| -> Option<&str> { input.find(marker).map(|i| &input[i + marker.len()..]) };

    let raw = if let Some(rest) = after_marker("watch?v=") {
        rest
    } else if let Some(rest) = after_marker("youtu.be/") {
        rest
    } else if let Some(rest) = after_marker("/live/") {
        rest
    } else if let Some(rest) = after_marker("/embed/") {
        rest
    } else {
        input
    };

    let id: String = raw
        .split(|c| c == '?' || c == '&' || c == '#')
        .next()
        .unwrap_or("")
        .to_string();

    if id.len() >= 10 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        Some(id)
    } else {
        None
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeScrapeStart {
    pub api_key: String,
    pub client_version: String,
    pub continuation: String,
}

#[tauri::command]
pub async fn youtube_scrape_start(live_url: String) -> Result<YoutubeScrapeStart, String> {
    let video_id = extract_video_id(&live_url)
        .ok_or_else(|| "Não consegui reconhecer essa URL/ID de live do YouTube".to_string())?;
    let url = format!("https://www.youtube.com/watch?v={video_id}");
    let http = http_client()?;
    let res = http.get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {} ao buscar a página da live", res.status()));
    }
    let html = res.text().await.map_err(|e| e.to_string())?;

    if html.contains("\"isReplay\":true") {
        return Err("Essa transmissão não está mais ao vivo".to_string());
    }

    let api_key = find_between(&html, "\"INNERTUBE_API_KEY\":\"")
        .ok_or_else(|| "Falha ao ler a página da live (api key)".to_string())?;
    let client_version = find_between(&html, "\"clientVersion\":\"")
        .ok_or_else(|| "Falha ao ler a página da live (clientVersion)".to_string())?;
    let continuation = find_between(&html, "\"continuation\":\"")
        .ok_or_else(|| "Falha ao ler a página da live (continuation)".to_string())?;

    Ok(YoutubeScrapeStart {
        api_key,
        client_version,
        continuation,
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeScrapedMessage {
    pub id: String,
    pub author_name: String,
    pub author_channel_id: String,
    pub text: String,
    pub timestamp_ms: i64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeScrapePoll {
    pub messages: Vec<YoutubeScrapedMessage>,
    pub continuation: String,
}

#[tauri::command]
pub async fn youtube_scrape_poll(
    api_key: String,
    client_version: String,
    continuation: String,
) -> Result<YoutubeScrapePoll, String> {
    let url = format!("https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key={api_key}");
    let http = http_client()?;
    let res = http
        .post(&url)
        .json(&serde_json::json!({
            "context": { "client": { "clientVersion": client_version, "clientName": "WEB" } },
            "continuation": continuation,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP {} do YouTube", res.status()));
    }

    let data: Value = res.json().await.map_err(|e| e.to_string())?;
    let live_chat = &data["continuationContents"]["liveChatContinuation"];

    let mut messages = Vec::new();
    if let Some(actions) = live_chat["actions"].as_array() {
        for action in actions {
            let renderer = &action["addChatItemAction"]["item"]["liveChatTextMessageRenderer"];
            if renderer.is_null() {
                continue; // superchats/memberships/stickers aren't votable text — skip
            }

            let id = renderer["id"].as_str().unwrap_or_default().to_string();
            let author_name = renderer["authorName"]["simpleText"].as_str().unwrap_or_default().to_string();
            let author_channel_id = renderer["authorExternalChannelId"].as_str().unwrap_or_default().to_string();
            let timestamp_ms = renderer["timestampUsec"]
                .as_str()
                .and_then(|s| s.parse::<i64>().ok())
                .map(|us| us / 1000)
                .unwrap_or(0);

            let text = renderer["message"]["runs"]
                .as_array()
                .map(|runs| {
                    runs.iter()
                        .map(|run| {
                            run["text"]
                                .as_str()
                                .or_else(|| run["emoji"]["shortcuts"][0].as_str())
                                .unwrap_or_default()
                        })
                        .collect::<String>()
                })
                .unwrap_or_default();

            if id.is_empty() || text.is_empty() {
                continue;
            }

            messages.push(YoutubeScrapedMessage {
                id,
                author_name,
                author_channel_id,
                text,
                timestamp_ms,
            });
        }
    }

    let continuation_data = &live_chat["continuations"][0];
    let next_continuation = continuation_data["invalidationContinuationData"]["continuation"]
        .as_str()
        .or_else(|| continuation_data["timedContinuationData"]["continuation"].as_str())
        .map(|s| s.to_string())
        .unwrap_or(continuation);

    Ok(YoutubeScrapePoll {
        messages,
        continuation: next_continuation,
    })
}
