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

  fn find_node(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(from_env) = std::env::var("EDGETX_NODE_PATH") {
      let path = PathBuf::from(from_env);
      if path.exists() {
        return path;
      }
    }

    // Prefer the portable Node embedded next to the installer resources.
    if let Ok(resource_dir) = app.path().resource_dir() {
      let bundled = [
        resource_dir.join("node").join("node.exe"),
        resource_dir.join("node").join("node"),
        resource_dir.join("node").join("bin").join("node"),
        resource_dir
          .join("_up_")
          .join("resources")
          .join("node")
          .join("node.exe"),
        resource_dir
          .join("_up_")
          .join("resources")
          .join("node")
          .join("node"),
      ];
      for candidate in bundled {
        if candidate.is_file() {
          return candidate;
        }
      }
    }

    #[cfg(debug_assertions)]
    {
      let dev_node = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../resources/node");
      for name in ["node.exe", "node"] {
        let candidate = dev_node.join(name);
        if candidate.is_file() {
          return candidate;
        }
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

  fn resource_standalone_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
      .path()
      .resource_dir()
      .map_err(|e| format!("resource dir unavailable: {e}"))?;

    // Preferred layout (tauri.conf.json maps ../resources/standalone/ → standalone/).
    // Also accept the legacy array-form path where `../` becomes `_up_/`.
    let candidates = [
      resource_dir.join("standalone"),
      resource_dir
        .join("_up_")
        .join("resources")
        .join("standalone"),
    ];

    for candidate in &candidates {
      if candidate.join("apps").join("web").join("server.js").is_file() {
        return Ok(candidate.clone());
      }
    }

    // Local `tauri build` / unpackaged debug only — never ship CI absolute paths
    // into release error messages via CARGO_MANIFEST_DIR alone.
    #[cfg(debug_assertions)]
    {
      let dev_fallback =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../resources/standalone");
      if dev_fallback
        .join("apps")
        .join("web")
        .join("server.js")
        .is_file()
      {
        return Ok(dev_fallback);
      }
    }

    let tried = candidates
      .iter()
      .map(|p| p.display().to_string())
      .collect::<Vec<_>>()
      .join(", ");
    Err(format!(
      "Standalone server (apps/web/server.js) not found under the app resources at {}. Tried: {}. Rebuild the desktop package so the Next.js sidecar is embedded.",
      resource_dir.display(),
      tried
    ))
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
    let standalone = resource_standalone_dir(app)?;
    let server_js = standalone.join("apps/web/server.js");
    if !server_js.is_file() {
      return Err(format!(
        "Standalone server missing at {}.",
        server_js.display()
      ));
    }

    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

    let node = find_node(app);
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
      .map_err(|e| {
        format!(
          "Failed to spawn Node ({node:?}): {e}. The installer should embed Node under resources/node; otherwise install Node.js 22+ or set EDGETX_NODE_PATH."
        )
      })?;

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
         <p>Release builds embed a portable Node binary plus the Next.js sidecar. If startup still fails, set <code>EDGETX_NODE_PATH</code> or reinstall from a fresh desktop package.</p>\
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

#[derive(serde::Deserialize)]
struct SdInstallFile {
  path: String,
  content: String,
  #[serde(default)]
  encoding: Option<String>,
}

fn decode_sd_content(file: &SdInstallFile) -> Result<Vec<u8>, String> {
  let enc = file.encoding.as_deref().unwrap_or("utf8");
  if !enc.eq_ignore_ascii_case("base64") {
    return Ok(file.content.as_bytes().to_vec());
  }
  fn b64_val(c: u8) -> Option<u8> {
    match c {
      b'A'..=b'Z' => Some(c - b'A'),
      b'a'..=b'z' => Some(c - b'a' + 26),
      b'0'..=b'9' => Some(c - b'0' + 52),
      b'+' => Some(62),
      b'/' => Some(63),
      _ => None,
    }
  }
  let cleaned: Vec<u8> = file
    .content
    .bytes()
    .filter(|b| !b.is_ascii_whitespace())
    .collect();
  if cleaned.len() % 4 != 0 {
    return Err("Invalid base64 length".into());
  }
  let mut out = Vec::with_capacity(cleaned.len() * 3 / 4);
  let mut i = 0;
  while i < cleaned.len() {
    let (a, b, c, d) = (
      cleaned[i],
      cleaned[i + 1],
      cleaned[i + 2],
      cleaned[i + 3],
    );
    i += 4;
    let av = b64_val(a).ok_or_else(|| "Invalid base64".to_string())?;
    let bv = b64_val(b).ok_or_else(|| "Invalid base64".to_string())?;
    out.push((av << 2) | (bv >> 4));
    if c != b'=' {
      let cv = b64_val(c).ok_or_else(|| "Invalid base64".to_string())?;
      out.push(((bv & 0x0f) << 4) | (cv >> 2));
      if d != b'=' {
        let dv = b64_val(d).ok_or_else(|| "Invalid base64".to_string())?;
        out.push(((cv & 0x03) << 6) | dv);
      }
    }
  }
  Ok(out)
}

#[tauri::command]
fn install_widget_to_sd(
  sd_root: String,
  widget_name: String,
  lua_source: String,
  install_md: Option<String>,
  files: Option<Vec<SdInstallFile>>,
) -> Result<serde_json::Value, String> {
  let name = widget_name.trim();
  if name.is_empty() || name.len() > 10 || !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
  {
    return Err("Widget name must be 1–10 letters, digits, or underscore".into());
  }
  let root = std::path::PathBuf::from(sd_root.trim());
  if !root.is_dir() {
    return Err(format!("SD root is not a directory: {}", root.display()));
  }

  let mut written: Vec<String> = Vec::new();

  if let Some(extra) = files {
    if !extra.is_empty() {
      for file in extra {
        let rel = file.path.trim().replace('\\', "/");
        if rel.is_empty()
          || rel.starts_with('/')
          || rel.contains("..")
          || !(rel.starts_with("WIDGETS/")
            || rel.starts_with("SCRIPTS/TOOLS/")
            || rel.starts_with("SCRIPTS/TELEMETRY/"))
        {
          return Err(format!("Refusing unsafe SD path: {rel}"));
        }
        let dest = root.join(&rel);
        if let Some(parent) = dest.parent() {
          std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(&dest, decode_sd_content(&file)?).map_err(|e| e.to_string())?;
        written.push(rel);
      }
      return Ok(serde_json::json!({
        "dest": root.join("WIDGETS").join(name).display().to_string(),
        "files": written,
      }));
    }
  }

  let dest = root.join("WIDGETS").join(name);
  std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
  std::fs::write(dest.join("main.lua"), lua_source).map_err(|e| e.to_string())?;
  written.push(format!("WIDGETS/{name}/main.lua"));
  if let Some(md) = install_md {
    if !md.trim().is_empty() {
      let _ = std::fs::write(dest.join("INSTALL.md"), md);
      written.push(format!("WIDGETS/{name}/INSTALL.md"));
    }
  }
  Ok(serde_json::json!({
    "dest": dest.display().to_string(),
    "files": written,
  }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(SidecarState(Mutex::new(None)))
    .invoke_handler(tauri::generate_handler![install_widget_to_sd])
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
