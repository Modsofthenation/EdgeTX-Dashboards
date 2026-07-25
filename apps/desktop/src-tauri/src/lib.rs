use std::sync::Mutex;

use tauri::{Manager, RunEvent};

struct SidecarState(Mutex<Option<std::process::Child>>);

#[cfg(not(dev))]
mod sidecar {
  use super::SidecarState;
  use std::io::{BufRead, BufReader};
  use std::net::TcpListener;
  use std::path::PathBuf;
  use std::process::{Child, Command, Stdio};
  use std::thread;
  use std::time::{Duration, Instant};
  use tauri::{Manager, Url};

  fn free_local_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
      .expect("bind ephemeral port")
      .local_addr()
      .expect("local addr")
      .port()
  }

  fn find_node() -> PathBuf {
    if let Ok(from_env) = std::env::var("EDGETX_NODE_PATH") {
      let path = PathBuf::from(from_env);
      if path.exists() {
        return path;
      }
    }

    #[cfg(windows)]
    {
      if let Ok(output) = Command::new("where").arg("node.exe").output() {
        if output.status.success() {
          if let Some(line) = String::from_utf8_lossy(&output.stdout).lines().next() {
            let path = PathBuf::from(line.trim());
            if path.exists() {
              return path;
            }
          }
        }
      }
    }

    #[cfg(not(windows))]
    {
      if let Ok(output) = Command::new("which").arg("node").output() {
        if output.status.success() {
          let path = PathBuf::from(String::from_utf8_lossy(&output.stdout).trim());
          if path.exists() {
            return path;
          }
        }
      }
    }

    PathBuf::from("node")
  }

  fn resource_standalone_dir(app: &tauri::AppHandle) -> PathBuf {
    let resource_dir = app
      .path()
      .resource_dir()
      .expect("resource dir")
      .join("standalone");
    if resource_dir.exists() {
      return resource_dir;
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../resources/standalone")
  }

  fn wait_for_health(port: u16, timeout: Duration) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{port}/api/health");
    let started = Instant::now();
    while started.elapsed() < timeout {
      if let Ok(response) = ureq::get(&url).call() {
        if (200..300).contains(&response.status()) {
          return Ok(());
        }
      }
      thread::sleep(Duration::from_millis(200));
    }
    Err(format!(
      "Timed out waiting for Next sidecar health at {url}"
    ))
  }

  fn spawn_sidecar(app: &tauri::AppHandle, port: u16) -> Result<Child, String> {
    let standalone = resource_standalone_dir(app);
    let server_js = standalone.join("apps/web/server.js");
    if !server_js.exists() {
      return Err(format!(
        "Standalone server missing at {}. Run `npm run desktop:prepare` first.",
        server_js.display()
      ));
    }

    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

    let node = find_node();
    let mut child = Command::new(&node)
      .arg("apps/web/server.js")
      .current_dir(&standalone)
      .env("PORT", port.to_string())
      .env("HOSTNAME", "127.0.0.1")
      .env("WIDGET_GEN_DATA_DIR", &data_dir)
      .env("NODE_ENV", "production")
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .spawn()
      .map_err(|e| format!("Failed to spawn node ({node:?}): {e}"))?;

    if let Some(stderr) = child.stderr.take() {
      thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
          eprintln!("[sidecar] {line}");
        }
      });
    }

    Ok(child)
  }

  pub fn start_production_sidecar(app: &tauri::AppHandle) -> Result<u16, String> {
    let port = free_local_port();
    let child = spawn_sidecar(app, port)?;
    if let Ok(mut guard) = app.state::<SidecarState>().0.lock() {
      *guard = Some(child);
    }
    wait_for_health(port, Duration::from_secs(45))?;
    Ok(port)
  }

  fn html_escape(input: &str) -> String {
    input
      .replace('&', "&amp;")
      .replace('<', "&lt;")
      .replace('>', "&gt;")
      .replace('"', "&quot;")
  }

  pub fn navigate_to_sidecar(app: &tauri::App, port: u16) {
    let url = Url::parse(&format!("http://127.0.0.1:{port}/")).expect("sidecar url");
    if let Some(window) = app.get_webview_window("main") {
      let _ = window.navigate(url);
    }
  }

  pub fn show_sidecar_error(app: &tauri::App, err: &str) {
    eprintln!("Sidecar failed to start: {err}");
    if let Some(window) = app.get_webview_window("main") {
      let html = format!(
        "<!doctype html><html><body style='font-family:system-ui;padding:2rem;background:#eef1f4;color:#0f172a'>\
         <h1>Could not start EdgeTX Dashboards</h1>\
         <p>{}</p>\
         <p>Install Node.js 22+ on PATH, or set <code>EDGETX_NODE_PATH</code>, then rebuild with <code>npm run desktop:prepare</code>.</p>\
         </body></html>",
        html_escape(err)
      );
      let _ = window.eval(&format!(
        "document.open();document.write({});document.close();",
        serde_json::to_string(&html).unwrap_or_else(|_| "\"\"".into())
      ));
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(SidecarState(Mutex::new(None)))
    .setup(|app| {
      #[cfg(not(dev))]
      {
        match sidecar::start_production_sidecar(&app.handle()) {
          Ok(port) => sidecar::navigate_to_sidecar(app, port),
          Err(err) => sidecar::show_sidecar_error(app, &err),
        }
      }
      #[cfg(dev)]
      {
        let _ = app;
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building EdgeTX Dashboards")
    .run(|app_handle, event| {
      if let RunEvent::Exit = event {
        if let Ok(mut guard) = app_handle.state::<SidecarState>().0.lock() {
          if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
          }
        }
      }
    });
}
