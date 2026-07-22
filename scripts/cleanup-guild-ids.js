/**
 * Cleanup Database - Remove/Fix Invalid Guild IDs
 * This script identifies and fixes players with invalid guild_id values
 */

import db from './src/utils/postgres.js';

async function cleanupInvalidGuildIds() {
  console.log('🔍 Starting database cleanup for invalid guild_id values...\n');

  try {
    // ============================================
    // 1. IDENTIFY invalid entries in players table
    // ============================================
    console.log('📋 [players] Checking for invalid guild_id...');
    const invalidPlayers = await db.any(
      `SELECT id, discord_id, username, guild_id FROM players 
       WHERE guild_id IS NULL OR guild_id = $1 OR guild_id = $2`,
      ['undefined', 'null']
    );
    
    if (invalidPlayers.length > 0) {
      console.log(`⚠️ Found ${invalidPlayers.length} players with invalid guild_id:`);
      invalidPlayers.forEach(p => {
        console.log(`   - ID: ${p.id}, Username: ${p.username}, guild_id: ${p.guild_id}`);
      });
      
      // Delete invalid players
      const deleteResult = await db.result(
        `DELETE FROM players WHERE guild_id IS NULL OR guild_id = $1 OR guild_id = $2`,
        ['undefined', 'null']
      );
      console.log(`✅ Deleted ${deleteResult.rowCount} invalid player entries\n`);
    } else {
      console.log('✅ No invalid guild_id found in players table\n');
    }

    // ============================================
    // 2. IDENTIFY invalid entries in saved_players table
    // ============================================
    console.log('📋 [saved_players] Checking for invalid guild_id...');
    const invalidSavedPlayers = await db.any(
      `SELECT id, username, url, guild_id FROM saved_players 
       WHERE guild_id IS NULL OR guild_id = $1 OR guild_id = $2`,
      ['undefined', 'null']
    );
    
    if (invalidSavedPlayers.length > 0) {
      console.log(`⚠️ Found ${invalidSavedPlayers.length} saved players with invalid guild_id:`);
      invalidSavedPlayers.forEach(p => {
        console.log(`   - ID: ${p.id}, Username: ${p.username}, URL: ${p.url}, guild_id: ${p.guild_id}`);
      });
      
      // Delete invalid saved players
      const deleteResult = await db.result(
        `DELETE FROM saved_players WHERE guild_id IS NULL OR guild_id = $1 OR guild_id = $2`,
        ['undefined', 'null']
      );
      console.log(`✅ Deleted ${deleteResult.rowCount} invalid saved_player entries\n`);
    } else {
      console.log('✅ No invalid guild_id found in saved_players table\n');
    }

    // ============================================
    // 3. IDENTIFY invalid entries in saved_factions table
    // ============================================
    console.log('📋 [saved_factions] Checking for invalid guild_id...');
    const invalidFactions = await db.any(
      `SELECT id, faction_name, url, guild_id FROM saved_factions 
       WHERE guild_id IS NULL OR guild_id = $1 OR guild_id = $2`,
      ['undefined', 'null']
    );
    
    if (invalidFactions.length > 0) {
      console.log(`⚠️ Found ${invalidFactions.length} factions with invalid guild_id:`);
      invalidFactions.forEach(f => {
        console.log(`   - ID: ${f.id}, Faction: ${f.faction_name}, URL: ${f.url}, guild_id: ${f.guild_id}`);
      });
      
      // Delete invalid factions
      const deleteResult = await db.result(
        `DELETE FROM saved_factions WHERE guild_id IS NULL OR guild_id = $1 OR guild_id = $2`,
        ['undefined', 'null']
      );
      console.log(`✅ Deleted ${deleteResult.rowCount} invalid faction entries\n`);
    } else {
      console.log('✅ No invalid guild_id found in saved_factions table\n');
    }

    // ============================================
    // 4. SUMMARY
    // ============================================
    console.log('📊 Final Database Status:\n');
    
    const playerCount = await db.one('SELECT COUNT(*) as count FROM players');
    const savedPlayerCount = await db.one('SELECT COUNT(*) as count FROM saved_players');
    const factionCount = await db.one('SELECT COUNT(*) as count FROM saved_factions');
    
    console.log(`📌 players: ${playerCount.count} entries (all with valid guild_id)`);
    console.log(`📌 saved_players: ${savedPlayerCount.count} entries (all with valid guild_id)`);
    console.log(`📌 saved_factions: ${factionCount.count} entries (all with valid guild_id)`);
    
    console.log('\n✅ Database cleanup completed successfully!');
    console.log('🔐 All entries now have valid guild_id values (or are NULL for global items)\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupInvalidGuildIds();
