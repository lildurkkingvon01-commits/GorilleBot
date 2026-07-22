#!/usr/bin/env node
import { getDb } from '../src/utils/database.js';

async function main() {
  const db = getDb();
  try {
    const rows = await db.any(`
      SELECT id, discord_id, username, url, guild_id, created_at
      FROM players
      WHERE guild_id IS NULL
         OR guild_id = ''
         OR LOWER(guild_id) = 'undefined'
        OR NOT (guild_id ~ '^\\d{5,}$')
      ORDER BY created_at DESC
      LIMIT 500
    `);

    console.log(`Found ${rows.length} suspicious player row(s):`);
    for (const r of rows) {
      console.log(JSON.stringify(r));
    }
    process.exit(0);
  } catch (e) {
    console.error('Error listing orphans:', e);
    process.exit(2);
  }
}

main();
