import Database from 'better-sqlite3';
import { logger } from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class HistoryStore {
  constructor() {
    this.db = new Database(path.join(__dirname, '../../data/history.db'));
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS approval_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        event_type TEXT,
        message TEXT,
        action TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('History database initialized');
  }

  addRecord(requestId, eventType, message, action) {
    const stmt = this.db.prepare(
      'INSERT INTO approval_history (request_id, event_type, message, action) VALUES (?, ?, ?, ?)'
    );
    stmt.run(requestId, eventType, message, action);
    logger.info(`History record added: ${request_id} - ${action}`);
  }

  getHistory(limit = 10) {
    const stmt = this.db.prepare(
      'SELECT * FROM approval_history ORDER BY created_at DESC LIMIT ?'
    );
    return stmt.all(limit);
  }

  exportToJson() {
    const stmt = this.db.prepare('SELECT * FROM approval_history ORDER BY created_at DESC');
    return JSON.stringify(stmt.all(), null, 2);
  }

  exportToCsv() {
    const stmt = this.db.prepare('SELECT * FROM approval_history ORDER BY created_at DESC');
    const rows = stmt.all();
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]).join(',');
    const csvRows = rows.map(row => Object.values(row).join(','));
    return [headers, ...csvRows].join('\n');
  }

  close() {
    this.db.close();
  }
}
