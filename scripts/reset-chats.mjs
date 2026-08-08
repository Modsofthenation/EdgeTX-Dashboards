#!/usr/bin/env node
/**
 * Clear SQLite chat history (delete files or wipe tables if the DB is locked by the dev server).
 * Usage: npm run reset-chats
 * Optional: WIDGET_GEN_DATA_DIR=/path/to/data
 */
import { createRequire } from "node:module";
import { existsSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const dataDir = process.env.WIDGET_GEN_DATA_DIR
  ? resolve(process.env.WIDGET_GEN_DATA_DIR)
  : join(repoRoot, "data");
const dbPath = join(dataDir, "chats.db");

function clearViaSql() {
  const require = createRequire(join(repoRoot, "apps", "web", "package.json"));
  const Database = require("better-sqlite3");
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(
    `DELETE FROM chat_artifacts; DELETE FROM chat_messages; DELETE FROM chats;`,
  );
  db.close();
  console.log(
    `Cleared all chats in ${dbPath} (tables wiped — dev server may still hold the file open).`,
  );
}

if (!existsSync(dbPath)) {
  console.log(`No chat database found under ${dataDir}`);
  process.exit(0);
}

try {
  unlinkSync(dbPath);
  for (const sidecar of ["-wal", "-shm"]) {
    const path = `${dbPath}${sidecar}`;
    if (existsSync(path)) unlinkSync(path);
  }
  console.log(`Removed ${dbPath}`);
  console.log("Chat history cleared.");
} catch (err) {
  const code =
    err && typeof err === "object" && "code" in err ? String(err.code) : "";
  if (code === "EBUSY" || code === "EPERM") {
    clearViaSql();
  } else {
    throw err;
  }
}
