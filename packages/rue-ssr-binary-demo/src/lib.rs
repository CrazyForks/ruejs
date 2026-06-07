use axum::Router;
use axum::body::Body;
use axum::extract::{Json, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use deno_core::{JsRuntime, RuntimeOptions, resolve_url, v8};
use serde::{Deserialize, Serialize};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub fn run_server_cli() -> Result<(), Box<dyn std::error::Error>> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let html = render_rue_ssr()?;

    if args.iter().any(|arg| arg == "--render-only") {
        println!("{html}");
        return Ok(());
    }

    serve(html, ServerConfig::from_args(&args)?)
}

pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

impl ServerConfig {
    pub fn from_args(args: &[String]) -> Result<Self, Box<dyn std::error::Error>> {
        let mut host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let mut port = match std::env::var("PORT") {
            Ok(value) => parse_port(&value, "PORT")?,
            Err(_) => 8787,
        };
        let mut index = 0;

        while index < args.len() {
            let arg = &args[index];
            if arg == "--host" {
                index += 1;
                host = args
                    .get(index)
                    .ok_or_else(|| invalid_input("--host needs a value"))?
                    .to_string();
            } else if let Some(value) = arg.strip_prefix("--host=") {
                host = value.to_string();
            } else if arg == "--port" {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| invalid_input("--port needs a value"))?;
                port = parse_port(value, "--port")?;
            } else if let Some(value) = arg.strip_prefix("--port=") {
                port = parse_port(value, "--port")?;
            }
            index += 1;
        }

        Ok(Self { host, port })
    }
}

fn parse_port(value: &str, source: &str) -> Result<u16, Box<dyn std::error::Error>> {
    value
        .parse::<u16>()
        .map_err(|_| invalid_input(format!("{source} must be a valid TCP port: {value}")).into())
}

fn invalid_input(message: impl Into<String>) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidInput, message.into())
}

pub fn render_rue_ssr() -> Result<String, Box<dyn std::error::Error>> {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?
        .block_on(render_rue_ssr_inner())
}

async fn render_rue_ssr_inner() -> Result<String, Box<dyn std::error::Error>> {
    let bundled_ssr_entry = include_str!(concat!(env!("OUT_DIR"), "/ssr-entry.js"));
    let mut runtime = JsRuntime::new(RuntimeOptions::default());

    install_host_polyfills(&mut runtime)?;

    let specifier = resolve_url("file:///rue-ssr-entry.js")?;
    let module_id = runtime
        .load_main_es_module_from_code(&specifier, bundled_ssr_entry.to_string())
        .await?;
    let result = runtime.mod_evaluate(module_id);
    runtime.run_event_loop(Default::default()).await?;
    result.await?;

    let rendered = runtime.execute_script("read-rue-ssr-html.js", "globalThis.__RUE_SSR_HTML")?;
    deno_core::scope!(scope, runtime);
    let rendered = v8::Local::new(scope, rendered);

    if !rendered.is_string() {
        return Err("Rue SSR bundle did not set globalThis.__RUE_SSR_HTML".into());
    }

    Ok(rendered.to_rust_string_lossy(scope))
}

fn install_host_polyfills(runtime: &mut JsRuntime) -> Result<(), Box<dyn std::error::Error>> {
    runtime.execute_script(
        "rue-host-polyfills.js",
        r#"
if (typeof globalThis.atob !== "function") {
  globalThis.atob = input => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const clean = String(input).replace(/=+$/, "");
    let output = "";
    let buffer = 0;
    let bits = 0;

    for (const char of clean) {
      const value = chars.indexOf(char);
      if (value < 0) continue;
      buffer = (buffer << 6) | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        output += String.fromCharCode((buffer >> bits) & 0xff);
      }
    }

    return output;
  };
}

if (typeof globalThis.TextDecoder !== "function") {
  const decodeUtf8 = bytes => {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return decodeURIComponent(escape(binary));
  };

  globalThis.TextDecoder = class TextDecoder {
    constructor(label = "utf-8") {
      if (String(label).toLowerCase() !== "utf-8") {
        throw new TypeError("Only utf-8 TextDecoder is available in this demo host");
      }
    }

    decode(input = new Uint8Array()) {
      return decodeUtf8(input instanceof Uint8Array ? input : new Uint8Array(input));
    }
  };
}

if (typeof globalThis.TextEncoder !== "function") {
  const encodeUtf8 = value => {
    const binary = unescape(encodeURIComponent(String(value)));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  globalThis.TextEncoder = class TextEncoder {
    encode(value = "") {
      return encodeUtf8(value);
    }

    encodeInto(value, target) {
      const source = encodeUtf8(value);
      const written = Math.min(source.length, target.length);
      target.set(source.subarray(0, written));
      return { read: String(value).length, written };
    }
  };
}

if (typeof globalThis.URL !== "function") {
  globalThis.URL = class URL {};
}
"#,
    )?;

    Ok(())
}

pub fn serve(app_html: String, config: ServerConfig) -> Result<(), Box<dyn std::error::Error>> {
    let address = format!("{}:{}", config.host, config.port);
    let listener = TcpListener::bind(&address)?;
    println!("Rue SSR binary demo: http://{address}");
    serve_listener(listener, app_html)
}

pub fn serve_listener(
    listener: TcpListener,
    app_html: String,
) -> Result<(), Box<dyn std::error::Error>> {
    listener.set_nonblocking(true)?;
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?;

    runtime.block_on(async move {
        let listener = tokio::net::TcpListener::from_std(listener)?;
        axum::serve(listener, app_router(app_html)).await?;
        Ok::<(), Box<dyn std::error::Error>>(())
    })
}

#[derive(Deserialize)]
struct FileRequest {
    content: Option<String>,
    mode: Option<EditorMode>,
    path: String,
}

#[derive(Clone)]
struct AppState {
    app_html: Arc<String>,
}

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum EditorMode {
    Markdown,
    Text,
}

#[derive(Serialize)]
struct FileResponse {
    content: Option<String>,
    mode: EditorMode,
    path: String,
    status: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

fn app_router(app_html: String) -> Router {
    Router::new()
        .route("/", get(index_handler))
        .route("/client.js", get(client_js_handler))
        .route("/api/new-path", post(new_path_handler))
        .route("/api/open", post(open_file_handler))
        .route("/api/save", post(save_file_handler))
        .fallback(get(index_handler))
        .with_state(AppState {
            app_html: Arc::new(app_html),
        })
}

async fn index_handler(State(state): State<AppState>) -> Html<String> {
    Html(document(&state.app_html))
}

async fn client_js_handler(headers: HeaderMap) -> Response {
    let accepts_gzip = headers
        .get(header::ACCEPT_ENCODING)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.contains("gzip"))
        .unwrap_or(false);
    let gzipped = include_bytes!(concat!(env!("OUT_DIR"), "/client.js.gz"));

    if accepts_gzip && !gzipped.is_empty() {
        return Response::builder()
            .header(
                header::CONTENT_TYPE,
                "application/javascript; charset=utf-8",
            )
            .header(header::CONTENT_ENCODING, "gzip")
            .header(header::VARY, "Accept-Encoding")
            .body(Body::from(gzipped.to_vec()))
            .unwrap();
    }

    Response::builder()
        .header(
            header::CONTENT_TYPE,
            "application/javascript; charset=utf-8",
        )
        .body(Body::from(
            include_bytes!(concat!(env!("OUT_DIR"), "/client.js")).to_vec(),
        ))
        .unwrap()
}

async fn open_file_handler(Json(request): Json<FileRequest>) -> Response {
    api_response(open_file_response(request))
}

async fn new_path_handler(Json(request): Json<FileRequest>) -> Response {
    api_response(new_path_response(request))
}

async fn save_file_handler(Json(request): Json<FileRequest>) -> Response {
    api_response(save_file_response(request))
}

fn new_path_response(request: FileRequest) -> Result<FileResponse, Box<dyn std::error::Error>> {
    let mode = request.mode.unwrap_or(EditorMode::Markdown);
    let base_dir = expand_home_path("~/.rue-text-editor")?;
    let path = next_available_document_path(&base_dir, "untitled", mode)?;

    Ok(FileResponse {
        content: Some(String::new()),
        mode,
        path: path.display().to_string(),
        status: format!("New {}", display_file_name(&path)),
    })
}

fn open_file_response(request: FileRequest) -> Result<FileResponse, Box<dyn std::error::Error>> {
    let (path, mode) = normalize_document_path(&request.path, request.mode)?;
    let content = std::fs::read_to_string(&path)?;
    Ok(FileResponse {
        content: Some(content),
        mode,
        path: path.display().to_string(),
        status: format!("Opened {}", display_file_name(&path)),
    })
}

fn save_file_response(request: FileRequest) -> Result<FileResponse, Box<dyn std::error::Error>> {
    let (path, mode) = normalize_document_path(&request.path, request.mode)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, request.content.unwrap_or_default())?;
    Ok(FileResponse {
        content: None,
        mode,
        path: path.display().to_string(),
        status: format!("Saved {}", display_file_name(&path)),
    })
}

fn normalize_document_path(
    value: &str,
    mode: Option<EditorMode>,
) -> Result<(PathBuf, EditorMode), Box<dyn std::error::Error>> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(invalid_input("Choose a .txt or .md file path first").into());
    }

    let mut path = expand_home_path(trimmed)?;
    if path.extension().is_none() {
        path.set_extension(mode.unwrap_or(EditorMode::Text).extension());
    }

    let resolved_mode = match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("txt") => EditorMode::Text,
        Some("md" | "markdown") => EditorMode::Markdown,
        _ => return Err(invalid_input("Only .txt, .md, and .markdown files are supported").into()),
    };

    if path.is_relative() {
        path = std::env::current_dir()?.join(path);
    }

    Ok((path, resolved_mode))
}

fn next_available_document_path(
    base_dir: &Path,
    stem: &str,
    mode: EditorMode,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    std::fs::create_dir_all(base_dir)?;
    let extension = mode.extension();
    let first = base_dir.join(format!("{stem}.{extension}"));
    if !first.exists() {
        return Ok(first);
    }

    for index in 1..10_000 {
        let candidate = base_dir.join(format!("{stem}-{index}.{extension}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(invalid_input("Cannot find an available untitled file name").into())
}

impl EditorMode {
    fn extension(self) -> &'static str {
        match self {
            EditorMode::Markdown => "md",
            EditorMode::Text => "txt",
        }
    }
}

fn display_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("text file")
        .to_string()
}

fn expand_home_path(value: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if value == "~" || value.starts_with("~/") {
        let home = std::env::var("HOME")
            .map_err(|_| invalid_input("Cannot expand ~ because HOME is not set"))?;
        if value == "~" {
            return Ok(PathBuf::from(home));
        }
        return Ok(PathBuf::from(home).join(&value[2..]));
    }

    Ok(PathBuf::from(value))
}

fn api_response<T: Serialize>(result: Result<T, Box<dyn std::error::Error>>) -> Response {
    match result {
        Ok(value) => (StatusCode::OK, Json(value)).into_response(),
        Err(error) => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: error.to_string(),
            }),
        )
            .into_response(),
    }
}

fn document(app_html: &str) -> String {
    format!(
        r##"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Rue Text Editor</title>
    <style>
      * {{
        box-sizing: border-box;
      }}

      body {{
        margin: 0;
        min-height: 100vh;
        background: #eef1f5;
        color: #20242c;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }}

      #app {{
        min-height: 100vh;
      }}

      .rue-text-editor {{
        min-height: 100vh;
        display: grid;
        grid-template-rows: auto auto auto 1fr;
        background: white;
      }}

      .editor-header {{
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        border-bottom: 1px solid #d6dbe3;
        background: #f8fafc;
      }}

      .editor-header h1 {{
        margin: 0;
        font-size: 18px;
        font-weight: 700;
      }}

      .editor-header p {{
        margin: 3px 0 0;
        color: #5d6676;
        font-size: 13px;
      }}

      .editor-actions {{
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }}

      button {{
        border: 0;
        border-radius: 6px;
        padding: 8px 12px;
        background: #2563eb;
        color: white;
        font: inherit;
        cursor: pointer;
      }}

      .mode-tabs {{
        display: inline-flex;
        gap: 2px;
        padding: 3px;
        border: 1px solid #c8cfdb;
        border-radius: 7px;
        background: #eef2f7;
      }}

      .mode-tabs button {{
        min-width: 82px;
        padding: 6px 10px;
        border-radius: 5px;
        background: transparent;
        color: #384153;
      }}

      .mode-tabs button.active {{
        background: white;
        color: #172033;
        box-shadow: 0 1px 3px rgb(23 32 51 / 15%);
      }}

      button:disabled {{
        cursor: progress;
        opacity: 0.62;
      }}

      .path-row {{
        display: grid;
        grid-template-columns: 116px 1fr;
        align-items: center;
        gap: 10px;
        padding: 12px 18px;
        border-bottom: 1px solid #d6dbe3;
        background: #fbfcfe;
      }}

      .path-row span {{
        color: #465064;
        font-size: 13px;
        font-weight: 700;
      }}

      .markdown-tools {{
        display: none;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        border-bottom: 1px solid #d6dbe3;
        background: #f7f9fc;
      }}

      .is-markdown .markdown-tools {{
        display: flex;
      }}

      .markdown-tools span {{
        margin-right: 4px;
        color: #5d6676;
        font-size: 13px;
        font-weight: 700;
      }}

      .markdown-tools button {{
        min-width: 34px;
        padding: 6px 9px;
        background: #e7ecf3;
        color: #273244;
      }}

      .markdown-tools button:hover {{
        background: #d9e2ee;
      }}

      input,
      textarea {{
        width: 100%;
        border: 1px solid #c8cfdb;
        border-radius: 6px;
        color: #20242c;
        font: inherit;
      }}

      input {{
        min-width: 0;
        padding: 8px 10px;
        background: white;
      }}

      textarea {{
        height: 100%;
        min-height: 360px;
        resize: none;
        border: 0;
        border-radius: 0;
        padding: 18px;
        font: 15px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        outline: none;
      }}

      .editor-workspace {{
        min-height: 0;
        display: grid;
        grid-template-columns: 1fr;
      }}

      .is-markdown .editor-workspace {{
        grid-template-columns: minmax(0, 1fr) minmax(320px, 42%);
      }}

      .markdown-preview {{
        display: none;
        overflow: auto;
        padding: 18px 22px;
        border-left: 1px solid #d6dbe3;
        background: #fbfcfe;
        line-height: 1.65;
      }}

      .is-markdown .markdown-preview {{
        display: block;
      }}

      .markdown-preview h1,
      .markdown-preview h2 {{
        margin: 0 0 12px;
        line-height: 1.25;
      }}

      .markdown-preview p,
      .markdown-preview blockquote,
      .markdown-preview ul {{
        margin: 0 0 12px;
      }}

      .markdown-preview blockquote {{
        padding-left: 12px;
        border-left: 3px solid #9aa8bd;
        color: #465064;
      }}

      .markdown-preview code {{
        padding: 2px 5px;
        border-radius: 4px;
        background: #e7ecf3;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      }}

      @media (max-width: 640px) {{
        .editor-header {{
          align-items: stretch;
          flex-direction: column;
        }}

        .editor-actions {{
          justify-content: flex-start;
        }}

        .path-row {{
          grid-template-columns: 1fr;
        }}

        .is-markdown .editor-workspace {{
          grid-template-columns: 1fr;
        }}

        .markdown-preview {{
          min-height: 240px;
          border-left: 0;
          border-top: 1px solid #d6dbe3;
        }}
      }}
    </style>
  </head>
  <body>
    <div id="app">{app_html}</div>
    <script type="module" src="/client.js"></script>
  </body>
</html>"##
    )
}
