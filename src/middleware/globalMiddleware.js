/**
 * GLOBAL COMMAND MIDDLEWARE
 * Middleware centralisé pour toutes les commandes
 */

import CommandLogService from '../services/commandLogService.js';
import ErrorHandler from '../services/errorHandler.js';
import AntiSpamService from '../services/antiSpamService.js';
import AuditLogService from '../services/auditLogService.js';
import BypassService from '../services/bypassService.js';
import { globalCache } from '../services/cacheService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_CONFIG_PATH = path.join(__dirname, '../../data/admin-config.json');
const ENV_OWNER_ID = process.env.OWNER_ID || '';
const ENV_OWNER_IDS = process.env.OWNER_IDS || '';
const DEFAULT_OWNER_ID = ENV_OWNER_ID || ENV_OWNER_IDS.split(',').map(id => id.trim()).find(Boolean) || '492627367114702849';

function loadOwnerIds() {
  const envOwnerIds = ENV_OWNER_IDS.split(',').map(id => id.trim()).filter(Boolean);
  const fileOwnerIds = [];
  let adminConfigExists = false;

  try {
    if (fs.existsSync(ADMIN_CONFIG_PATH)) {
      adminConfigExists = true;
      const config = JSON.parse(fs.readFileSync(ADMIN_CONFIG_PATH, 'utf8'));

      const candidateSources = ['ownerIds', 'owners'];
      candidateSources.forEach((sourceKey) => {
        if (Array.isArray(config[sourceKey])) {
          config[sourceKey].forEach((id) => {
            if (typeof id === 'string' && id.trim().length > 0) {
              fileOwnerIds.push(id.trim());
            }
          });
        }
      });
    }
  } catch (error) {
    console.error('[GlobalMiddleware] Impossible de charger admin-config.json:', error.message);
  }

  const ownerIds = Array.from(new Set([...fileOwnerIds, ...envOwnerIds, DEFAULT_OWNER_ID]));
  return {
    ownerIds,
    sourceDetails: {
      adminConfigPath: ADMIN_CONFIG_PATH,
      adminConfigExists,
      fileOwnerIds,
      envOwnerIds,
      defaultOwnerId: DEFAULT_OWNER_ID
    }
  };
}

class GlobalCommandMiddleware {
  constructor() {
    const { ownerIds, sourceDetails } = loadOwnerIds();
    this.OWNER_IDS = ownerIds;
    this.OWNER_ID_DETAILS = sourceDetails;
    this.ADMIN_IDS = process.env.ADMIN_IDS?.split(',') || [];
  }

  /**
   * Middleware principal - appliqué à chaque commande
   */
  async execute(interaction, commandName) {
    const startTime = performance.now();

    const isOwner = this.OWNER_IDS.includes(interaction.user.id);
    const ownerOverride = interaction.user.id === DEFAULT_OWNER_ID || isOwner;

    console.log('[BYPASS DEBUG] OWNER CHECK', {
      userId: interaction.user.id,
      commandName,
      DEFAULT_OWNER_ID,
      ownerIds: this.OWNER_IDS,
      isOwner,
      ownerOverride
    });

    if (ownerOverride) {
      const executionTimeMs = performance.now() - startTime;
      console.log('[BYPASS DEBUG] OWNER OVERRIDE', {
        userId: interaction.user.id,
        commandName,
        DEFAULT_OWNER_ID,
        ownerIds: this.OWNER_IDS,
        ownerIdDetails: this.OWNER_ID_DETAILS,
        isOwner,
        bypassDecision: 'owner override',
        middlewareProceed: true
      });
      return {
        proceed: true,
        reason: null,
        isOwner: true,
        isBypassedUser: false,
        bypassDecision: 'owner override',
        executionTimeMs
      };
    }

    // Check bypass early (does NOT bypass bans)
    let isBypassedUser = false;
    try {
      isBypassedUser = await BypassService.isBypassed(interaction.user.id);
    } catch (e) {
      console.error('[GlobalMiddleware] Bypass query failed:', e.message || e);
      // ignore errors and continue normal flow
    }

    try {
      const isBypassedUserStatus = isBypassedUser;
      const bypassDecision = commandName === 'bypass' ? 'bypass command' : (isBypassedUserStatus ? 'bypassed user' : false);

      console.log('[BYPASS DEBUG] ENTER GlobalCommandMiddleware.execute', {
        userId: interaction.user.id,
        commandName,
        ownerIds: this.OWNER_IDS,
        ownerIdDetails: this.OWNER_ID_DETAILS,
        envOwnerIds: ENV_OWNER_IDS,
        defaultOwnerId: DEFAULT_OWNER_ID,
        isOwner,
        isBypassedUser: isBypassedUserStatus,
        bypassDecision
      });

      // 0️⃣ Vérifier l'accès global par bypass
      if (!bypassDecision) {
        console.log('[BYPASS DEBUG] DENY Not bypassed', {
          userId: interaction.user.id,
          isOwner,
          isBypassedUser: isBypassedUserStatus,
          commandName
        });
        await interaction.reply({
          content: '❌ Vous n\'êtes pas autorisé à utiliser ce bot. Seuls les utilisateurs ajoutés au bypass peuvent exécuter des commandes.',
          ephemeral: true
        });
        await this.logCommandExecution(interaction, commandName, startTime, false, 'Not bypassed');
        return {
          proceed: false,
          reason: 'Not bypassed',
          isOwner,
          isBypassedUser: isBypassedUserStatus,
          bypassDecision
        };
      }

      console.log('[BYPASS DEBUG] ALLOW GlobalCommandMiddleware.execute', {
        userId: interaction.user.id,
        commandName,
        isOwner,
        isBypassedUser: isBypassedUserStatus,
        bypassDecision
      });

      // 1️⃣ Vérifier le rate limit (anti-spam)
      const rateLimit = await AntiSpamService.checkRateLimit(interaction.user.id, commandName);
      if (!rateLimit.allowed) {
        console.log('[BYPASS DEBUG] DENY Rate limited', {
          userId: interaction.user.id,
          commandName,
          rateLimit
        });
        await interaction.reply({
          content: `⏱️ ${rateLimit.reason}`,
          ephemeral: true
        });
        await this.logCommandExecution(interaction, commandName, startTime, false, rateLimit.reason);
        return {
          proceed: false,
          reason: 'Rate limited',
          isOwner,
          isBypassedUser: isBypassedUserStatus,
          bypassDecision
        };
      }

      // ✅ Toutes les vérifications passées
      const executionTimeMs = performance.now() - startTime;
      console.log('[BYPASS DEBUG] FINAL ALLOW GlobalCommandMiddleware.execute', {
        userId: interaction.user.id,
        commandName,
        isOwner,
        isBypassedUser: isBypassedUserStatus,
        bypassDecision,
        executionTimeMs
      });
      return {
        proceed: true,
        reason: null,
        isOwner,
        isBypassedUser: isBypassedUserStatus,
        bypassDecision
      };
    } catch (error) {
      console.error('[GlobalMiddleware] Error in middleware:', error);
      
      // Log performance even on error
      {
        const executionTime = performance.now() - startTime;
        console.error('[Middleware] Error occurred after', executionTime, 'ms');
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
