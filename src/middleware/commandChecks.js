/**
 * 🎮 Command Checks Middleware
 * Validates command status, cooldowns, and permissions
 * Used by all Discord commands to respect admin panel settings
 */

import { EmbedBuilder } from 'discord.js';
import dbPostgres from '../utils/postgres.js';
import dbSqlite from '../config/database-sqlite.js';

const db = process.env.USE_POSTGRES === 'true' ? dbPostgres : dbSqlite;

/**
 * Check if command is enabled for this guild
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @returns {Promise<boolean>} true if enabled
 */
export async function isCommandEnabled(guildId, commandName) {
  try {
    const result = await db.oneOrNone(
      `SELECT enabled FROM command_status WHERE guild_id = $1 AND command_name = $2`,
      [guildId, commandName]
    );

    // Default to enabled if not found
    return result ? result.enabled !== false : true;
  } catch (error) {
    console.error(`❌ Error checking command enabled status:`, error.message);
    return true; // Default to enabled on error
  }
}

/**
 * Check if user is on cooldown for this command
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {string} userId - User ID
 * @returns {Promise<{onCooldown: boolean, remainingMs: number}>}
 */
export async function checkCooldown(guildId, commandName, userId) {
  try {
    // Get cooldown configuration
    const cooldownConfig = await db.oneOrNone(
      `SELECT duration_ms, cooldown_type FROM command_cooldowns 
       WHERE guild_id = $1 AND command_name = $2`,
      [guildId, commandName]
    );

    // No cooldown configured
    if (!cooldownConfig) {
      return { onCooldown: false, remainingMs: 0 };
    }

    // Get the tracking key based on cooldown type
    let trackingKey;
    switch (cooldownConfig.cooldown_type) {
      case 'user':
        trackingKey = `${guildId}:${commandName}:${userId}`;
        break;
      case 'guild':
        trackingKey = `${guildId}:${commandName}:guild`;
        break;
      case 'global':
        trackingKey = `${commandName}:global`;
        break;
      default:
        trackingKey = `${guildId}:${commandName}:${userId}`;
    }

    // Check if there's an active cooldown
    const cooldownRecord = await db.oneOrNone(
      `SELECT expires_at FROM cooldown_tracking WHERE tracking_key = $1`,
      [trackingKey]
    );

    if (!cooldownRecord) {
      return { onCooldown: false, remainingMs: 0 };
    }

    const expiresAt = new Date(cooldownRecord.expires_at).getTime();
    const now = Date.now();

    if (expiresAt > now) {
      const remainingMs = expiresAt - now;
      return { onCooldown: true, remainingMs };
    }

    // Cooldown expired, delete record
    await db.none(
      `DELETE FROM cooldown_tracking WHERE tracking_key = $1`,
      [trackingKey]
    );

    return { onCooldown: false, remainingMs: 0 };
  } catch (error) {
    console.error(`❌ Error checking cooldown:`, error.message);
    return { onCooldown: false, remainingMs: 0 };
  }
}

/**
 * Apply cooldown after command execution
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {string} userId - User ID
 */
export async function applyCooldown(guildId, commandName, userId) {
  try {
    // Get cooldown configuration
    const cooldownConfig = await db.oneOrNone(
      `SELECT duration_ms, cooldown_type FROM command_cooldowns 
       WHERE guild_id = $1 AND command_name = $2`,
      [guildId, commandName]
    );

    // No cooldown configured
    if (!cooldownConfig) {
      return;
    }

    // Get the tracking key based on cooldown type
    let trackingKey;
    switch (cooldownConfig.cooldown_type) {
      case 'user':
        trackingKey = `${guildId}:${commandName}:${userId}`;
        break;
      case 'guild':
        trackingKey = `${guildId}:${commandName}:guild`;
        break;
      case 'global':
        trackingKey = `${commandName}:global`;
        break;
      default:
        trackingKey = `${guildId}:${commandName}:${userId}`;
    }

    // Calculate expiration
    const expiresAt = new Date(Date.now() + cooldownConfig.duration_ms);

    // Upsert cooldown record
    await db.none(
      `INSERT INTO cooldown_tracking (tracking_key, expires_at) 
       VALUES ($1, $2)
       ON CONFLICT(tracking_key) DO UPDATE SET expires_at = $2`,
      [trackingKey, expiresAt.toISOString()]
    );
  } catch (error) {
    console.error(`❌ Error applying cooldown:`, error.message);
  }
}

/**
 * Check if user has permission to use this command
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {Object} member - Discord GuildMember
 * @returns {Promise<boolean>} true if has permission
 */
export async function checkPermissions(guildId, commandName, member) {
  try {
    // Get permission configuration
    const config = await db.oneOrNone(
      `SELECT command_permissions FROM guild_configs WHERE guild_id = $1`,
      [guildId]
    );

    if (!config?.command_permissions) {
      return true; // No permissions configured, allow all
    }

    let perms;
    try {
      perms = JSON.parse(config.command_permissions);
    } catch {
      return true; // Invalid JSON, allow all
    }

    const cmdPerms = perms[commandName];
    if (!cmdPerms) {
      return true; // No specific permissions for this command, allow all
    }

    // Check permission level requirement
    if (cmdPerms.permission_level) {
      const userLevel = getUserPermissionLevel(member);
      if (userLevel < cmdPerms.permission_level) {
        return false; // User doesn't have required permission level
      }
    }

    // Check denied users first
    if (cmdPerms.denied_users && cmdPerms.denied_users.includes(member.id)) {
      return false;
    }

    // Check denied roles
    if (cmdPerms.denied_roles && cmdPerms.denied_roles.length > 0) {
      const hasDeniedRole = member.roles.cache.some(role =>
        cmdPerms.denied_roles.includes(role.id)
      );
      if (hasDeniedRole) {
        return false;
      }
    }

    // Check allowed users
    if (cmdPerms.allowed_users && cmdPerms.allowed_users.length > 0) {
      if (!cmdPerms.allowed_users.includes(member.id)) {
        return false;
      }
    }

    // Check allowed roles
    if (cmdPerms.allowed_roles && cmdPerms.allowed_roles.length > 0) {
      const hasAllowedRole = member.roles.cache.some(role =>
        cmdPerms.allowed_roles.includes(role.id)
      );
      if (!hasAllowedRole) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ Error checking permissions:`, error.message);
    return true; // Default to allowed on error
  }
}

/**
 * Get user permission level based on roles
 * @param {Object} member - Discord GuildMember
 * @returns {number} permission level (0-3)
 */
function getUserPermissionLevel(member) {
  // 3 = Owner
  if (member.guild.ownerId === member.id) {
    return 3;
  }

  // 2 = Administrator
  if (member.permissions.has('Administrator')) {
    return 2;
  }

  // 1 = Moderator (has manage messages or manage guild)
  if (member.permissions.has('ManageMessages') || member.permissions.has('ModerateMembers')) {
    return 1;
  }

  // 0 = Regular user
  return 0;
}

/**
 * Send cooldown error embed
 * @param {string} commandName - Command name
 * @param {number} remainingSeconds - Remaining cooldown in seconds
 * @returns {EmbedBuilder}
 */
export function getCooldownEmbed(commandName, remainingSeconds) {
  return new EmbedBuilder()
    .setColor('#ef4444')
    .setTitle('⏱️ Cooldown Actif')
    .setDescription(`Vous pourrez réutiliser \`/${commandName}\` dans **${remainingSeconds}s**`)
    .setTimestamp();
}

/**
 * Send permission denied embed
 * @param {string} commandName - Command name
 * @returns {EmbedBuilder}
 */
export function getPermissionDeniedEmbed(commandName) {
  return new EmbedBuilder()
    .setColor('#ef4444')
    .setTitle('🔒 Permission Refusée')
    .setDescription(`Vous n'avez pas la permission d'utiliser \`/${commandName}\``)
    .setTimestamp();
}

/**
 * Send command disabled embed
 * @param {string} commandName - Command name
 * @returns {EmbedBuilder}
 */
export function getCommandDisabledEmbed(commandName) {
  return new EmbedBuilder()
    .setColor('#ef4444')
    .setTitle('🔴 Commande Désactivée')
    .setDescription(`La commande \`/${commandName}\` est actuellement désactivée sur ce serveur`)
    .setTimestamp();
}
