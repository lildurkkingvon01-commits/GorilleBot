#!/usr/bin/env node
import { getDb } from '../src/utils/database.js';

async function main() {
  const db = getDb();

  try {
    const orphans = await db.any("SELECT id, discord_id, username, url, guild_id, created_at FROM players WHERE guild_id IS NULL OR guild_id = ''");
    console.log(`Found ${orphans.length} orphan player(s)`);

    if (orphans.length === 0) {
      console.log('No orphans to process.');
      process.exit(0);
    }

    console.log('Creating backup table if needed...');
    await db.none('CREATE TABLE IF NOT EXISTS players_orphans_backup (LIKE players INCLUDING ALL)');

    console.log('Backing up orphan rows...');
    await db.none("INSERT INTO players_orphans_backup SELECT * FROM players WHERE guild_id IS NULL OR guild_id = ''");

    const backupCount = await db.one('SELECT COUNT(*) as count FROM players_orphans_backup');
    console.log(`Backup table now contains ${backupCount.count} row(s)`);

    console.log('Deleting orphan rows from players...');
    const del = await db.result("DELETE FROM players WHERE guild_id IS NULL OR guild_id = ''");
    console.log(`Deleted ${del.rowCount} orphan row(s) from players`);

    console.log('Orphan cleanup complete.');
    process.exit(0);
  } catch (e) {
    console.error('Error during orphan cleanup:', e);
    process.exit(2);
  }
}

main();
