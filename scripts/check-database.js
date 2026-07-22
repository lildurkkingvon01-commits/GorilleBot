#!/usr/bin/env node
/**
 * Database Check Script - Verify all logging tables
 * Check what data is being stored and if dashboard can read it
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'gorille_bot.db');

console.log('\n╔════════════════════════════════════════╗');
console.log('║    DATABASE CHECK - Verify Logging     ║');
console.log('╚════════════════════════════════════════╝\n');

try {
  const db = new Database(dbPath);
  console.log(`✅ Database opened: ${dbPath}\n`);

  // Check all logging tables
  const tables = {
    'audit_logs': 'Command execution logging',
    'discord_events': 'Event logging (commands, moderation, automod)',
    'moderation_actions': 'Moderation actions (ban, kick, mute, warn)',
    'guild_configs': 'Server configurations',
    'saved_players': 'Saved players',
    'saved_factions': 'Saved factions'
  };

  console.log('📊 TABLE STATUS:\n');
  
  for (const [table, description] of Object.entries(tables)) {
    try {
      const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      const columns = db.prepare(`PRAGMA table_info(${table})`).all();
      
      console.log(`\n✅ ${table}`);
      console.log(`   Description: ${description}`);
      console.log(`   Rows: ${result?.count || 0}`);
      console.log(`   Columns: ${columns.map(c => c.name).join(', ')}`);
      
      if (result?.count > 0) {
        const sample = db.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 1`).get();
        console.log(`   📌 Latest entry:`);
        for (const [key, value] of Object.entries(sample || {})) {
          const val = typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value;
          console.log(`      ${key}: ${val}`);
        }
      }
    } catch (err) {
      console.log(`\n❌ ${table}`);
      console.log(`   Error: ${err.message}`);
    }
  }

  // Check specific data for dashboard
  console.log('\n\n📊 DASHBOARD DATA CHECK:\n');

  try {
    const commandsToday = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE action = 'command_used' 
      AND datetime(created_at) > datetime('now', '-1 day')
    `).get();
    console.log(`✅ Commands Today: ${commandsToday?.count || 0}`);
  } catch (err) {
    console.log(`❌ Commands Today Error: ${err.message}`);
  }

  try {
    const topCommands = db.prepare(`
      SELECT json_extract(details, '$.commandName') as name, COUNT(*) as count
      FROM audit_logs
      WHERE action = 'command_used'
      GROUP BY name
      ORDER BY count DESC
      LIMIT 5
    `).all();
    console.log(`✅ Top Commands:`, topCommands.length > 0 ? topCommands : 'None yet');
  } catch (err) {
    console.log(`❌ Top Commands Error: ${err.message}`);
  }

  try {
    const moderationToday = db.prepare(`
      SELECT COUNT(*) as count FROM moderation_actions
      WHERE datetime(created_at) > datetime('now', '-1 day')
    `).get();
    console.log(`✅ Moderation Today: ${moderationToday?.count || 0}`);
  } catch (err) {
    console.log(`❌ Moderation Today Error: ${err.message}`);
  }

  try {
    const uniqueUsers = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count FROM audit_logs
    `).get();
    console.log(`✅ Unique Users (audit_logs): ${uniqueUsers?.count || 0}`);
  } catch (err) {
    console.log(`❌ Unique Users Error: ${err.message}`);
  }

  try {
    const eventUsers = db.prepare(`
      SELECT COUNT(DISTINCT executor_id) as count FROM discord_events
      WHERE executor_id IS NOT NULL
    `).get();
    console.log(`✅ Unique Users (discord_events): ${eventUsers?.count || 0}`);
  } catch (err) {
    console.log(`❌ Event Users Error: ${err.message}`);
  }

  try {
    const servers = db.prepare(`
      SELECT COUNT(DISTINCT guild_id) as count FROM guild_configs
    `).get();
    console.log(`✅ Configured Servers: ${servers?.count || 0}`);
  } catch (err) {
    console.log(`❌ Servers Error: ${err.message}`);
  }

  try {
    const savedPlayers = db.prepare(`
      SELECT COUNT(*) as count FROM saved_players
    `).get();
    console.log(`✅ Saved Players: ${savedPlayers?.count || 0}`);
  } catch (err) {
    console.log(`❌ Saved Players Error: ${err.message}`);
  }

  // Show recent events
  console.log('\n\n📝 RECENT EVENTS (Last 5):\n');
  try {
    const events = db.prepare(`
      SELECT * FROM discord_events 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();
    
    if (events.length === 0) {
      console.log('   (No events logged yet)');
    } else {
      events.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.event_type} (ID: ${e.executor_id}) at ${e.created_at}`);
        if (e.details) {
          try {
            const details = JSON.parse(e.details);
            console.log(`      Details: ${JSON.stringify(details)}`);
          } catch {}
        }
      });
    }
  } catch (err) {
    console.log(`   Error fetching events: ${err.message}`);
  }

  // Show recent commands
  console.log('\n📝 RECENT COMMANDS (Last 5):\n');
  try {
    const commands = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE action = 'command_used'
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();
    
    if (commands.length === 0) {
      console.log('   (No commands logged yet)');
    } else {
      commands.forEach((c, i) => {
        const details = c.details ? JSON.parse(c.details) : {};
        console.log(`   ${i + 1}. /${details.commandName || 'unknown'} by ${c.user_id} at ${c.created_at}`);
      });
    }
  } catch (err) {
    console.log(`   Error fetching commands: ${err.message}`);
  }

  db.close();

  console.log('\n════════════════════════════════════════');
  console.log('✅ CHECK COMPLETE!\n');
  console.log('ℹ️  If all counts show 0, then the bot is not logging data.');
  console.log('   Execute a Discord command (/save, /delete, etc.) to test logging.\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
