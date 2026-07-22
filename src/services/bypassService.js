import db from '../utils/postgres.js';

class BypassService {
  static async init() {
    try {
      await db.none(`
        CREATE TABLE IF NOT EXISTS bypass_users (
          id SERIAL PRIMARY KEY,
          discord_id TEXT UNIQUE NOT NULL,
          added_by TEXT,
          note TEXT,
          added_at TIMESTAMP DEFAULT NOW()
        )
      `);
      // Ensure the note column exists (in case table was created earlier without it)
      await db.none(`ALTER TABLE bypass_users ADD COLUMN IF NOT EXISTS note TEXT`);
      console.log('[BypassService] Table bypass_users ready');
    } catch (e) {
      console.error('[BypassService] init error:', e.message || e);
    }
  }

  static async add(discordId, addedBy = null, note = null) {
    try {
      await db.none('INSERT INTO bypass_users (discord_id, added_by, note) VALUES ($1, $2, $3) ON CONFLICT (discord_id) DO UPDATE SET added_by = EXCLUDED.added_by, note = EXCLUDED.note', [discordId, addedBy, note]);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  static async remove(discordId) {
    try {
      await db.none('DELETE FROM bypass_users WHERE discord_id = $1', [discordId]);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  static async list() {
    try {
      return await db.any('SELECT discord_id, added_by, note, added_at FROM bypass_users ORDER BY added_at DESC');
    } catch (e) {
      return [];
    }
  }

  static async isBypassed(discordId) {
    try {
      const row = await db.oneOrNone('SELECT discord_id FROM bypass_users WHERE discord_id = $1', [discordId]);
      return !!row;
    } catch (e) {
      return false;
    }
  }
}

export default BypassService;
