use std::sync::Mutex;

use tauri::{Manager, RunEvent};
use tauri_plugin_dialog::DialogExt;

struct SidecarState(Mutex<Option<std::process::Child>>);

#[cfg(not(dev))]
mod sidecar {
  use super::SidecarState;
  use std::io::{BufRead, BufReader};
  use std::net::TcpListener;
  use std::path::{Path, PathBuf};
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

  /// Recursively copy `src` into `dest` (creates parents; overwrites files).
  fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    if !src.is_dir() {
      return Err(format!("Not a directory: {}", src.display()));
    }
    std::fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
      let entry = entry.map_err(|e| e.to_string())?;
      let ty = entry.file_type().map_err(|e| e.to_string())?;
      let from = entry.path();
      let to = dest.join(entry.file_name());
      if ty.is_dir() {
        copy_dir_recursive(&from, &to)?;
      } else if ty.is_file() {
        if let Some(parent) = to.parent() {
          std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::copy(&from, &to).map_err(|e| e.to_string())?;
      }
    }
    Ok(())
  }

  /// Seed a writable Cursor/agent workspace under app data from bundled standalone assets.
  /// Installer resources may be read-only; generate writes `generated/` under this workspace.
  fn ensure_writable_workspace(
    standalone: &Path,
    data_dir: &Path,
  ) -> Result<PathBuf, String> {
    let workspace = data_dir.join("workspace");
    std::fs::create_dir_all(&workspace).map_err(|e| e.to_string())?;

    let asset_dirs = ["knowledge", "templates", "examples", "stubs"];
    for name in asset_dirs {
      let src = standalone.join(name);
      if src.is_dir() {
        copy_dir_recursive(&src, &workspace.join(name))?;
      }
    }
    let rules_src = standalone.join(".cursor").join("rules");
    if rules_src.is_dir() {
      copy_dir_recursive(&rules_src, &workspace.join(".cursor").join("rules"))?;
    }

    std::fs::create_dir_all(workspace.join("generated")).map_err(|e| e.to_string())?;

    let marker = workspace.join("knowledge").join("radios").join("tx15.json");
    if !marker.is_file() {
      return Err(format!(
        "Desktop workspace missing knowledge marker at {}. Rebuild the desktop package so prepare-standalone stages knowledge/.",
        marker.display()
      ));
    }
    Ok(workspace)
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
    let workspace = ensure_writable_workspace(&standalone, &data_dir)?;

    let node = find_node(app);
    let log_path = data_dir.join("sidecar.log");
    let log_file = std::fs::OpenOptions::new()
      .create(true)
      .append(true)
      .open(&log_path)
      .map_err(|e| format!("Failed to open sidecar log {}: {e}", log_path.display()))?;

    let mut child = Command::new(&node)
      .arg("apps/web/server.js")
      .current_dir(&standalone)
      .env("PORT", port.to_string())
      .env("HOSTNAME", "127.0.0.1")
      .env("WIDGET_GEN_DATA_DIR", &data_dir)
      .env("WIDGET_GEN_REPO_ROOT", &workspace)
      .env(
        "WIDGET_GEN_SIM_DIR",
        standalone.join("apps/web/public/sim").to_string_lossy().as_ref(),
      )
      // Windows Cursor sandbox needs WSL2; packaged desktop uses an app-data
      // workspace instead. Keep sandbox off unless the user forces it on.
      .env("CURSOR_SANDBOX_ENABLED", "0")
      .env("NODE_ENV", "production")
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .spawn()
      .map_err(|e| {
        format!(
          "Failed to spawn Node ({node:?}): {e}. The installer should embed Node under resources/node; otherwise install Node.js 22+ or set EDGETX_NODE_PATH."
        )
      })?;

    {
      use std::io::Write;
      let mut header = log_file
        .try_clone()
        .map_err(|e| format!("Failed to clone sidecar log handle: {e}"))?;
      let _ = writeln!(
        header,
        "\n===== sidecar start {} port={} sandbox=off =====",
        chrono_like_stamp(),
        port
      );
    }

    if let Some(stdout) = child.stdout.take() {
      let mut out_log = log_file
        .try_clone()
        .map_err(|e| format!("Failed to clone sidecar log handle: {e}"))?;
      thread::spawn(move || {
        use std::io::Write;
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
          eprintln!("[sidecar:out] {line}");
          let _ = writeln!(out_log, "[out] {line}");
        }
      });
    }

    if let Some(stderr) = child.stderr.take() {
      let mut err_log = log_file;
      thread::spawn(move || {
        use std::io::Write;
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
          eprintln!("[sidecar] {line}");
          let _ = writeln!(err_log, "[err] {line}");
        }
      });
    }

    Ok(child)
  }

  fn chrono_like_stamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .map(|d| d.as_secs())
      .unwrap_or(0);
    format!("{secs}")
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
         <p>Release builds embed a portable Node binary plus the Next.js sidecar. If startup still fails, set <code>EDGETX_NODE_PATH</code> or reinstall from a fresh desktop package. Sidecar logs are written to <code>sidecar.log</code> in the app data directory.</p>\
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

const MAX_SD_INSTALL_FILES: usize = 64;
const MAX_SD_INSTALL_BYTES: usize = 8 * 1024 * 1024;

fn decode_sd_content(file: &SdInstallFile) -> Result<Vec<u8>, String> {
  let enc = file.encoding.as_deref().unwrap_or("utf8");
  if !enc.eq_ignore_ascii_case("base64") {
    return Ok(file.content.as_bytes().to_vec());
  }
  decode_base64(&file.content)
}

fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
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
  let cleaned: Vec<u8> = input
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

fn validate_sd_relative_path(rel: &str, widget_name: &str) -> Result<(), String> {
  let widget_prefix = format!("WIDGETS/{widget_name}/");
  let allowed = rel.starts_with(&widget_prefix)
    || rel.starts_with("SCRIPTS/TOOLS/")
    || rel.starts_with("SCRIPTS/TELEMETRY/")
    || rel.starts_with("IMAGES/");
  let safe_components = !rel.is_empty()
    && !rel.starts_with('/')
    && !rel.ends_with('/')
    && rel
      .split('/')
      .all(|part| !part.is_empty() && part != "." && part != "..");
  if !allowed || !safe_components {
    return Err(format!("Refusing unsafe SD path: {rel}"));
  }
  Ok(())
}

fn sd_destination(
  canonical_root: &std::path::Path,
  rel: &str,
) -> Result<std::path::PathBuf, String> {
  let dest = canonical_root.join(rel);
  if !dest.starts_with(canonical_root) {
    return Err(format!("Refusing SD path outside selected root: {rel}"));
  }

  if dest.exists() {
    let canonical_dest = dest.canonicalize().map_err(|e| e.to_string())?;
    if !canonical_dest.starts_with(canonical_root) {
      return Err(format!("Refusing SD path outside selected root: {rel}"));
    }
  }

  let parent = dest
    .parent()
    .ok_or_else(|| format!("Invalid SD destination: {rel}"))?;
  let mut existing = parent;
  while !existing.exists() {
    existing = existing
      .parent()
      .ok_or_else(|| format!("Invalid SD destination: {rel}"))?;
  }
  let canonical_existing = existing.canonicalize().map_err(|e| e.to_string())?;
  if !canonical_existing.starts_with(canonical_root) {
    return Err(format!("Refusing SD path outside selected root: {rel}"));
  }

  std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  let canonical_parent = parent.canonicalize().map_err(|e| e.to_string())?;
  if !canonical_parent.starts_with(canonical_root) {
    return Err(format!("Refusing SD path outside selected root: {rel}"));
  }
  let file_name = dest
    .file_name()
    .ok_or_else(|| format!("Invalid SD destination: {rel}"))?;
  Ok(canonical_parent.join(file_name))
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
  let canonical_root = root
    .canonicalize()
    .map_err(|e| format!("Could not resolve SD root {}: {e}", root.display()))?;
  let widgets_dir = canonical_root.join("WIDGETS");
  if !widgets_dir.is_dir() {
    return Err(format!(
      "Selected SD root must contain a WIDGETS directory: {}",
      widgets_dir.display()
    ));
  }
  let canonical_widgets = widgets_dir
    .canonicalize()
    .map_err(|e| format!("Could not resolve WIDGETS directory: {e}"))?;
  if !canonical_widgets.starts_with(&canonical_root) {
    return Err("WIDGETS directory is outside the selected SD root".into());
  }

  let mut decoded_files: Vec<(String, Vec<u8>)> = Vec::new();
  let mut total_bytes = lua_source.len();
  if let Some(md) = install_md.as_ref().filter(|md| !md.trim().is_empty()) {
    total_bytes = total_bytes
      .checked_add(md.len())
      .ok_or_else(|| "SD install payload is too large".to_string())?;
  }

  if let Some(extra) = files {
    if extra.len() > MAX_SD_INSTALL_FILES {
      return Err(format!(
        "SD install package contains too many files (maximum {MAX_SD_INSTALL_FILES})"
      ));
    }
    for file in extra {
      let rel = file.path.trim().replace('\\', "/");
      validate_sd_relative_path(&rel, name)?;
      let bytes = decode_sd_content(&file)?;
      total_bytes = total_bytes
        .checked_add(bytes.len())
        .ok_or_else(|| "SD install payload is too large".to_string())?;
      if total_bytes > MAX_SD_INSTALL_BYTES {
        return Err(format!(
          "SD install payload exceeds {} MB",
          MAX_SD_INSTALL_BYTES / (1024 * 1024)
        ));
      }
      decoded_files.push((rel, bytes));
    }
  }
  if total_bytes > MAX_SD_INSTALL_BYTES {
    return Err(format!(
      "SD install payload exceeds {} MB",
      MAX_SD_INSTALL_BYTES / (1024 * 1024)
    ));
  }

  let main_rel = format!("WIDGETS/{name}/main.lua");
  decoded_files.push((main_rel, lua_source.into_bytes()));
  if let Some(md) = install_md {
    if !md.trim().is_empty() {
      let install_rel = format!("WIDGETS/{name}/INSTALL.md");
      decoded_files.push((install_rel, md.into_bytes()));
    }
  }

  let resolved_files = decoded_files
    .into_iter()
    .map(|(rel, bytes)| {
      let dest = sd_destination(&canonical_root, &rel)?;
      Ok((rel, dest, bytes))
    })
    .collect::<Result<Vec<_>, String>>()?;

  let mut written: Vec<String> = Vec::new();
  for (rel, dest, bytes) in resolved_files {
    std::fs::write(dest, bytes).map_err(|e| e.to_string())?;
    if !written.contains(&rel) {
      written.push(rel);
    }
  }
  let dest = canonical_root.join("WIDGETS").join(name);
  Ok(serde_json::json!({
    "dest": dest.display().to_string(),
    "files": written,
  }))
}

fn assert_safe_user_path(path: &str) -> Result<std::path::PathBuf, String> {
  let trimmed = path.trim();
  if trimmed.is_empty() {
    return Err("Path is empty".into());
  }
  if trimmed.contains('\0') {
    return Err("Invalid path".into());
  }
  Ok(std::path::PathBuf::from(trimmed))
}

fn file_path_to_pathbuf(
  file_path: tauri_plugin_dialog::FilePath,
) -> Result<std::path::PathBuf, String> {
  file_path
    .into_path()
    .map_err(|e| format!("Invalid dialog path: {e}"))
}

/// Save text via a native save dialog — JS never supplies a free filesystem path.
#[tauri::command]
async fn save_text_with_dialog(
  app: tauri::AppHandle,
  contents: String,
  default_name: String,
  filter_name: String,
  extensions: Vec<String>,
) -> Result<Option<String>, String> {
  let safe_name = default_name
    .trim()
    .replace(['/', '\\'], "_")
    .chars()
    .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
    .collect::<String>();
  let name = if safe_name.is_empty() {
    "download.txt".to_string()
  } else {
    safe_name
  };
  let exts: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
  let mut builder = app.dialog().file().set_file_name(&name);
  if !exts.is_empty() {
    let label = if filter_name.trim().is_empty() {
      "File"
    } else {
      filter_name.trim()
    };
    builder = builder.add_filter(label, &exts);
  }
  let Some(picked) = builder.blocking_save_file() else {
    return Ok(None);
  };
  let dest = file_path_to_pathbuf(picked)?;
  if let Some(parent) = dest.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  std::fs::write(&dest, contents).map_err(|e| e.to_string())?;
  Ok(Some(dest.display().to_string()))
}

/// Save binary (base64) via a native save dialog — no free path from JS.
#[tauri::command]
async fn save_bytes_with_dialog(
  app: tauri::AppHandle,
  contents_base64: String,
  default_name: String,
  filter_name: String,
  extensions: Vec<String>,
) -> Result<Option<String>, String> {
  let bytes = decode_base64(&contents_base64)?;
  let safe_name = default_name
    .trim()
    .replace(['/', '\\'], "_")
    .chars()
    .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
    .collect::<String>();
  let name = if safe_name.is_empty() {
    "download.bin".to_string()
  } else {
    safe_name
  };
  let exts: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
  let mut builder = app.dialog().file().set_file_name(&name);
  if !exts.is_empty() {
    let label = if filter_name.trim().is_empty() {
      "File"
    } else {
      filter_name.trim()
    };
    builder = builder.add_filter(label, &exts);
  }
  let Some(picked) = builder.blocking_save_file() else {
    return Ok(None);
  };
  let dest = file_path_to_pathbuf(picked)?;
  if let Some(parent) = dest.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  std::fs::write(&dest, bytes).map_err(|e| e.to_string())?;
  Ok(Some(dest.display().to_string()))
}

/// Open a text file via a native open dialog — no free path from JS.
#[tauri::command]
async fn open_text_with_dialog(
  app: tauri::AppHandle,
  filter_name: String,
  extensions: Vec<String>,
) -> Result<Option<serde_json::Value>, String> {
  let exts: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
  let mut builder = app.dialog().file();
  if !exts.is_empty() {
    let label = if filter_name.trim().is_empty() {
      "File"
    } else {
      filter_name.trim()
    };
    builder = builder.add_filter(label, &exts);
  }
  let Some(picked) = builder.blocking_pick_file() else {
    return Ok(None);
  };
  let src = file_path_to_pathbuf(picked)?;
  let contents = std::fs::read_to_string(&src).map_err(|e| e.to_string())?;
  Ok(Some(serde_json::json!({
    "path": src.display().to_string(),
    "contents": contents,
  })))
}

/// Legacy path-based writes — restricted to the app data directory only.
#[tauri::command]
fn write_text_file(
  app: tauri::AppHandle,
  path: String,
  contents: String,
) -> Result<(), String> {
  let dest = assert_path_under_app_data(&app, &path)?;
  if let Some(parent) = dest.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  std::fs::write(&dest, contents).map_err(|e| e.to_string())
}

/// Legacy path-based binary writes — restricted to the app data directory only.
#[tauri::command]
fn write_bytes_file(
  app: tauri::AppHandle,
  path: String,
  contents_base64: String,
) -> Result<(), String> {
  let dest = assert_path_under_app_data(&app, &path)?;
  let bytes = decode_base64(&contents_base64)?;
  if let Some(parent) = dest.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  std::fs::write(&dest, bytes).map_err(|e| e.to_string())
}

/// Legacy path-based reads — restricted to the app data directory only.
#[tauri::command]
fn read_text_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
  let src = assert_path_under_app_data(&app, &path)?;
  std::fs::read_to_string(&src).map_err(|e| e.to_string())
}

fn assert_path_under_app_data(
  app: &tauri::AppHandle,
  path: &str,
) -> Result<std::path::PathBuf, String> {
  let dest = assert_safe_user_path(path)?;
  let app_data = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;
  let canonical_base = app_data
    .canonicalize()
    .unwrap_or(app_data.clone());
  let candidate = if dest.is_absolute() {
    dest
  } else {
    canonical_base.join(dest)
  };
  let canonical = candidate.canonicalize().or_else(|_| {
    // File may not exist yet (writes) — canonicalize parent + join name.
    let parent = candidate
      .parent()
      .ok_or_else(|| "Invalid path".to_string())?;
    let name = candidate
      .file_name()
      .ok_or_else(|| "Invalid path".to_string())?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let parent_canon = parent.canonicalize().map_err(|e| e.to_string())?;
    Ok::<_, String>(parent_canon.join(name))
  })?;
  if !canonical.starts_with(&canonical_base) {
    return Err("Path is outside the app data directory".into());
  }
  Ok(canonical)
}

#[tauri::command]
fn write_app_data_project(
  app: tauri::AppHandle,
  file_name: String,
  contents: String,
) -> Result<String, String> {
  let safe = sanitize_app_data_project_file_name(&file_name)?;
  let dir = app_data_projects_dir(&app)?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let dest = dir.join(&safe);
  std::fs::write(&dest, contents).map_err(|e| e.to_string())?;
  Ok(dest.display().to_string())
}

fn sanitize_app_data_project_file_name(file_name: &str) -> Result<String, String> {
  let trimmed = file_name.trim().replace('\\', "/");
  let safe = trimmed
    .rsplit('/')
    .next()
    .unwrap_or("")
    .to_string();
  if safe.is_empty()
    || safe.contains("..")
    || !(safe.ends_with(".json") || safe.ends_with(".edgetx-project.json"))
  {
    return Err("fileName must be a *.json / *.edgetx-project.json basename".into());
  }
  Ok(safe)
}

fn app_data_projects_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
  Ok(app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join("projects"))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppDataProjectEntry {
  file_name: String,
  path: String,
  modified_ms: u64,
}

#[tauri::command]
fn list_app_data_projects(app: tauri::AppHandle) -> Result<Vec<AppDataProjectEntry>, String> {
  let dir = app_data_projects_dir(&app)?;
  if !dir.exists() {
    return Ok(Vec::new());
  }
  let mut projects = Vec::new();
  for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let file_type = entry.file_type().map_err(|e| e.to_string())?;
    if !file_type.is_file() {
      continue;
    }
    let file_name = entry.file_name().to_string_lossy().to_string();
    if sanitize_app_data_project_file_name(&file_name).is_err() {
      continue;
    }
    let modified_ms = entry
      .metadata()
      .and_then(|metadata| metadata.modified())
      .ok()
      .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
      .map(|duration| duration.as_millis() as u64)
      .unwrap_or(0);
    projects.push(AppDataProjectEntry {
      file_name,
      path: entry.path().display().to_string(),
      modified_ms,
    });
  }
  projects.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
  Ok(projects)
}

#[tauri::command]
fn read_app_data_project(app: tauri::AppHandle, file_name: String) -> Result<String, String> {
  let safe = sanitize_app_data_project_file_name(&file_name)?;
  let src = app_data_projects_dir(&app)?.join(safe);
  std::fs::read_to_string(src).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_app_data_project(app: tauri::AppHandle, file_name: String) -> Result<(), String> {
  let safe = sanitize_app_data_project_file_name(&file_name)?;
  let dest = app_data_projects_dir(&app)?.join(safe);
  if !dest.exists() {
    return Ok(());
  }
  std::fs::remove_file(dest).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::atomic::{AtomicU64, Ordering};

  static NEXT_TEMP_ID: AtomicU64 = AtomicU64::new(0);

  fn temp_sd_root() -> std::path::PathBuf {
    let id = NEXT_TEMP_ID.fetch_add(1, Ordering::Relaxed);
    let root = std::env::temp_dir().join(format!(
      "edgetx-dashboard-sd-test-{}-{id}",
      std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(root.join("WIDGETS")).expect("create test SD root");
    root
  }

  #[test]
  fn sd_install_overwrites_pack_with_live_widget_files() {
    let root = temp_sd_root();
    let files = vec![
      SdInstallFile {
        path: "WIDGETS/Test/main.lua".into(),
        content: "stale lua".into(),
        encoding: None,
      },
      SdInstallFile {
        path: "WIDGETS/Test/INSTALL.md".into(),
        content: "stale guide".into(),
        encoding: None,
      },
    ];

    install_widget_to_sd(
      root.display().to_string(),
      "Test".into(),
      "live lua".into(),
      Some("live guide".into()),
      Some(files),
    )
    .expect("install widget");

    assert_eq!(
      std::fs::read_to_string(root.join("WIDGETS/Test/main.lua")).unwrap(),
      "live lua"
    );
    assert_eq!(
      std::fs::read_to_string(root.join("WIDGETS/Test/INSTALL.md")).unwrap(),
      "live guide"
    );
    let _ = std::fs::remove_dir_all(root);
  }

  #[test]
  fn sd_install_rejects_other_widget_paths_and_too_many_files() {
    let root = temp_sd_root();
    let wrong_widget = vec![SdInstallFile {
      path: "WIDGETS/Other/main.lua".into(),
      content: "lua".into(),
      encoding: None,
    }];
    let error = install_widget_to_sd(
      root.display().to_string(),
      "Test".into(),
      "live".into(),
      None,
      Some(wrong_widget),
    )
    .unwrap_err();
    assert!(error.contains("unsafe SD path"));

    let too_many = (0..=MAX_SD_INSTALL_FILES)
      .map(|index| SdInstallFile {
        path: format!("SCRIPTS/TOOLS/file-{index}.lua"),
        content: String::new(),
        encoding: None,
      })
      .collect();
    let error = install_widget_to_sd(
      root.display().to_string(),
      "Test".into(),
      "live".into(),
      None,
      Some(too_many),
    )
    .unwrap_err();
    assert!(error.contains("too many files"));
    let _ = std::fs::remove_dir_all(root);
  }

  #[test]
  fn sd_install_requires_widgets_directory_and_caps_total_bytes() {
    let root = temp_sd_root();
    let error = install_widget_to_sd(
      root.display().to_string(),
      "Test".into(),
      "x".repeat(MAX_SD_INSTALL_BYTES + 1),
      None,
      None,
    )
    .unwrap_err();
    assert!(error.contains("exceeds 8 MB"));

    std::fs::remove_dir_all(root.join("WIDGETS")).unwrap();
    let error = install_widget_to_sd(
      root.display().to_string(),
      "Test".into(),
      "live".into(),
      None,
      None,
    )
    .unwrap_err();
    assert!(error.contains("must contain a WIDGETS directory"));
    let _ = std::fs::remove_dir_all(root);
  }

  #[cfg(unix)]
  #[test]
  fn sd_install_rejects_symlink_escape() {
    use std::os::unix::fs::symlink;

    let root = temp_sd_root();
    let outside = root.with_extension("outside");
    let _ = std::fs::remove_dir_all(&outside);
    std::fs::create_dir_all(&outside).unwrap();
    symlink(&outside, root.join("IMAGES")).unwrap();
    let files = vec![SdInstallFile {
      path: "IMAGES/model.png".into(),
      content: "image".into(),
      encoding: None,
    }];

    let error = install_widget_to_sd(
      root.display().to_string(),
      "Test".into(),
      "live".into(),
      None,
      Some(files),
    )
    .unwrap_err();
    assert!(error.contains("outside selected root"));
    let _ = std::fs::remove_dir_all(root);
    let _ = std::fs::remove_dir_all(outside);
  }

  #[cfg(unix)]
  #[test]
  fn sd_install_resolves_all_destinations_before_writing() {
    use std::os::unix::fs::symlink;

    let root = temp_sd_root();
    let outside = root.with_extension("outside");
    let _ = std::fs::remove_dir_all(&outside);
    std::fs::create_dir_all(&outside).unwrap();
    symlink(&outside, root.join("WIDGETS/Test")).unwrap();
    let files = vec![SdInstallFile {
      path: "SCRIPTS/TOOLS/helper.lua".into(),
      content: "helper".into(),
      encoding: None,
    }];

    let error = install_widget_to_sd(
      root.display().to_string(),
      "Test".into(),
      "live".into(),
      None,
      Some(files),
    )
    .unwrap_err();

    assert!(error.contains("outside selected root"));
    assert!(!root.join("SCRIPTS/TOOLS/helper.lua").exists());
    let _ = std::fs::remove_dir_all(root);
    let _ = std::fs::remove_dir_all(outside);
  }

  #[test]
  fn sanitize_app_data_project_file_name_strips_paths_and_rejects_traversal() {
    assert_eq!(
      sanitize_app_data_project_file_name("folder\\nested/project.edgetx-project.json")
        .unwrap(),
      "project.edgetx-project.json"
    );
    assert!(sanitize_app_data_project_file_name("../..").is_err());
    assert!(sanitize_app_data_project_file_name("project.txt").is_err());
    assert!(sanitize_app_data_project_file_name("   ").is_err());
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(SidecarState(Mutex::new(None)))
    .invoke_handler(tauri::generate_handler![
      install_widget_to_sd,
      save_text_with_dialog,
      save_bytes_with_dialog,
      open_text_with_dialog,
      write_text_file,
      write_bytes_file,
      read_text_file,
      write_app_data_project,
      list_app_data_projects,
      read_app_data_project,
      delete_app_data_project
    ])
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
