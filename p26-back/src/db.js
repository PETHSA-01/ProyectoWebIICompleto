import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'nexoplay.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'db.sql');

const isNewDatabase = !fs.existsSync(DB_PATH);

export const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

if (isNewDatabase || process.env.RESET_DB === 'true') {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  console.log(`Base de datos inicializada en ${DB_PATH}`);
}
