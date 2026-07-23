/**
 * ANTI-SPAM SERVICE
 * Gère le rate limiting et blocage temporaire
 */

import db from '../utils/postgres.js';
import { globalCache } from './cacheService.js';

class AntiSpamService {
  constructor() {
    this.OWNER_IDS = process.env.OWNER_IDS?.split(',') || [];
    this.ADMIN_IDS = process.env.ADMIN_IDS?.split(',') || [];
  }

  /**
   * Vérifier le rate limit
   */
  async checkRateLimit(userId, commandName, maxPerMinute = 5) {
    try {
      // Whitelist admins/owners
      if (this.OWNER_IDS.includes(userId) || this.ADMIN_IDS.includes(userId)) {
        return { allowed: true, reason: null };
      }

      // Rate limiting disabled: allow all commands
      return { allowed: true, reason: null };
    } catch (error) {
      console.error('[AntiSpamService] Error checking rate limit:', error);
      return { allowed: true, reason: null };
    }
  }

  /**
   * Débloquer un utilisateur
   */
  async unblockUser(userId, unblockedBy) {
    try {
      await db.none(
        'DELETE FROM anti_spam_blocks WHERE user_id = $1',
        [userId]
      );

      return { success: true };
    } catch (error) {
      console.error('[AntiSpamService] Error unblocking user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir les utilisateurs bloqués
   */
  async getBlockedUsers() {
    try {
      return await db.any(
        'SELECT * FROM anti_spam_blocks WHERE blocked_until > NOW()'
      );
    } catch (error) {
      console.error('[AntiSpamService] Error getting blocked users:', error);
      return [];
    }
  }

  /**
   * Nettoyer les anciens blocs
   */
  async cleanupExpiredBlocks() {
    try {
      const result = await db.result(
        'DELETE FROM anti_spam_blocks WHERE blocked_until < NOW()'
      );
      return { rowsDeleted: result.rowCount };
    } catch (error) {
      console.error('[AntiSpamService] Error cleaning up blocks:', error);
      return { rowsDeleted: 0 };
    }
  }
}

export default new AntiSpamService();
