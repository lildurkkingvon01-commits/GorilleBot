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
}

export default MaintenanceService;
