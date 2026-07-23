/**
 * GLOBAL COMMAND MIDDLEWARE
 * Middleware centralisé pour toutes les commandes
 */

import CommandLogService from '../services/commandLogService.js';
import ErrorHandler from '../services/errorHandler.js';
import AntiSpamService from '../services/antiSpamService.js';
import AuditLogService from '../services/auditLogService.js';
import MiddlewarePerformanceService from '../services/middlewarePerformanceService.js';
import BypassService from '../services/bypassService.js';
import { globalCache } from '../services/cacheService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_CONFIG_PATH = path.join(__dirname, '../../data/admin-config.json');

function loadOwnerIds() {
  const envOwnerIds = process.env.OWNER_IDS?.split(',').filter(Boolean);
  if (envOwnerIds && envOwnerIds.length > 0) {
    return envOwnerIds;
  }

  try {
    if (fs.existsSync(ADMIN_CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(ADMIN_CONFIG_PATH, 'utf8'));
      return Array.isArray(config.ownerIds) ? config.ownerIds : [];
    }
  } catch (error) {
    console.error('[GlobalMiddleware] Impossible de charger admin-config.json:', error.message);
  }

  return [];
}

class GlobalCommandMiddleware {
  constructor() {
    this.OWNER_IDS = loadOwnerIds();
    this.ADMIN_IDS = process.env.ADMIN_IDS?.split(',') || [];
  }

  /**
   * Middleware principal - appliqué à chaque commande
   */
  async execute(interaction, commandName) {
    const startTime = performance.now();

    // Check bypass early (does NOT bypass bans)
    let isBypassedUser = false;
    try {
      isBypassedUser = await BypassService.isBypassed(interaction.user.id);
    } catch (e) {
      // ignore errors and continue normal flow
    }

    try {
      // 0️⃣ Vérifier l'accès global par bypass
      if (commandName !== 'bypass' && !this.OWNER_IDS.includes(interaction.user.id) && !isBypassedUser) {
        await interaction.reply({
          content: '❌ Vous n\'êtes pas autorisé à utiliser ce bot. Seuls les utilisateurs ajoutés au bypass peuvent exécuter des commandes.',
          ephemeral: true
        });
        await this.logCommandExecution(interaction, commandName, startTime, false, 'Not bypassed');
        return { proceed: false, reason: 'Not bypassed' };
      }

      // 1️⃣ Vérifier la maintenance globale n'est pas gérée par ce middleware

      // 2️⃣ Vérifier le rate limit (anti-spam)
      const rateLimit = await AntiSpamService.checkRateLimit(interaction.user.id, commandName);
      if (!rateLimit.allowed) {
        await interaction.reply({
          content: `⏱️ ${rateLimit.reason}`,
          ephemeral: true
        });
        await this.logCommandExecution(interaction, commandName, startTime, false, rateLimit.reason);
        return { proceed: false, reason: 'Rate limited' };
      }

      // ✅ Toutes les vérifications passées
      const executionTime = performance.now() - startTime;

      MiddlewarePerformanceService.recordPerformance({
        commandName,
        userId: interaction.user.id,
        executionTimeMs: executionTime,
        checksPerformed: { ban_check: 1, maintenance_check: 1, spam_check: 1 },
        result: 'passed'
      }).catch(err => console.error('[Middleware] Perf logging error:', err));

      return { proceed: true, reason: null };
    } catch (error) {
      console.error('[GlobalMiddleware] Error in middleware:', error);
      
      // Log performance even on error
      {
        const executionTime = performance.now() - startTime;
        MiddlewarePerformanceService.recordPerformance({
          commandName,
          userId: interaction.user.id,
          executionTimeMs: executionTime,
          result: 'error',
          blockedReason: error.message
        }).catch(err => console.error('[Middleware] Perf error logging:', err));
      }
      
      // Log l'erreur
      await ErrorHandler.handleCommandError(interaction, error, commandName);
      await this.logCommandExecution(interaction, commandName, startTime, false, error.message);
      
      return { proceed: false, reason: 'Middleware error' };
    }
  }

  /**
   * Logger l'exécution de la commande
   */
  async logCommandExecution(interaction, commandName, startTime, success, errorMessage = null) {
    try {
      const executionTimeMs = Math.round(performance.now() - startTime);

      // Récupérer les arguments
      const args = interaction.options?.data?.map(d => `${d.name}=${d.value}`) || [];

      await CommandLogService.logCommand({
        commandName,
        userId: interaction.user.id,
        username: interaction.user.username,
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        arguments: args,
        success,
        errorMessage: errorMessage,
        executionTimeMs
      });

      // Si succès, enregistrer les stats
      if (success && interaction.guild) {
        const StatsService = await import('../services/statsService.js').then(m => m.default);
        await StatsService.recordCommandExecution(commandName, interaction.guild.id, executionTimeMs);
      }
    } catch (error) {
      console.error('[GlobalMiddleware] Error logging execution:', error);
    }
  }

  /**
   * Wrapper pour les handlers de commandes
   */
  createHandler(commandName, originalHandler) {
    return async (interaction) => {
      // Exécuter le middleware
      const middlewareResult = await this.execute(interaction, commandName);
      
      if (!middlewareResult.proceed) {
        return;
      }

      // Exécuter le handler original
      try {
        await originalHandler(interaction);
        await this.logCommandExecution(interaction, commandName, performance.now(), true);
      } catch (error) {
        await ErrorHandler.handleCommandError(interaction, error, commandName);
        await this.logCommandExecution(interaction, commandName, performance.now(), false, error.message);
      }
    };
  }
}

export default new GlobalCommandMiddleware();
