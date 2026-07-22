/**
 * Command Status Manager - Phase 3.1
 * Gère l'état (enabled/disabled) des commandes par serveur
 * 
 * Usage:
 * - isCommandEnabled(guildId, commandName) → boolean
 * - setCommandStatus(guildId, commandName, enabled) → void
 * - getCommandStatus(guildId, commandName) → {enabled, updatedAt, updatedBy}
 * - getAllCommandStatus(guildId) → [{commandName, enabled, ...}]
 * - resetCommandStatus(guildId, commandName) → void
 */

import db from './postgres.js';

// Cache en mémoire pour performance (guilds → commands → status)
const statusCache = new Map();

/**
 * Charger tous les statuts d'une guild depuis la DB
 * @param {string} guildId - ID de la guild Discord
 * @returns {Map} Map de {commandName → enabled}
 */
async function loadGuildStatusCache(guildId) {
  try {
    const statuses = await db.any(
      'SELECT command_name, enabled FROM command_status WHERE guild_id = $1',
      [guildId]
    );
    
    const guildMap = new Map();
    for (const status of statuses) {
      guildMap.set(status.command_name, status.enabled === 1 || status.enabled === true);
    }
    
    statusCache.set(guildId, guildMap);
    return guildMap;
  } catch (error) {
    console.error(`[CommandStatusManager] Error loading cache for guild ${guildId}:`, error);
    return new Map();
  }
}

/**
 * Vérifier si une commande est activée pour une guild
 * Utilise le cache, charge depuis DB si nécessaire
 * @param {string} guildId - ID de la guild Discord
 * @param {string} commandName - Nom de la commande
 * @returns {Promise<boolean>} true si activée, false si désactivée
 */
export async function isCommandEnabled(guildId, commandName) {
  try {
    // Vérifier le cache
    if (!statusCache.has(guildId)) {
      await loadGuildStatusCache(guildId);
    }
    
    const guildMap = statusCache.get(guildId);
    if (!guildMap.has(commandName)) {
      // Pas de config = activée par défaut
      return true;
    }
    
    return guildMap.get(commandName);
  } catch (error) {
    console.error(
      `[CommandStatusManager] Error checking status for ${commandName} in guild ${guildId}:`,
      error
    );
    // Fallback: activée par défaut pour éviter de bloquer les commandes
    return true;
  }
}

/**
 * Définir l'état d'une commande
 * @param {string} guildId - ID de la guild Discord
 * @param {string} commandName - Nom de la commande
 * @param {boolean} enabled - true pour activer, false pour désactiver
 * @param {string} updatedBy - ID utilisateur qui fait le changement
 * @returns {Promise<boolean>} true si succès, false sinon
 */
export async function setCommandStatus(guildId, commandName, enabled, updatedBy = null) {
  try {
    // Vérifier que la guild existe dans guild_configs
    const guildConfig = await db.oneOrNone(
      'SELECT id FROM guild_configs WHERE guild_id = $1',
      [guildId]
    );
    
    if (!guildConfig) {
      // Créer une config par défaut si elle n'existe pas
      await db.none(
        'INSERT INTO guild_configs (guild_id) VALUES ($1)',
        [guildId]
      );
    }
    
    // Insérer ou mettre à jour
    await db.none(
      `INSERT INTO command_status (guild_id, command_name, enabled, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT(guild_id, command_name) DO UPDATE SET
       enabled = $3, updated_by = $4, updated_at = NOW()`,
      [guildId, commandName, enabled ? 1 : 0, updatedBy]
    );
    
    // Mettre à jour le cache
    if (!statusCache.has(guildId)) {
      await loadGuildStatusCache(guildId);
    }
    statusCache.get(guildId).set(commandName, enabled);
    
    console.log(
      `[CommandStatusManager] ${enabled ? 'Enabled' : 'Disabled'} command "${commandName}" in guild ${guildId}`
    );
    return true;
  } catch (error) {
    console.error(
      `[CommandStatusManager] Error setting status for ${commandName} in guild ${guildId}:`,
      error
    );
    return false;
  }
}

/**
 * Obtenir les détails complets du statut d'une commande
 * @param {string} guildId - ID de la guild Discord
 * @param {string} commandName - Nom de la commande
 * @returns {Promise<Object|null>} {commandName, enabled, updatedAt, updatedBy}
 */
export async function getCommandStatus(guildId, commandName) {
  try {
    const status = await db.oneOrNone(
      `SELECT command_name, enabled, updated_at, updated_by 
       FROM command_status 
       WHERE guild_id = $1 AND command_name = $2`,
      [guildId, commandName]
    );
    
    if (!status) {
      // Pas de config = activée par défaut
      return {
        commandName,
        enabled: true,
        updatedAt: null,
        updatedBy: null
      };
    }
    
    return {
      commandName: status.command_name,
      enabled: status.enabled === 1 || status.enabled === true,
      updatedAt: status.updated_at,
      updatedBy: status.updated_by
    };
  } catch (error) {
    console.error(
      `[CommandStatusManager] Error getting status for ${commandName} in guild ${guildId}:`,
      error
    );
    return null;
  }
}

/**
 * Obtenir tous les statuts de commandes d'une guild
 * @param {string} guildId - ID de la guild Discord
 * @returns {Promise<Array>} [{commandName, enabled, updatedAt, updatedBy}, ...]
 */
export async function getAllCommandStatus(guildId) {
  try {
    const statuses = await db.any(
      `SELECT command_name, enabled, updated_at, updated_by 
       FROM command_status 
       WHERE guild_id = $1
       ORDER BY command_name ASC`,
      [guildId]
    );
    
    return statuses.map(s => ({
      commandName: s.command_name,
      enabled: s.enabled === 1 || s.enabled === true,
      updatedAt: s.updated_at,
      updatedBy: s.updated_by
    }));
  } catch (error) {
    console.error(
      `[CommandStatusManager] Error getting all statuses for guild ${guildId}:`,
      error
    );
    return [];
  }
}

/**
 * Réinitialiser le statut d'une commande (supprimer la config)
 * Revient à "activée par défaut"
 * @param {string} guildId - ID de la guild Discord
 * @param {string} commandName - Nom de la commande
 * @returns {Promise<boolean>} true si succès
 */
export async function resetCommandStatus(guildId, commandName) {
  try {
    await db.none(
      'DELETE FROM command_status WHERE guild_id = $1 AND command_name = $2',
      [guildId, commandName]
    );
    
    // Mettre à jour le cache
    if (statusCache.has(guildId)) {
      statusCache.get(guildId).delete(commandName);
    }
    
    console.log(
      `[CommandStatusManager] Reset status for command "${commandName}" in guild ${guildId}`
    );
    return true;
  } catch (error) {
    console.error(
      `[CommandStatusManager] Error resetting status for ${commandName} in guild ${guildId}:`,
      error
    );
    return false;
  }
}

/**
 * Invalider le cache pour une guild (forcer rechargement depuis DB)
 * @param {string} guildId - ID de la guild Discord
 */
export function invalidateGuildCache(guildId) {
  if (statusCache.has(guildId)) {
    statusCache.delete(guildId);
    console.log(`[CommandStatusManager] Cache invalidated for guild ${guildId}`);
  }
}

/**
 * Initialiser le cache au démarrage du bot (charger toutes les guilds)
 * @param {Set<string>} guildIds - Set des guild IDs où le bot est
 */
export async function initializeCache(guildIds) {
  console.log(`[CommandStatusManager] Initializing cache for ${guildIds.size} guilds...`);
  
  let loaded = 0;
  for (const guildId of guildIds) {
    await loadGuildStatusCache(guildId);
    loaded++;
  }
  
  console.log(`[CommandStatusManager] Cache initialized for ${loaded} guilds`);
}

export default {
  isCommandEnabled,
  setCommandStatus,
  getCommandStatus,
  getAllCommandStatus,
  resetCommandStatus,
  invalidateGuildCache,
  initializeCache
};
