import { Suspense } from "react";
import { EditorApp } from "./EditorApp";
import styles from "./editor.module.css";

function EditorLoading() {
  return (
    <div className={styles.editorRoot}>
      <div className={styles.loadingState}>
        <div className={styles.loadingSpinner} aria-hidden />
        <p>Loading editor…</p>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorLoading />}>
      <EditorApp />
    </Suspense>
  );
}
