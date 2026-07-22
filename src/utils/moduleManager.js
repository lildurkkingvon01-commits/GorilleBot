/**
 * Module Manager - Phase 7.1
 * Activation/Désactivation de modules par guild
 */

import db from './postgres.js';

const moduleCache = new Map(); // {guildId: {moduleName: boolean}}

const DEFAULT_MODULES = [
  'commands',
  'permissions',
  'cooldowns',
  'moderation',
  'automod',
  'announcements',
  'tickets',
  'event_logs',
  'welcome_messages',
  'reaction_roles'
];

/**
 * Get module status
 */
export async function isModuleEnabled(guildId, moduleName) {
  try {
    const cacheKey = guildId;
    
    if (!moduleCache.has(cacheKey)) {
      const modules = await db.any(
        `SELECT module_name, enabled FROM guild_modules WHERE guild_id = $1`,
        [guildId]
      );
      
      const moduleMap = {};
      DEFAULT_MODULES.forEach(m => {
        const found = modules.find(mod => mod.module_name === m);
        moduleMap[m] = found ? found.enabled : true; // Default: enabled
      });
      
      moduleCache.set(cacheKey, moduleMap);
    }
    
    const modules = moduleCache.get(cacheKey);
    return modules[moduleName] !== false;
  } catch (error) {
    console.error('[ModuleManager] Error checking status:', error);
    return true; // Safe default
  }
}

/**
 * Get all module statuses for guild
 */
export async function getGuildModules(guildId) {
  try {
    const cacheKey = guildId;
    
    if (!moduleCache.has(cacheKey)) {
      const modules = await db.any(
        `SELECT module_name, enabled FROM guild_modules WHERE guild_id = $1`,
        [guildId]
      );
      
      const moduleMap = {};
      DEFAULT_MODULES.forEach(m => {
        const found = modules.find(mod => mod.module_name === m);
        moduleMap[m] = found ? found.enabled : true;
      });
      
      moduleCache.set(cacheKey, moduleMap);
    }
    
    return moduleCache.get(cacheKey);
  } catch (error) {
    console.error('[ModuleManager] Error getting modules:', error);
    return {};
  }
}

/**
 * Set module status
 */
export async function setModuleStatus(guildId, moduleName, enabled) {
  try {
    const existing = await db.oneOrNone(
      `SELECT id FROM guild_modules WHERE guild_id = $1 AND module_name = $2`,
      [guildId, moduleName]
    );
    
    if (existing) {
      await db.none(
        `UPDATE guild_modules SET enabled = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE guild_id = $1 AND module_name = $2`,
        [guildId, moduleName, enabled]
      );
    } else {
      await db.none(
        `INSERT INTO guild_modules (guild_id, module_name, enabled) 
         VALUES ($1, $2, $3)`,
        [guildId, moduleName, enabled]
      );
    }
    
    // Invalidate cache
    moduleCache.delete(guildId);
    
    return true;
  } catch (error) {
    console.error('[ModuleManager] Error setting status:', error);
    return false;
  }
}

/**
 * Initialize guild modules
 */
export async function initializeGuildModules(guildId) {
  try {
    for (const moduleName of DEFAULT_MODULES) {
      const existing = await db.oneOrNone(
        `SELECT id FROM guild_modules WHERE guild_id = $1 AND module_name = $2`,
        [guildId, moduleName]
      );
      
      if (!existing) {
        await db.none(
          `INSERT INTO guild_modules (guild_id, module_name, enabled) 
           VALUES ($1, $2, true)`,
          [guildId, moduleName]
        );
      }
    }
    
    // Invalidate cache
    moduleCache.delete(guildId);
    
    console.log(`[ModuleManager] Initialized modules for guild ${guildId}`);
  } catch (error) {
    console.error('[ModuleManager] Error initializing:', error);
  }
}

/**
 * Get module stats
 */
export async function getModuleStats(guildId) {
  try {
    const modules = await getGuildModules(guildId);
    
    const enabled = Object.values(modules).filter(v => v).length;
    const disabled = Object.values(modules).filter(v => !v).length;
    
    return {
      total: Object.keys(modules).length,
      enabled,
      disabled
    };
  } catch (error) {
    console.error('[ModuleManager] Error getting stats:', error);
    return { total: 0, enabled: 0, disabled: 0 };
  }
}

/**
 * Get default modules list
 */
export function getDefaultModules() {
  return DEFAULT_MODULES;
}

/**
 * Clear cache
 */
export function clearCache(guildId) {
  moduleCache.delete(guildId);
}

export default {
  isModuleEnabled,
  getGuildModules,
  setModuleStatus,
  initializeGuildModules,
  getModuleStats,
  getDefaultModules,
  clearCache
};
