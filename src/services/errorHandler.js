/**
 * GLOBAL ERROR HANDLER SERVICE
 * Centralise la gestion des erreurs avec logging
 */

import db from '../utils/postgres.js';

class ErrorHandler {
  /**
   * Logger une erreur
   */
  static async logError({
    errorType,
    errorMessage,
    errorStack,
    commandName,
    userId,
    guildId,
    severity = 'medium'
  }) {
    try {
      await db.none(
        `INSERT INTO error_logs (error_type, error_message, error_stack, command_name, user_id, guild_id, severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [errorType, errorMessage, errorStack, commandName, userId, guildId, severity]
      );
    } catch (err) {
      console.error('[ErrorHandler] Failed to log error:', err);
    }
  }

  /**
   * Gérer une erreur de commande
   */
  static async handleCommandError(interaction, error, commandName) {
    const severity = this.calculateSeverity(error);

    // Logger
    await this.logError({
      errorType: 'CommandError',
      errorMessage: error.message,
      errorStack: error.stack,
      commandName,
      userId: interaction.user?.id,
      guildId: interaction.guild?.id,
      severity
    });

    // Répondre à l'utilisateur si pas déjà répondu
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Une erreur est survenue. Les administrateurs ont été notifiés.',
          ephemeral: true
        });
      }
    } catch (err) {
      console.error('[ErrorHandler] Failed to reply:', err);
    }

    // Console en prod
    if (severity === 'critical') {
      console.error(`[CRITICAL] ${commandName}:`, error);
    }
  }

  /**
   * Calculer la sévérité
   */
  static calculateSeverity(error) {
    if (error.message.includes('CRITICAL') || error.message.includes('FATAL')) {
      return 'critical';
    }
    if (error.message.includes('WARN') || error.message.includes('timeout')) {
      return 'high';
    }
    if (error.message.includes('Invalid') || error.message.includes('404')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Obtenir les erreurs récentes
   */
  static async getRecentErrors(limit = 50) {
    try {
      return await db.any(
        'SELECT * FROM error_logs ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
    } catch (error) {
      console.error('[ErrorHandler] Error fetching logs:', error);
      return [];
    }
  }

  /**
   * Obtenir les erreurs par sévérité
   */
  static async getErrorsBySeverity(severity) {
    try {
      return await db.any(
        'SELECT * FROM error_logs WHERE severity = $1 ORDER BY created_at DESC',
        [severity]
      );
    } catch (error) {
      console.error('[ErrorHandler] Error fetching by severity:', error);
      return [];
    }
  }

  /**
   * Marquer une erreur comme résolue
   */
  static async resolveError(errorId) {
    try {
      await db.none(
        'UPDATE error_logs SET resolved = true WHERE id = $1',
        [errorId]
      );
      return { success: true };
    } catch (error) {
      console.error('[ErrorHandler] Error resolving:', error);
      return { success: false };
    }
  }
}

export default ErrorHandler;
