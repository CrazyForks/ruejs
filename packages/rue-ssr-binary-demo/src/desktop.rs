#![cfg_attr(
    all(target_os = "windows", not(debug_assertions)),
    windows_subsystem = "windows"
)]

#[cfg(all(not(target_arch = "wasm32"), not(target_env = "musl")))]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use std::net::TcpListener;
    use std::thread;
    use tao::event::{Event, WindowEvent};
    use tao::event_loop::{ControlFlow, EventLoopBuilder};
    use tao::window::WindowBuilder;
    use wry::{WebContext, WebViewBuilder};

    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let mut title = "Rue SSR Desktop Demo".to_string();
    let mut width = 960.0;
    let mut height = 640.0;
    let mut devtools = false;

    for arg in &args {
        if let Some(value) = arg.strip_prefix("--title=") {
            title = value.to_string();
        } else if let Some(value) = arg.strip_prefix("--width=") {
            width = value.parse::<f64>().unwrap_or(width);
        } else if let Some(value) = arg.strip_prefix("--height=") {
            height = value.parse::<f64>().unwrap_or(height);
        } else if arg == "--devtools" {
            devtools = true;
        }
    }

    let html = rue_ssr_binary_demo::render_rue_ssr()?;
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let url = format!("http://{}", listener.local_addr()?);

    thread::spawn(move || {
        if let Err(error) = rue_ssr_binary_demo::serve_listener(listener, html) {
            eprintln!("Rue desktop server failed: {error}");
        }
    });

    let event_loop = EventLoopBuilder::<()>::new().build();
    let window = WindowBuilder::new()
        .with_title(title)
        .with_inner_size(tao::dpi::LogicalSize::new(width, height))
        .build(&event_loop)?;
    let mut web_context = WebContext::new(None);
    let _webview = WebViewBuilder::new_with_web_context(&mut web_context)
        .with_url(url.as_str())
        .with_devtools(devtools)
        .build(&window)?;

    event_loop.run(move |event, _, control_flow| {
        if *control_flow != ControlFlow::Exit {
            *control_flow = ControlFlow::Wait;
        }

        if let Event::WindowEvent {
            event: WindowEvent::CloseRequested,
            ..
        } = event
        {
            *control_flow = ControlFlow::Exit;
        }
    });
}

#[cfg(any(target_arch = "wasm32", target_env = "musl"))]
fn main() {
    eprintln!("The Rue desktop demo requires a native target with WebView support.");
}
