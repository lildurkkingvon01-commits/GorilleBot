/**
 * MAINTENANCE SERVICE
 * Gère la maintenance globale et par commande
 */

import db from '../utils/postgres.js';
import AuditLogService from './auditLogService.js';
import { globalCache } from './cacheService.js';

class MaintenanceService {
  /**
   * Activer la maintenance globale
   */
  static async setGlobalMaintenance(enabled, message, adminId, adminUsername) {
    try {
      await db.none(
        `UPDATE maintenance SET enabled = $1, message = $2, started_at = NOW()
         WHERE maintenance_type = 'global'`,
        [enabled, message]
      );

      await AuditLogService.logAction({
        actionType: 'maintenance_global',
        adminId,
        adminUsername,
        targetName: enabled ? 'ENABLED' : 'DISABLED',
        reason: message,
        details: { enabled }
      });

      // Invalider cache
      globalCache.invalidate('maintenance:global');

      return { success: true };
    } catch (error) {
      console.error('[MaintenanceService] Error setting global maintenance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vérifier si maintenance globale est active
   */
  static async isGlobalMaintenanceActive() {
    try {
      const cached = globalCache.get('maintenance:global');
      if (cached !== undefined) return cached;

      const maint = await db.oneOrNone(
        'SELECT enabled FROM maintenance WHERE maintenance_type = $1',
        ['global']
      );

      const isActive = maint?.enabled ?? false;
      globalCache.set('maintenance:global', isActive, 300); // Cache 5 min
      return isActive;
    } catch (error) {
      console.error('[MaintenanceService] Error checking global maintenance:', error);
      return false;
    }
  }

  /**
   * Mettre une commande en maintenance
   */
  static async setCommandMaintenance(commandName, enabled, message, adminId, adminUsername) {
    try {
      // Vérifier si existe
      const exists = await db.oneOrNone(
        'SELECT id FROM maintenance WHERE maintenance_type = $1 AND target_name = $2',
        ['command', commandName]
      );

      if (exists) {
        await db.none(
          `UPDATE maintenance SET enabled = $1, message = $2, started_at = NOW()
           WHERE maintenance_type = $3 AND target_name = $4`,
          [enabled, message, 'command', commandName]
        );
      } else {
        await db.none(
          `INSERT INTO maintenance (maintenance_type, target_name, enabled, message, started_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          ['command', commandName, enabled, message]
        );
      }

      await AuditLogService.logAction({
        actionType: 'maintenance_command',
        adminId,
        adminUsername,
        targetName: commandName,
        reason: message
      });

      globalCache.invalidate(`maintenance:command:${commandName}`);
      return { success: true };
    } catch (error) {
      console.error('[MaintenanceService] Error setting command maintenance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vérifier si une commande est en maintenance
   */
  static async isCommandUnderMaintenance(commandName) {
    try {
      const cacheKey = `maintenance:command:${commandName}`;
      const cached = globalCache.get(cacheKey);
      if (cached !== undefined) return cached;

      const maint = await db.oneOrNone(
        `SELECT enabled FROM maintenance 
         WHERE maintenance_type = 'command' AND target_name = $1`,
        [commandName]
      );

      const underMaintenance = maint?.enabled ?? false;
      globalCache.set(cacheKey, underMaintenance, 300);
      return underMaintenance;
    } catch (error) {
      console.error('[MaintenanceService] Error checking command maintenance:', error);
      return false;
    }
  }

  /**
   * Obtenir le message de maintenance d'une commande
   */
  static async getCommandMaintenanceMessage(commandName) {
    try {
      const maint = await db.oneOrNone(
        `SELECT message FROM maintenance 
         WHERE maintenance_type = 'command' AND target_name = $1 AND enabled = true`,
        [commandName]
      );

      return maint?.message || 'Cette commande est en maintenance.';
    } catch (error) {
      console.error('[MaintenanceService] Error getting message:', error);
      return 'Erreur lors de la vérification de la maintenance.';
    }
  }

  /**
   * Obtenir la liste des commandes en maintenance
   */
  static async getCommandsUnderMaintenance() {
    try {
      return await db.any(
        `SELECT * FROM maintenance 
         WHERE maintenance_type = 'command' AND enabled = true`
      );
    } catch (error) {
      console.error('[MaintenanceService] Error getting commands in maintenance:', error);
      return [];
    }
  }
}

export default MaintenanceService;
