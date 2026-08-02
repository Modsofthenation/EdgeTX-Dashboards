fn main() {
  // Autogenerate allow-/deny- permissions for every #[tauri::command]. Required
  // for the Next.js sidecar / desktop:dev webview (http://localhost / 127.0.0.1),
  // which Tauri treats as a remote origin and ACL-gates even without this list.
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(
      tauri_build::AppManifest::new().commands(&[
        "install_widget_to_sd",
        "save_text_with_dialog",
        "save_bytes_with_dialog",
        "open_text_with_dialog",
        "write_text_file",
        "write_bytes_file",
        "read_text_file",
        "write_app_data_project",
        "list_app_data_projects",
        "read_app_data_project",
        "delete_app_data_project",
      ]),
    ),
  )
  .expect("failed to run tauri-build");
}
