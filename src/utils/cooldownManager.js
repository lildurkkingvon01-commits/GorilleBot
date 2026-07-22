/**
 * Cooldown Manager - Phase 3.3
 * Gère les cooldowns par commande avec persistance DB
 */

import db from './postgres.js';

const cooldownCache = new Map(); // {guildId: {commandName: durationMs}}
const userCooldowns = new Map(); // {guildId:commandName:userId: expiresAt}

/**
 * Load cooldown config for a guild
 */
async function loadGuildCooldowns(guildId) {
  try {
    const cooldowns = await db.any(
      'SELECT command_name, duration_ms FROM command_cooldowns WHERE guild_id = $1',
      [guildId]
    );
    
    const guildMap = new Map();
    cooldowns.forEach(c => {
      guildMap.set(c.command_name, c.duration_ms);
    });
    
    cooldownCache.set(guildId, guildMap);
    return guildMap;
  } catch (error) {
    console.error(`[CooldownManager] Error loading cooldowns for ${guildId}:`, error.message);
    return new Map();
  }
}

/**
 * Check if user is on cooldown
 */
export async function isOnCooldown(guildId, commandName, userId) {
  try {
    const key = `${guildId}:${commandName}:${userId}`;
    const expiresAt = userCooldowns.get(key);
    
    if (!expiresAt) return false;
    
    const now = Date.now();
    if (now > expiresAt.getTime()) {
      userCooldowns.delete(key);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[CooldownManager] Error checking cooldown:', error);
    return false;
  }
}

/**
 * Get remaining cooldown time in ms
 */
export function getRemainingCooldown(guildId, commandName, userId) {
  try {
    const key = `${guildId}:${commandName}:${userId}`;
    const expiresAt = userCooldowns.get(key);
    
    if (!expiresAt) return 0;
    
    const remaining = expiresAt.getTime() - Date.now();
    return remaining > 0 ? remaining : 0;
  } catch (error) {
    console.error('[CooldownManager] Error getting remaining cooldown:', error);
    return 0;
  }
}

/**
 * Apply cooldown to user
 */
export async function applyCooldown(guildId, commandName, userId) {
  try {
    let guildCooldowns = cooldownCache.get(guildId);
    if (!guildCooldowns) {
      guildCooldowns = await loadGuildCooldowns(guildId);
    }
    
    const duration = guildCooldowns.get(commandName) || 3000; // Default 3 seconds
    const expiresAt = new Date(Date.now() + duration);
    
    const key = `${guildId}:${commandName}:${userId}`;
    userCooldowns.set(key, expiresAt);
    
    // Persist to DB for tracking
    try {
      await db.none(
        `INSERT INTO cooldown_tracking (guild_id, command_name, user_id, expires_at) 
         VALUES ($1, $2, $3, $4)`,
        [guildId, commandName, userId, expiresAt]
      );
    } catch (e) {
      // Ignore DB errors, in-memory tracking is enough
    }
  } catch (error) {
    console.error('[CooldownManager] Error applying cooldown:', error);
  }
}

/**
 * Set cooldown duration for command
 */
export async function setCooldownDuration(guildId, commandName, durationMs, cooldownType = 'user', updatedBy) {
  try {
    await db.none(
      `INSERT INTO command_cooldowns (guild_id, command_name, duration_ms, cooldown_type, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (guild_id, command_name, cooldown_type)
       DO UPDATE SET duration_ms = $3, updated_by = $5`,
      [guildId, commandName, durationMs, cooldownType, updatedBy]
    );
    
    invalidateGuildCache(guildId);
    return true;
  } catch (error) {
    console.error('[CooldownManager] Error setting cooldown:', error);
    return false;
  }
}

/**
 * Get all cooldowns for a guild
 */
export async function getGuildCooldowns(guildId) {
  try {
    return await db.any(
      'SELECT * FROM command_cooldowns WHERE guild_id = $1',
      [guildId]
    );
  } catch (error) {
    console.error('[CooldownManager] Error getting guild cooldowns:', error);
    return [];
  }
}

/**
 * Remove cooldown for command
 */
export async function removeCooldown(guildId, commandName) {
  try {
    await db.none(
      'DELETE FROM command_cooldowns WHERE guild_id = $1 AND command_name = $2',
      [guildId, commandName]
    );
    
    invalidateGuildCache(guildId);
    return true;
  } catch (error) {
    console.error('[CooldownManager] Error removing cooldown:', error);
    return false;
  }
}

/**
 * Clean up expired cooldowns (run periodically)
 */
export async function cleanupExpiredCooldowns() {
  try {
    const now = new Date();
    
    await db.none(
      'DELETE FROM cooldown_tracking WHERE expires_at < $1',
      [now]
    );
    
    // Also clean in-memory
    for (const [key, expiresAt] of userCooldowns.entries()) {
      if (expiresAt < now) {
        userCooldowns.delete(key);
      }
    }
  } catch (error) {
    console.error('[CooldownManager] Error cleaning up cooldowns:', error);
  }
}

/**
 * Invalidate guild cache
 */
export function invalidateGuildCache(guildId) {
  cooldownCache.delete(guildId);
}

/**
 * Initialize cache for all guilds
 */
export async function initializeCache(guildIds) {
  try {
    for (const guildId of guildIds) {
      await loadGuildCooldowns(guildId);
    }
    console.log('[CooldownManager] Cache initialized');
  } catch (error) {
    console.error('[CooldownManager] Error initializing cache:', error);
  }
}

export default {
  isOnCooldown,
  getRemainingCooldown,
  applyCooldown,
  setCooldownDuration,
  getGuildCooldowns,
  removeCooldown,
  cleanupExpiredCooldowns,
  invalidateGuildCache,
  initializeCache
};
