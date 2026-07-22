/**
 * Migration: Create missing tables for full admin panel
 * This migration adds all tables needed for a complete admin panel
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'gorille_bot.db');

console.log('🔧 Running migration: Create missing tables for admin panel\n');

try {
  const db = new Database(dbPath);

  // Helper function to check if table exists
  const tableExists = (tableName) => {
    const result = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    return !!result;
  };

  // Helper function to check if column exists
  const columnExists = (tableName, columnName) => {
    const result = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return result.some(col => col.name === columnName);
  };

  // 1. command_status table
  if (!tableExists('command_status')) {
    console.log('📝 Creating command_status table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS command_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        command_name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, command_name)
      )
    `);
    console.log('✅ command_status created');
  } else {
    console.log('✅ command_status already exists');
  }

  // 2. command_cooldown table
  if (!tableExists('command_cooldown')) {
    console.log('📝 Creating command_cooldown table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS command_cooldown (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        command_name TEXT NOT NULL,
        cooldown_ms INTEGER DEFAULT 0,
        cooldown_type TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, command_name)
      )
    `);
    console.log('✅ command_cooldown created');
  } else {
    console.log('✅ command_cooldown already exists');
  }

  // 3. role_permissions table
  if (!tableExists('role_permissions')) {
    console.log('📝 Creating role_permissions table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        command_name TEXT NOT NULL,
        allowed INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, role_id, command_name)
      )
    `);
    console.log('✅ role_permissions created');
  } else {
    console.log('✅ role_permissions already exists');
  }

  // 4. command_permissions table (global per command)
  if (!tableExists('command_permissions')) {
    console.log('📝 Creating command_permissions table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS command_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command_name TEXT UNIQUE NOT NULL,
        required_permissions TEXT,
        required_roles TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ command_permissions created');
  } else {
    console.log('✅ command_permissions already exists');
  }

  // 5. guild_modules table
  if (!tableExists('guild_modules')) {
    console.log('📝 Creating guild_modules table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS guild_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT UNIQUE NOT NULL,
        automod_enabled INTEGER DEFAULT 1,
        moderation_enabled INTEGER DEFAULT 1,
        logs_enabled INTEGER DEFAULT 1,
        tickets_enabled INTEGER DEFAULT 1,
        announcements_enabled INTEGER DEFAULT 1,
        broadcast_enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ guild_modules created');
  } else {
    console.log('✅ guild_modules already exists');
  }

  // 6. announcements table
  if (!tableExists('announcements')) {
    console.log('📝 Creating announcements table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        title TEXT,
        message TEXT NOT NULL,
        scheduled_for DATETIME,
        sent_at DATETIME,
        status TEXT DEFAULT 'draft',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ announcements created');
  } else {
    console.log('✅ announcements already exists');
  }

  // 7. tickets table
  if (!tableExists('tickets')) {
    console.log('📝 Creating tickets table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        ticket_id TEXT UNIQUE NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT,
        subject TEXT,
        description TEXT,
        status TEXT DEFAULT 'open',
        assigned_to TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ tickets created');
  } else {
    console.log('✅ tickets already exists');
  }

  // 8. ticket_messages table
  if (!tableExists('ticket_messages')) {
    console.log('📝 Creating ticket_messages table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT,
        message TEXT NOT NULL,
        message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
      )
    `);
    console.log('✅ ticket_messages created');
  } else {
    console.log('✅ ticket_messages already exists');
  }

  // 9. automod_config table
  if (!tableExists('automod_config')) {
    console.log('📝 Creating automod_config table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS automod_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT UNIQUE NOT NULL,
        spam_enabled INTEGER DEFAULT 1,
        spam_threshold INTEGER DEFAULT 5,
        flood_enabled INTEGER DEFAULT 1,
        flood_threshold INTEGER DEFAULT 10,
        mention_spam_enabled INTEGER DEFAULT 1,
        mention_limit INTEGER DEFAULT 3,
        banned_links_enabled INTEGER DEFAULT 1,
        banned_links TEXT,
        banned_words_enabled INTEGER DEFAULT 0,
        banned_words TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ automod_config created');
  } else {
    console.log('✅ automod_config already exists');
  }

  // 10. automod_actions table
  if (!tableExists('automod_actions')) {
    console.log('📝 Creating automod_actions table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS automod_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT,
        action_type TEXT,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ automod_actions created');
  } else {
    console.log('✅ automod_actions already exists');
  }

  // 11. command_usage table (enhanced audit)
  if (!tableExists('command_usage')) {
    console.log('📝 Creating command_usage table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS command_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT,
        command_name TEXT NOT NULL,
        args TEXT,
        success INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ command_usage created');
  } else {
    console.log('✅ command_usage already exists');
  }

  // 12. maintenance_config table
  if (!tableExists('maintenance_config')) {
    console.log('📝 Creating maintenance_config table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS maintenance_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enabled INTEGER DEFAULT 0,
        message TEXT DEFAULT 'Le bot est actuellement en maintenance.',
        enabled_by TEXT,
        enabled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ maintenance_config created');
  } else {
    console.log('✅ maintenance_config already exists');
  }

  // 13. bot_settings table
  if (!tableExists('bot_settings')) {
    console.log('📝 Creating bot_settings table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ bot_settings created');
  } else {
    console.log('✅ bot_settings already exists');
  }

  // Check if guild_configs has prefix column
  if (!columnExists('guild_configs', 'prefix')) {
    console.log('📝 Adding prefix column to guild_configs...');
    db.exec(`ALTER TABLE guild_configs ADD COLUMN prefix TEXT DEFAULT '/'`);
    console.log('✅ prefix column added');
  } else {
    console.log('✅ prefix column already exists in guild_configs');
  }

  // Check if audit_logs is complete
  if (!tableExists('audit_logs')) {
    console.log('📝 Creating audit_logs table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        user_id TEXT,
        action_type TEXT NOT NULL,
        action_details TEXT,
        status TEXT DEFAULT 'success',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ audit_logs created');
  } else {
    console.log('✅ audit_logs already exists');
  }

  // Summary
  console.log('\n📊 Table Summary:');
  const tables = [
    'guild_configs', 'command_status', 'command_cooldown', 'role_permissions',
    'command_permissions', 'guild_modules', 'announcements', 'tickets',
    'ticket_messages', 'automod_config', 'automod_actions', 'command_usage',
    'maintenance_config', 'bot_settings', 'audit_logs', 'players',
    'saved_players', 'discord_events', 'moderation_actions'
  ];

  for (const table of tables) {
    if (tableExists(table)) {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
      console.log(`   ✅ ${table.padEnd(25)} (${count} rows)`);
    } else {
      console.log(`   ❌ ${table.padEnd(25)} (NOT FOUND)`);
    }
  }

  db.close();
  console.log('\n✅ Migration completed successfully!\n');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
