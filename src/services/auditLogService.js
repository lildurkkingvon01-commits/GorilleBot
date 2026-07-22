/**
 * AUDIT LOG SERVICE
 * Log les actions admin (bans, maintenance, etc.)
 */

import db from '../utils/postgres.js';
import FeatureFlagService from './featureFlagService.js';

class AuditLogService {
  /**
   * Logger une action admin
   */
  static async logAction({
    actionType,
    adminId,
    adminUsername,
    targetId,
    targetName,
    reason,
    details = {},
    success = true,
    errorMessage = null
  }) {
    try {
      // Vérifier si logging est activé
      const auditEnabled = await FeatureFlagService.isEnabled('audit_logs_enabled');
      if (!auditEnabled) return;

      // Nettoyer les données sensibles du details
      const cleanDetails = this.sanitizeDetails(details);

      // Utiliser la table audit_logs existante
      await db.none(
        `INSERT INTO audit_logs 
         (action, user_id, guild_id, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [actionType, adminId, null, targetId, JSON.stringify({
          adminUsername,
          targetName,
          reason,
          details: cleanDetails,
          success,
          errorMessage
        })]
      );
    } catch (error) {
      console.error('[AuditLogService] Error logging action:', error);
    }
  }

  /**
   * Nettoyer les données sensibles
   */
  static sanitizeDetails(details) {
    const clean = { ...details };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'api_key', 'authorization'];
    
    Object.keys(clean).forEach(key => {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        clean[key] = '[REDACTED]';
      }
    });

    return clean;
  }

  /**
   * Obtenir les logs d'un admin
   */
  static async getLogsByAdmin(adminId, limit = 100) {
    try {
      return await db.any(
        'SELECT * FROM admin_audit_logs WHERE admin_id = $1 ORDER BY created_at DESC LIMIT $2',
        [adminId, limit]
      );
    } catch (error) {
      console.error('[AuditLogService] Error fetching admin logs:', error);
      return [];
    }
  }

  /**
   * Obtenir les logs par type d'action
   */
  static async getLogsByActionType(actionType, limit = 100) {
    try {
      return await db.any(
        'SELECT * FROM admin_audit_logs WHERE action_type = $1 ORDER BY created_at DESC LIMIT $2',
        [actionType, limit]
      );
    } catch (error) {
      console.error('[AuditLogService] Error fetching by action type:', error);
      return [];
    }
  }

  /**
   * Obtenir l'historique complet
   */
  static async getFullAuditTrail(limit = 1000) {
    try {
      return await db.any(
        'SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
    } catch (error) {
      console.error('[AuditLogService] Error fetching audit trail:', error);
      return [];
    }
  }

  /**
   * Obtenir les actions sur une cible (user ou guild)
   */
  static async getTargetAuditLog(targetId, limit = 100) {
    try {
      return await db.any(
        'SELECT * FROM admin_audit_logs WHERE target_id = $1 ORDER BY created_at DESC LIMIT $2',
        [targetId, limit]
      );
    } catch (error) {
      console.error('[AuditLogService] Error fetching target logs:', error);
      return [];
    }
  }

  /**
   * Résumé des actions
   */
  static async getActionsSummary(daysBack = 7) {
    try {
      return await db.any(`
        SELECT 
          action_type,
          COUNT(*) as count,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed
        FROM admin_audit_logs
        WHERE created_at > NOW() - INTERVAL '${daysBack} days'
        GROUP BY action_type
        ORDER BY count DESC
      `);
    } catch (error) {
      console.error('[AuditLogService] Error getting summary:', error);
      return [];
    }
  }
}

export default AuditLogService;
