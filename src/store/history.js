import Database from 'better-sqlite3';
import { logger } from '../logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class HistoryStore {
  constructor() {
    this.db = null;
    this._init();
  }

  _init() {
    try {
      const dbPath = path.join(__dirname, '../../data/history.db');
      const dbDir = path.dirname(dbPath);
      
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      this.db = new Database(dbPath);
      this._createTables();
      logger.info('History database initialized');
    } catch (error) {
      logger.error('Failed to initialize history database:', error);
      this.db = null;
    }
  }

  _createTables() {
    if (!this.db) return;
    
    try {
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
    } catch (error) {
      logger.error('Failed to create history tables:', error);
    }
  }

  addRecord(requestId, eventType, message, action) {
    if (!this.db) {
      logger.warn('Database not initialized, cannot add record');
      return;
    }
    
    try {
      const stmt = this.db.prepare(
        'INSERT INTO approval_history (request_id, event_type, message, action) VALUES (?, ?, ?, ?)'
      );
      stmt.run(requestId, eventType, message, action);
      logger.info(`History record added: ${requestId} - ${action}`);
    } catch (error) {
      logger.error('Failed to add history record:', error, { requestId, eventType, action });
    }
  }

  getHistory(limit = 10) {
    if (!this.db) {
      logger.warn('Database not initialized, returning empty history');
      return [];
    }
    
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM approval_history ORDER BY created_at DESC LIMIT ?'
      );
      return stmt.all(limit);
    } catch (error) {
      logger.error('Failed to get history:', error);
      return [];
    }
  }

  exportToJson() {
    if (!this.db) {
      logger.warn('Database not initialized, cannot export JSON');
      return null;
    }
    
    try {
      const stmt = this.db.prepare('SELECT * FROM approval_history ORDER BY created_at DESC');
      return JSON.stringify(stmt.all(), null, 2);
    } catch (error) {
      logger.error('Failed to export to JSON:', error);
      return null;
    }
  }

  exportToCsv() {
    if (!this.db) {
      logger.warn('Database not initialized, cannot export CSV');
      return null;
    }
    
    try {
      const stmt = this.db.prepare('SELECT * FROM approval_history ORDER BY created_at DESC');
      const rows = stmt.all();
      if (rows.length === 0) return '';

      const headers = Object.keys(rows[0]).join(',');
      const csvRows = rows.map(row => Object.values(row).join(','));
      return [headers, ...csvRows].join('\n');
    } catch (error) {
      logger.error('Failed to export to CSV:', error);
      return null;
    }
  }

  close() {
    if (!this.db) return;
    
    try {
      this.db.close();
      logger.info('History database closed');
    } catch (error) {
      logger.error('Failed to close history database:', error);
    }
  }
}
