/**
 * BAN SERVICE
 * Gestion des bans user/guild
 */

import db from '../utils/postgres.js';
import AuditLogService from './auditLogService.js';
import { globalCache } from './cacheService.js';

class BanService {
  /**
   * Banner un utilisateur
   */
  static async banUser({
    userId,
    username,
    reason,
    bannedBy,
    bannedByUsername,
    expiresAt = null
  }) {
    try {
      const isPermanent = !expiresAt;

      // Insérer le ban dans user_bans (table existante)
      await db.none(
        `INSERT INTO user_bans (user_id, reason, banned_by, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, reason, bannedBy, expiresAt]
      );

      // Log audit
      await AuditLogService.logAction({
        actionType: 'ban_user',
        adminId: bannedBy,
        adminUsername: bannedByUsername,
        targetId: userId,
        targetName: username,
        reason: reason,
        details: { isPermanent, expiresAt }
      });

      // Invalider cache
      globalCache.invalidate(`ban:user:${userId}`);

      return { success: true };
    } catch (error) {
      console.error('[BanService] Error banning user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Débanner un utilisateur
   */
  static async unbanUser(userId, unbannedBy, unbannedByUsername, reason = null) {
    try {
      const user = await db.oneOrNone('SELECT user_id FROM user_bans WHERE user_id = $1', [userId]);

      // Supprimer le ban de user_bans
      await db.none(
        'DELETE FROM user_bans WHERE user_id = $1',
        [userId]
      );

      // Log audit
      await AuditLogService.logAction({
        actionType: 'unban_user',
        adminId: unbannedBy,
        adminUsername: unbannedByUsername,
        targetId: userId,
        targetName: user?.user_id || 'Unknown',
        reason: reason
      });

      globalCache.invalidate(`ban:user:${userId}`);
      return { success: true };
    } catch (error) {
      console.error('[BanService] Error unbanning user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vérifier si un utilisateur est banni
   */
  static async isUserBanned(userId) {
    try {
      // Cache check
      const cacheKey = `ban:user:${userId}`;
      const cached = globalCache.get(cacheKey);
      if (cached !== undefined) return cached;

      const ban = await db.oneOrNone(
        `SELECT * FROM user_bans 
         WHERE user_id = $1 
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId]
      );

      const isBanned = !!ban;
      globalCache.set(cacheKey, isBanned, 1800); // Cache 30 min
      return isBanned;
    } catch (error) {
      console.error('[BanService] Error checking ban:', error);
      return false;
    }
  }

  /**
   * Banner un serveur
   */
  static async banGuild({
    guildId,
    guildName,
    reason,
    bannedBy,
    bannedByUsername,
    expiresAt = null
  }) {
    try {
      const isPermanent = !expiresAt;

      await db.none(
        `INSERT INTO banned_guilds (guild_id, guild_name, reason, banned_by, expires_at, is_permanent, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (guild_id) DO UPDATE SET active = true`,
        [guildId, guildName, reason, bannedBy, expiresAt, isPermanent, true]
      );

      await AuditLogService.logAction({
        actionType: 'ban_guild',
        adminId: bannedBy,
        adminUsername: bannedByUsername,
        targetId: guildId,
        targetName: guildName,
        reason: reason,
        details: { isPermanent, expiresAt }
      });

      globalCache.invalidate(`ban:guild:${guildId}`);
      return { success: true };
    } catch (error) {
      console.error('[BanService] Error banning guild:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Débanner un serveur
   */
  static async unbanGuild(guildId, unbannedBy, unbannedByUsername, reason = null) {
    try {
      const guild = await db.oneOrNone('SELECT guild_name FROM banned_guilds WHERE guild_id = $1', [guildId]);

      await db.none(
        'UPDATE banned_guilds SET active = false WHERE guild_id = $1',
        [guildId]
      );

      await AuditLogService.logAction({
        actionType: 'unban_guild',
        adminId: unbannedBy,
        adminUsername: unbannedByUsername,
        targetId: guildId,
        targetName: guild?.guild_name || 'Unknown',
        reason: reason
      });

      globalCache.invalidate(`ban:guild:${guildId}`);
      return { success: true };
    } catch (error) {
      console.error('[BanService] Error unbanning guild:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vérifier si un serveur est banni
   */
  static async isGuildBanned(guildId) {
    try {
      const cacheKey = `ban:guild:${guildId}`;
      const cached = globalCache.get(cacheKey);
      if (cached !== undefined) {
        console.log(`[BanService] Cache hit for guild ${guildId}: ${cached}`);
        return cached;
      }

      console.log(`[BanService-DEBUG] Checking ban for guild: ${guildId} (type: ${typeof guildId}, length: ${String(guildId).length})`);

      // EXACT BAN CHECK: active=true ONLY
      // Do NOT add is_permanent or expires_at conditions - active=true is sufficient
      const ban = await db.oneOrNone(
        `SELECT guild_id, guild_name, active, reason, banned_at
         FROM banned_guilds 
         WHERE guild_id = $1 
         AND active = true
         LIMIT 1`,
        [guildId]
      );

      console.log(`[BanService-DEBUG] Query result:`, {
        guildId: guildId,
        bannedRecord: ban ? { id: ban.guild_id, guild_name: ban.guild_name, active: ban.active } : null
      });

      const isBanned = !!ban;
      globalCache.set(cacheKey, isBanned, 3600);
      return isBanned;
    } catch (error) {
      console.error('[BanService] Error checking guild ban:', error);
      return false;
    }
  }

  /**
   * Obtenir la liste des utilisateurs bannis
   */
  static async getBannedUsers(limit = 100) {
    try {
      return await db.any(
        'SELECT * FROM user_bans ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
    } catch (error) {
      console.error('[BanService] Error getting banned users:', error);
      return [];
    }
  }

  /**
   * Obtenir la liste des serveurs bannis
   */
  static async getBannedGuilds(limit = 100) {
    try {
      return await db.any(
        'SELECT * FROM banned_guilds WHERE active = true ORDER BY banned_at DESC LIMIT $1',
        [limit]
      );
    } catch (error) {
      console.error('[BanService] Error getting banned guilds:', error);
      return [];
    }
  }
}

export default BanService;
