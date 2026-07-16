import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import type { Campaign } from "./types";

const LS_KEY = "mpfm-calibration-v2-db";
const LS_ACTIVE = "mpfm-calibration-v2-active";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function initDb(): Promise<void> {
  if (db) return;
  SQL = await initSqlJs({
    locateFile: (f: string) => `./${f}`,
  });
  const stored = localStorage.getItem(LS_KEY);
  if (stored) {
    try {
      db = new SQL.Database(b64decode(stored));
    } catch {
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }
  db.run(SCHEMA);
  persist();
}

function persist(): void {
  if (!db) return;
  const data = db.export();
  try {
    localStorage.setItem(LS_KEY, b64encode(data));
  } catch (e) {
    console.warn("localStorage cheio — não foi possível persistir DB", e);
  }
}

export function listCampaigns(): { id: string; updated_at: string }[] {
  if (!db) return [];
  const res = db.exec(
    "SELECT id, updated_at FROM campaigns ORDER BY updated_at DESC"
  );
  if (!res.length) return [];
  return res[0].values.map((r) => ({
    id: String(r[0]),
    updated_at: String(r[1]),
  }));
}

export function loadCampaign(id: string): Campaign | null {
  if (!db) return null;
  const stmt = db.prepare("SELECT payload FROM campaigns WHERE id = :id");
  stmt.bind({ ":id": id });
  const has = stmt.step();
  const row = has ? stmt.getAsObject() : null;
  stmt.free();
  if (!row || !row.payload) return null;
  try {
    return JSON.parse(String(row.payload)) as Campaign;
  } catch {
    return null;
  }
}

export function saveCampaign(c: Campaign): void {
  if (!db) return;
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO campaigns (id, payload, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    [c.id, JSON.stringify(c), now]
  );
  persist();
}

export function deleteCampaign(id: string): void {
  if (!db) return;
  db.run("DELETE FROM campaigns WHERE id = ?", [id]);
  persist();
}

export function setActive(id: string): void {
  localStorage.setItem(LS_ACTIVE, id);
}
export function getActive(): string | null {
  return localStorage.getItem(LS_ACTIVE);
}

export function exportDbBlob(): Uint8Array {
  if (!db) return new Uint8Array();
  return db.export();
}

export async function importDbBlob(bytes: Uint8Array): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (f: string) => `./${f}`,
    });
  }
  db?.close();
  db = new SQL.Database(bytes);
  db.run(SCHEMA);
  persist();
}
