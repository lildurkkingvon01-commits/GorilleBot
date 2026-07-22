/**
 * Guild Sync Service
 * Synchronizes Discord guild data to PostgreSQL database in real-time
 *
 * Events handled:
 * - ready: Sync all guilds on bot startup
 * - guildCreate: Insert new guild
 * - guildDelete: Set bot_present=false
 * - guildMemberAdd: Increment member_count
 * - guildMemberRemove: Decrement member_count
 */

import db from '../utils/postgres.js';

class GuildSyncService {
  /**
   * READY EVENT: Sync all guilds from Discord cache to DB
   * Called once when bot connects
   */
  static async syncAllGuilds(client) {
    try {
      console.log(`[GUILD SYNC] Starting sync for ${client.guilds.cache.size} guilds...`);

      const syncPromises = [];

      for (const [, guild] of client.guilds.cache) {
        syncPromises.push(this.syncGuild(guild, true));
      }

      const results = await Promise.allSettled(syncPromises);
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      console.log(`[GUILD SYNC] ✅ Synced ${succeeded} guilds (${failed} failed)`);
      return { succeeded, failed };
    } catch (error) {
      console.error('[GUILD SYNC] Error during startup sync:', error);
      return { succeeded: 0, failed: -1 };
    }
  }

  /**
   * Sync single guild data to DB
   * Upserts: id, name, icon_url, member_count, bot_present
   */
  static async syncGuild(guild, isReady = false) {
    try {
      if (!guild || !guild.id) {
        console.warn('[GUILD SYNC] Invalid guild object');
        return null;
      }

      const guildData = {
        id: guild.id,
        name: guild.name,
        icon_url: guild.iconURL({ dynamic: true, size: 256 }) || null,
        member_count: guild.memberCount || 0,
        bot_present: true,
      };

      const upserted = await db.one(`
        INSERT INTO guilds (id, name, icon_url, member_count, bot_present, updated_at)
        VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP)
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          icon_url = EXCLUDED.icon_url,
          member_count = EXCLUDED.member_count,
          bot_present = TRUE,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, icon_url, member_count, bot_present, created_at, updated_at
      `, [guildData.id, guildData.name, guildData.icon_url, guildData.member_count]);

      if (!isReady) {
        console.log(`[GUILD SYNC] ✅ Guild synced: ${guild.name} (${guild.id}) - Members: ${guild.memberCount}`);
      }

      try {
        const existing = await db.oneOrNone('SELECT * FROM guild_configs WHERE guild_id = $1', [guild.id]);
        if (!existing) {
          await db.one('INSERT INTO guild_configs (guild_id) VALUES ($1) RETURNING *', [guild.id]);
          if (!isReady) console.log(`[GUILD SYNC] ✅ Created guild_config for ${guild.id}`);
        }
      } catch (configErr) {
        console.warn(`[GUILD SYNC] ⚠️ Could not ensure guild_config for ${guild.id}:`, configErr.message);
      }

      return upserted;
    } catch (error) {
      console.error(`[GUILD SYNC] Error syncing guild ${guild?.id}:`, error);
      throw error;
    }
  }

  /**
   * GUILD DELETE EVENT: Set bot_present=false (don't delete record)
   * Preserves historical data and settings
   */
  static async handleGuildDelete(guildId) {
    try {
      const updated = await db.oneOrNone(
        `UPDATE guilds SET bot_present = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [guildId]
      );

      if (updated) {
        console.log(`[GUILD SYNC] 🔴 Guild marked as left: ${updated.name} (${guildId})`);
        return updated;
      }

      console.log(`[GUILD SYNC] Guild not in DB, creating with bot_present=false: ${guildId}`);
      return db.one(
        `INSERT INTO guilds (id, name, bot_present, updated_at) VALUES ($1, $2, FALSE, CURRENT_TIMESTAMP) RETURNING *`,
        [guildId, `Serveur ${guildId.substring(0, 8)}`]
      );
    } catch (error) {
      console.error(`[GUILD SYNC] Error handling guildDelete:`, error);
      throw error;
    }
  }

  /**
   * GUILD MEMBER ADD: Increment member_count
   */
  static async handleMemberAdd(guild) {
    try {
      if (!guild) return null;

      const updated = await db.one(`
        INSERT INTO guilds (id, name, member_count, bot_present, updated_at)
        VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP)
        ON CONFLICT (id)
        DO UPDATE SET
          member_count = EXCLUDED.member_count,
          bot_present = TRUE,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [guild.id, guild.name || `Serveur ${guild.id.substring(0, 8)}`, guild.memberCount || 0]);

      if (guild.memberCount % 10 === 0) {
        console.log(`[GUILD SYNC] 👤+ Member added to ${guild.name}: ${guild.memberCount} members`);
      }

      return updated;
    } catch (error) {
      console.error(`[GUILD SYNC] Error in handleMemberAdd:`, error);
      throw error;
    }
  }

  /**
   * GUILD MEMBER REMOVE: Decrement member_count
   */
  static async handleMemberRemove(guild) {
    try {
      if (!guild) return null;

      const updated = await db.one(`
        INSERT INTO guilds (id, name, member_count, bot_present, updated_at)
        VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP)
        ON CONFLICT (id)
        DO UPDATE SET
          member_count = EXCLUDED.member_count,
          bot_present = TRUE,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [guild.id, guild.name || `Serveur ${guild.id.substring(0, 8)}`, guild.memberCount || 0]);

      if (guild.memberCount % 10 === 0) {
        console.log(`[GUILD SYNC] 👤- Member removed from ${guild.name}: ${guild.memberCount} members`);
      }

      return updated;
    } catch (error) {
      console.error(`[GUILD SYNC] Error in handleMemberRemove:`, error);
      throw error;
    }
  }

  /**
   * Get all guilds where bot_present=true (currently active)
   */
  static async getActiveGuilds() {
    try {
      return await db.any(`SELECT * FROM guilds WHERE bot_present = TRUE ORDER BY name ASC`);
    } catch (error) {
      console.error('[GUILD SYNC] Error getting active guilds:', error);
      return [];
    }
  }

  /**
   * Get guild by ID with all data
   */
  static async getGuild(guildId) {
    try {
      return await db.oneOrNone('SELECT * FROM guilds WHERE id = $1', [guildId]);
    } catch (error) {
      console.error(`[GUILD SYNC] Error getting guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Update guild name (called when bot receives guild name change)
   */
  static async updateGuildName(guildId, newName) {
    try {
      const updated = await db.oneOrNone(
        `UPDATE guilds SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [newName, guildId]
      );

      if (updated) {
        console.log(`[GUILD SYNC] 📝 Guild renamed: ${newName} (${guildId})`);
        return updated;
      }

      return null;
    } catch (error) {
      console.error(`[GUILD SYNC] Error updating guild name:`, error);
      throw error;
    }
  }

  /**
   * Update guild icon
   */
  static async updateGuildIcon(guildId, iconUrl) {
    try {
      const updated = await db.oneOrNone(
        `UPDATE guilds SET icon_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [iconUrl || null, guildId]
      );

      if (updated) {
        console.log(`[GUILD SYNC] 🎨 Guild icon updated: ${guildId}`);
        return updated;
      }

      return null;
    } catch (error) {
      console.error(`[GUILD SYNC] Error updating guild icon:`, error);
      throw error;
    }
  }
}

export default GuildSyncService;
