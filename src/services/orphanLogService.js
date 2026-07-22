import { getDb } from '../utils/database.js';
import { logToChannelAsync, createLogEmbed } from '../utils/adminLogs.js';

class OrphanLogService {
  static async init() {
    const db = getDb();
    await db.none(`
      CREATE TABLE IF NOT EXISTS orphan_attempts (
        id SERIAL PRIMARY KEY,
        called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source TEXT,
        details JSONB
      );
    `);
  }

  static async record(source, details = {}) {
    try {
      const db = getDb();
      await db.none('INSERT INTO orphan_attempts (source, details) VALUES ($1, $2)', [source, details]);
      const embed = createLogEmbed(
        'Tentative d\'insertion orpheline bloquée',
        'Source: ' + source + '\nDétails: ' + JSON.stringify(details),
        'admin'
      );
      if (embed) {
        logToChannelAsync('admin', embed);
      }
    } catch (e) {
      console.error('[OrphanLog] Failed to record orphan attempt:', e.message || e);
    }
  }

  static async list(limit = 50) {
    try {
      const db = getDb();
      return await db.any('SELECT * FROM orphan_attempts ORDER BY called_at DESC LIMIT $1', [limit]);
    } catch (e) {
      console.error('[OrphanLog] Failed to list:', e.message || e);
      return [];
    }
  }
}

export default OrphanLogService;
