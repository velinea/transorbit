import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function openDb({ dataDir }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'transorbit.sqlite');
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

export function migrate(db, schemaPath) {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(sql);
}
