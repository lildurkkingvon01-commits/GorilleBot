import { Client, GatewayIntentBits, Collection, REST, Routes, ChannelType, EmbedBuilder, PermissionFlagsBits, ActivityType, AuditLogEvent, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { initDatabase, closeDatabase, deletePlayerById, getPlayersByGuild, cleanupDuplicatePlayers, getDb, getBroadcastChannel } from './utils/database.js';
import { setSecurityDb } from './utils/security.js';
import { initCronJobs } from './cron/checkInactivity.js';
import { trackUpdate } from './utils/tracking.js';
import { data as addplayerCommand, execute as addplayerExecute, updatePlayersCache, autocomplete as addplayerAutocomplete } from './commands/addplayer.js';
import { data as saveCommand, execute as saveExecute } from './commands/save.js';
import { data as deletesaveCommand, execute as deletesaveExecute, updateSaveCache, autocomplete as deletesaveAutocomplete } from './commands/deletesave.js';
import { data as listplayersCommand, execute as listplayersExecute } from './commands/listplayers.js';
import { data as configCommand, execute as configExecute } from './commands/config.js';
import { data as myconfigCommand, execute as myconfigExecute } from './commands/myconfig.js';
import { data as removeplayerCommand, execute as removeplayerExecute } from './commands/removeplayer.js';
import { data as seuilCommand, execute as seuilExecute } from './commands/seuil.js';
import { data as frequencyCommand, execute as frequencyExecute } from './commands/frequency.js';
import { data as helpCommand, execute as helpExecute } from './commands/help.js';
import { data as dmCommand, execute as dmExecute } from './commands/dm.js';
import { data as savelistCommand, execute as savelistExecute } from './commands/savelist.js';
import { data as infoCommand, execute as infoExecute, updateInfoCache, autocomplete as infoAutocomplete } from './commands/info.js';
import { data as fsaveCommand, execute as fsaveExecute } from './commands/fsave.js';
import { data as fCommand, execute as fExecute, autocomplete as fAutocomplete } from './commands/f.js';
import { data as fdeletesaveCommand, execute as fdeletesaveExecute, autocomplete as fdeletesaveAutocomplete } from './commands/fdeletesave.js';
import { data as fsavelistCommand, execute as fsavelistExecute } from './commands/fsavelist.js';
import { data as historyCommand, execute as historyExecute, autocomplete as historyAutocomplete } from './commands/history.js';
import { data as permsCommand, execute as permsExecute, handleComponentInteraction as handlePermsInteraction } from './commands/perms.js';
import { data as mypermCommand, execute as mypermExecute } from './commands/myperm.js';
import { data as broadcastCommand, execute as broadcastExecute, handleAutocomplete as handleBroadcastAutocomplete } from './commands/broadcast.js';
import { data as orphanCommand, execute as orphanExecute } from './commands/orphan.js';
import { data as bypassCommand, execute as bypassExecute } from './commands/bypass.js';
import BypassService from './services/bypassService.js';
import { logToChannelAsync, createLogEmbed } from './utils/adminLogs.js';

// Services PHASE 1
import { globalCache } from './services/cacheService.js';
import FeatureFlagService from './services/featureFlagService.js';
import ErrorHandler from './services/errorHandler.js';
import CommandLogService from './services/commandLogService.js';
import AuditLogService from './services/auditLogService.js';
import MaintenanceService from './services/maintenanceService.js';
import CommandMaintenanceService from './services/commandMaintenanceService.js';
import MaintenanceWhitelistService from './services/maintenanceWhitelistService.js';
import AntiSpamService from './services/antiSpamService.js';
import StatsService from './services/statsService.js';
import HealthMonitoringService from './services/healthMonitoringService.js';
import GlobalCommandMiddleware from './middleware/globalMiddleware.js';
import GuildSyncService from './services/guildSyncService.js';

// Services PHASE 2+
import MiddlewarePerformanceService from './services/middlewarePerformanceService.js';
import LogPurgeService from './services/logPurgeService.js';
import AlertingService from './services/alertingService.js';
import GuildActionService from './services/guildActionService.js';
import OrphanLogService from './services/orphanLogService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load environment from process.env; local .env will be loaded automatically by dotenv if present
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Store commands
client.commands = new Collection();
client.commands.set('addplayer', {
  data: addplayerCommand,
  execute: addplayerExecute,
  autocomplete: addplayerAutocomplete
});
client.commands.set('save', {
  data: saveCommand,
  execute: saveExecute
});
client.commands.set('deletesave', {
  data: deletesaveCommand,
  execute: deletesaveExecute,
  autocomplete: deletesaveAutocomplete
});
client.commands.set('listplayers', {
  data: listplayersCommand,
  execute: listplayersExecute
});
client.commands.set('config', {
  data: configCommand,
  execute: configExecute
});
client.commands.set('myconfig', {
  data: myconfigCommand,
  execute: myconfigExecute
});
client.commands.set('removeplayer', {
  data: removeplayerCommand,
  execute: removeplayerExecute
});
// `stats` command removed
client.commands.set('seuil', {
  data: seuilCommand,
  execute: seuilExecute
});
client.commands.set('frequency', {
  data: frequencyCommand,
  execute: frequencyExecute
});
client.commands.set('help', {
  data: helpCommand,
  execute: helpExecute
});
client.commands.set('dm', {
  data: dmCommand,
  execute: dmExecute
});
client.commands.set('savelist', {
  data: savelistCommand,
  execute: savelistExecute
});
client.commands.set('info', {
  data: infoCommand,
  execute: infoExecute,
  autocomplete: infoAutocomplete
});
client.commands.set('fsave', {
  data: fsaveCommand,
  execute: fsaveExecute
});
client.commands.set('f', {
  data: fCommand,
  execute: fExecute,
  autocomplete: fAutocomplete
});
client.commands.set('fdeletesave', {
  data: fdeletesaveCommand,
  execute: fdeletesaveExecute,
  autocomplete: fdeletesaveAutocomplete
});
client.commands.set('fsavelist', {
  data: fsavelistCommand,
  execute: fsavelistExecute
});
client.commands.set('history', {
  data: historyCommand,
  execute: historyExecute,
  autocomplete: historyAutocomplete
});
client.commands.set('setperms', {
  data: permsCommand,
  execute: permsExecute
});
client.commands.set('myperm', {
  data: mypermCommand,
  execute: mypermExecute
});
client.commands.set('broadcast', {
  data: broadcastCommand,
  execute: broadcastExecute,
  handleAutocomplete: handleBroadcastAutocomplete
});
client.commands.set('bypass', {
  data: bypassCommand,
  execute: bypassExecute
});
client.commands.set('orphan', {
  data: orphanCommand,
  execute: orphanExecute
});

// ==================== FUNCTION: Register Guild Commands ====================
/**
 * Register slash commands for a specific guild
 * Used both on bot startup and when joining a new guild
 */
async function registerGuildCommands(guildId) {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

    if (commands.length === 0) {
      console.log(`[COMMAND REGISTER] ⚠️ No commands loaded for guild ${guildId}`);
      return false;
    }

    console.log(`[COMMAND REGISTER] Registering ${commands.length} commands for guild ${guildId}`);
    
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID, guildId),
      { body: commands }
    );
    
    console.log(`[COMMAND REGISTER] ✅ Success for guild ${guildId}`);
    return true;
  } catch (error) {
    console.error(`[COMMAND REGISTER] ❌ Failed for guild ${guildId}:`, error.message);
    return false;
  }
}

// Fonction pour obtenir la version du bot depuis la config
function getVersion() {
  try {
    const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    return config.version || 'Version 1.0.0';
  } catch {
    return 'Version 1.0.0';
  }
}

// Fonction pour récupérer les commits git du jour
function getGitCommits() {
  try {
    const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    // Format: Commits du jour au format "hash|subject|author|date"
    const command = `git -C "${projectRoot}" log --since="24 hours ago" --pretty=format:"%h|%s|%an|%ai" 2>/dev/null || echo ""`;
    const output = execSync(command, { encoding: 'utf-8' }).trim();
    
    if (!output) {
      return [];
    }
    
    return output.split('\n').filter(line => line.trim()).map(line => {
      const [hash, subject, author, date] = line.split('|');
      return {
        hash: hash?.substring(0, 7) || 'unknown',
        subject: subject || 'No message',
        author: author || 'Unknown',
        date: date || new Date().toISOString()
      };
    });
  } catch (error) {
    console.log('[DAILY SUMMARY] Git non disponible ou pas de commits');
    return [];
  }
}

// Fonction pour créer une sauvegarde quotidienne
async function createDailyBackup() {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'backups');
    
    // Créer le répertoire backups s'il n'existe pas
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = path.join(backupDir, `players-${timestamp}.db`);
    const sourceDb = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'players.db');

    // Copier la base de données
    if (existsSync(sourceDb)) {
      copyFileSync(sourceDb, backupPath);
      
      // Enregistrer dans la DB
      const expiresAt = Math.floor(Date.now() / 1000) + (72 * 3600); // 72 heures
      const { recordBackup, deleteExpiredBackups } = await import('./utils/database.js');
      
      await recordBackup(backupPath, expiresAt);
      await deleteExpiredBackups();
      
      console.log(`[BACKUP] ✓ Sauvegarde créée: ${backupPath}`);
    } else {
      console.warn('[BACKUP] Base de données source introuvable');
    }
  } catch (error) {
    console.error('[BACKUP] Erreur lors de la sauvegarde:', error);
  }
}

// Fonction pour compiler et envoyer le résumé quotidien (HYBRID: Git + Tracking)
async function sendDailySummary() {
  try {
    const updatesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'daily-updates.json');
    const updates = JSON.parse(readFileSync(updatesPath, 'utf8'));
    
    // Récupérer la date hier (derniers changements)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    
    const yesterdayEntry = updates.updates.find(u => u.date === yesterdayDate);
    
    if (!yesterdayEntry || !yesterdayEntry.changes || yesterdayEntry.changes.length === 0) {
      console.log('[DAILY SUMMARY] Aucun changement hier');
      return;
    }
    
    // Identifier les catégories de changements
    const categories = {
      '🔢 Version': [],
      '📢 Broadcast': [],
      '🔧 Configuration': [],
      '🗑️ Maintenance': [],
      '📝 Autres': []
    };
    
    for (const change of yesterdayEntry.changes) {
      if (change.type.includes('Version')) {
        categories['🔢 Version'].push(change);
      } else if (change.type.includes('Broadcast')) {
        categories['📢 Broadcast'].push(change);
      } else if (change.type.includes('Config')) {
        categories['🔧 Configuration'].push(change);
      } else if (change.type.includes('Maintenance')) {
        categories['🗑️ Maintenance'].push(change);
      } else {
        categories['📝 Autres'].push(change);
      }
    }
    
    // Récupérer les commits git du jour
    const gitCommits = getGitCommits();
    
    // Créer l'embed du résumé (HYBRID: Git + Tracking)
    const summaryEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: '📰 RÉSUMÉ QUOTIDIEN AUTOMATIQUE', iconURL: 'https://cdn.discordapp.com/emojis/1084164655406129162.png' })
      .setTitle(`📋 Mise à jour du ${yesterdayDate}`)
      .setDescription('Résumé automatique des changements apportés au bot')
      .setThumbnail('https://cdn.discordapp.com/emojis/1084164655406129162.png');
    
    // Ajouter les commits git (Priorité 1 - Plus technique)
    if (gitCommits.length > 0) {
      const commitsList = gitCommits
        .slice(0, 8) // Max 8 commits
        .map(c => `\`${c.hash}\` **${c.subject}** - ${c.author}`)
        .join('\n');
      
      summaryEmbed.addFields({
        name: '🔧 COMMITS GIT',
        value: commitsList,
        inline: false
      });
    } else {
      summaryEmbed.addFields({
        name: '🔧 COMMITS GIT',
        value: '`Aucun commit aujourd\'hui`',
        inline: false
      });
    }
    
    // Ajouter les changements trackés (Priorité 2 - Actions du bot)
    summaryEmbed.addFields({ name: '━━━━━━━━━━━━━━━━━━━━', value: ' ', inline: false });
    
    for (const [category, changes] of Object.entries(categories)) {
      if (changes.length > 0) {
        const changesList = changes.map(c => `\`${c.time}\` ${c.emoji} ${c.description}`).join('\n');
        summaryEmbed.addFields({
          name: category,
          value: changesList || 'Aucun changement',
          inline: false
        });
      }
    }
    
    summaryEmbed
      .addFields({ name: '━━━━━━━━━━━━', value: ' ', inline: false })
      .setFooter({ text: '✨ Résumé hybride (Git + Tracking) | Données non confidentielles', iconURL: 'https://cdn.discordapp.com/emojis/1084164655406129162.png' })
      .setTimestamp();
    
    // Envoyer à tous les serveurs
    let sentCount = 0;
    let failedCount = 0;
    
    for (const guild of client.guilds.cache.values()) {
      try {
        // Récupérer le channel broadcast configuré pour ce serveur (obligatoire)
        const broadcastChannelId = await getBroadcastChannel(guild.id);
        
        if (!broadcastChannelId) {
          console.log(`[DAILY SUMMARY] Aucun broadcast channel configuré pour ${guild.name}`);
          failedCount++;
          continue;
        }
        
        const channel = guild.channels.cache.get(broadcastChannelId);
        
        if (!channel || !channel.isTextBased()) {
          console.log(`[DAILY SUMMARY] Channel broadcast introuvable pour ${guild.name}`);
          failedCount++;
          continue;
        }
        
        if (!channel.permissionsFor(client.user)?.has('SendMessages')) {
          console.log(`[DAILY SUMMARY] Bot n'a pas les permissions dans ${guild.name}/${channel.name}`);
          failedCount++;
          continue;
        }
        
        await channel.send({ embeds: [summaryEmbed] });
        sentCount++;
      } catch (error) {
        console.error(`[DAILY SUMMARY] Erreur pour ${guild.name}:`, error);
        failedCount++;
      }
    }
    
    // Marquer comme envoyé
    const today = new Date().toISOString().split('T')[0];
    yesterdayEntry.sent = true;
    updates.lastSent = today;
    writeFileSync(updatesPath, JSON.stringify(updates, null, 2));
    
    console.log(`[DAILY SUMMARY] Résumé envoyé à ${sentCount} serveurs`);
    if (failedCount > 0) {
      console.log(`[DAILY SUMMARY] ${failedCount} serveurs échoués`);
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi du résumé quotidien:', error);
  }
}

// Fonction réutilisable pour recharger le panel admin principal - VERSION DÉTAILLÉE
async function reloadAdminPanel(interaction) {
  try {
    console.log('[reloadAdminPanel] Starting panel reload...');
    const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    console.log('[reloadAdminPanel] Config loaded successfully');
    
    const startTime = Math.floor((Date.now() - client.uptime) / 1000);
    
    console.log(`[reloadAdminPanel] Recharging panel - maintenanceMode: ${config.maintenanceMode}`);

    const panelEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: '🤖 PANEL ADMINISTRATEUR', iconURL: client.user.displayAvatarURL() })
      .setTitle('⚙️ Centre de Contrôle Gorille™')
      .setDescription(`👋 Bienvenue **${interaction.user.username}**!\n\n> Gère ton bot depuis ce panel central`)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: '━━━━━ 🟢 STATUT SYSTÈME 🟢 ━━━━━', value: ' ', inline: false },
        { name: '🟢 Status', value: '`Online & Active`', inline: true },
        { name: '⏱️ Uptime', value: `<t:${startTime}:R>`, inline: true },
        { name: '🔧 Mode Maintenance', value: config.maintenanceMode ? '🟢 `ACTIVÉ`' : '🔴 `Désactivé`', inline: true },
        { name: '━━━━━ 📊 STATISTIQUES 📊 ━━━━━', value: ' ', inline: false },
        { name: '📋 Serveurs Actifs', value: `\`${client.guilds.cache.size}\` guildes`, inline: true },
        { name: '👥 Utilisateurs Cachés', value: `\`${client.users.cache.size}\` users`, inline: true },
        { name: '🤖 Commandes', value: '`26` commandes', inline: true },
        { name: '━━━━━ 🔐 CONFIGURATION 🔐 ━━━━━', value: ' ', inline: false },
        { name: '📢 Broadcast Channel', value: config.broadcastChannelId ? `<#${config.broadcastChannelId}>` : '`Non configuré`', inline: true },
        { name: '📝 Log Channels', value: `\`${Object.keys(config.logChannels || {}).length}\` channels`, inline: true },
        { name: '🎯 Créateur', value: `<@${config.ownerIds[0]}>`, inline: true }
      )
      .setFooter({ text: `✨ Créé par LeBelge_e | ${getVersion()}`, iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    const buttonsRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_maintenance')
        .setLabel(config.maintenanceMode ? 'Maint: ON' : 'Maint: OFF')
        .setEmoji(config.maintenanceMode ? '🟢' : '🔴')
        .setStyle(config.maintenanceMode ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_servers')
        .setLabel('Serveurs')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_security')
        .setLabel('Sécurité')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Danger)
    );

    const buttonsRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_broadcast')
        .setLabel('Broadcast')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_changelog')
        .setLabel('Changelog')
        .setEmoji('📰')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_backups')
        .setLabel('Backups')
        .setEmoji('💾')
        .setStyle(ButtonStyle.Secondary)
    );

    const buttonsRow3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_commands')
        .setLabel('Commandes Admin')
        .setEmoji('🤖')
        .setStyle(ButtonStyle.Secondary)
    );

    console.log('[reloadAdminPanel] ✅ Panel rebuilt successfully, returning data');
    return { embeds: [panelEmbed], components: [buttonsRow1, buttonsRow2, buttonsRow3] };
  } catch (error) {
    console.error('[reloadAdminPanel] ❌ Error during panel reload:', error);
    return null;
  }
}

client.once('clientReady', async () => {
  console.log(`\n✅ Bot logged in as ${client.user.tag}\n`);
  
  // ========================================
  // COMMAND LOADER STATUS
  // ========================================
  const commandNames = Array.from(client.commands.keys());
  console.log(`[COMMAND LOADER] Loaded ${commandNames.length} commands:`);
  commandNames.forEach((cmd, idx) => {
    console.log(`  ${idx + 1}. ${cmd}`);
  });
  console.log('');
  
  // ========================================
  // PHASE 2+ SERVICES INITIALIZATION
  // ========================================
  console.log('\n🚀 Initializing PHASE 2+ Services...\n');

  try {
    // 1. Initialize feature flags
    console.log('[Init] Initializing feature flags...');
    await FeatureFlagService.initializeDefaultFlags();
    
    // 2. Initialize log purge schedule
    console.log('[Init] Initializing log purge schedule...');
    LogPurgeService.initializePurgeSchedule();
    
    // 3. Initialize alerting service
    console.log('[Init] Initializing alerting service...');
    const alertChannelId = process.env.ALERT_CHANNEL_ID;
    if (alertChannelId) {
      AlertingService.initialize(client, alertChannelId);
      console.log('✅ Alerting service initialized with channel:', alertChannelId);
    } else {
      console.warn('⚠️ ALERT_CHANNEL_ID not set - alerts will be disabled');
    }
    
    // 4. Initialize error log service
    console.log('[Init] Initializing error log service...');
    const ErrorLogService = (await import('./services/errorLogService.js')).default;
    await ErrorLogService.initTable();
    console.log('✅ Error log service initialized');
    
    // 5. Health monitoring ready (will be called on-demand via /health command)
    console.log('[Init] Health monitoring service ready');
    
    console.log('✅ PHASE 2+ Services initialized successfully\n');
  } catch (initError) {
    console.error('❌ Error initializing services:', initError);
    // Continue anyway - services should have fallbacks
  }

  // ==================== GUILD ACTIONS POLLING ====================
  const guildActionsApiUrl = process.env.API_URL;
  if (!guildActionsApiUrl) {
    console.warn('\n⚠️  GUILD ACTIONS disabled: API_URL is not configured.');
  } else {
    console.log('\n📋 Starting guild actions polling (every 10 seconds)...');
    try {
      // Initial sync on startup
      await GuildActionService.syncAndExecuteActions(client);
      
      // Then poll every 10 seconds
      setInterval(async () => {
        await GuildActionService.syncAndExecuteActions(client);
      }, 10 * 1000); // 10 seconds

      console.log('✅ Guild actions polling started (10s interval)');
    } catch (actionError) {
      console.error('❌ Error starting guild actions polling:', actionError);
    }
  }

  // ==================== GUILD SYNC TO DATABASE ====================
  console.log('\n📊 Syncing guilds to database...');
  try {
    await GuildSyncService.syncAllGuilds(client);
  } catch (syncError) {
    console.error('❌ Error syncing guilds:', syncError);
  }

  // Initialiser le système de réinitialisation quotidienne du changelog
  try {
    const { addChange, checkAndResetIfNewDay, initDailyResetJob } = await import('./utils/dailyChangelog.js');
    
    // Vérifier si on est passé à un nouveau jour depuis le dernier démarrage
    checkAndResetIfNewDay();
    
    // Démarrer le cronjob de réinitialisation à minuit
    initDailyResetJob();
    
    // Tracker le démarrage du bot au changelog (message générique)
    addChange('Optimisations et améliorations système');
  } catch (e) {
    console.error('Erreur tracking bot startup:', e);
  }
  
  // Admin panel and admin logs initialization removed (simplified permissions)
  
  // Charger les panels admin en cache (sans les rééditer pour préserver leur apparence)
  try {
    const panelCachePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-panel-cache.json');
    try {
      const panelCacheContent = readFileSync(panelCachePath, 'utf8');
      const panelCache = JSON.parse(panelCacheContent);
      
      for (const [guildId, { channelId, messageId }] of Object.entries(panelCache)) {
        try {
          const guild = await client.guilds.fetch(guildId);
          const channel = await guild.channels.fetch(channelId);
          const message = await channel.messages.fetch(messageId);
          
          // Stocker dans la Map du client (ne pas rééditer le message pour préserver son apparence)
          client.adminPanelMessages.set(guildId, messageId);
          console.log(`✅ Panel admin chargé en cache pour la guild ${guildId}`);
        } catch (e) {
          if (e.message.includes('Unknown Message')) {
            console.warn(`⚠️ Panel message supprimé pour ${guildId}, retrait du cache`);
            // Retirer du cache si le message n'existe plus
            const panelCachePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-panel-cache.json');
            try {
              const panelCache = JSON.parse(readFileSync(panelCachePath, 'utf8'));
              delete panelCache[guildId];
              writeFileSync(panelCachePath, JSON.stringify(panelCache, null, 2));
            } catch (e2) {
              // Ignore
            }
          } else {
            console.error(`Erreur lors du chargement du panel pour ${guildId}:`, e.message);
          }
        }
      }
    } catch (e) {
      // Fichier de cache n'existe pas encore, c'est normal
    }
  } catch (e) {
    console.error('Erreur lors du chargement du cache des panels:', e);
  }
  
  // Message de démarrage avec crédits
  console.log('╔════════════════════════════════════════╗');
  console.log('║   ✨ Créé par LeBelge_e                ║');
  console.log('║   🎮 Discord Bot de Monitoring Active  ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Lire la version depuis admin-config.json
  try {
    const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const version = config.version || 'Version 1.0.0';

    // Définir le status du bot avec la version depuis admin-config.json
    await client.user.setPresence({
      activities: [{
        name: version,
        type: ActivityType.Playing
      }],
      status: 'online'
    });

    console.log(`📊 Bot status updated to: ${version}\n`);
  } catch (error) {
    console.error('Erreur lors de la lecture de news.json:', error);
    // Fallback si erreur
    await client.user.setPresence({
      activities: [{
        name: 'Version 1.0.1',
        type: ActivityType.Playing
      }],
      status: 'online'
    });
  }

  const COMMAND_REGISTRATION_TIMEOUT = 60000; // 60 secondes max

  try {
    const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

    console.log('\n📝 Registering slash commands...');
    console.log(`📋 Commands loaded: ${commands.length} (${commands.map(c => c.name).join(', ')})`);
    
    // Register commands for all existing guilds
    if (client.guilds.cache.size > 0) {
      console.log(`\n📌 Registering for ${client.guilds.cache.size} guild(s):`);
      for (const guild of client.guilds.cache.values()) {
        await registerGuildCommands(guild.id);
      }
    } else {
      console.log('\n⚠️ No guilds in cache yet (bot just started)');
    }

    console.log('\n✅ Guild commands registration complete\n');

  } catch (error) {
    console.error('❌ Error setting up command registration:', error?.message || error);
  }

  // Start cron jobs immediately (ne pas bloquer sur l'enregistrement)
  await initCronJobs(client);
  
  // Planifier l'envoi du résumé quotidien à 20h (chaque jour)
  cron.schedule('0 20 * * *', async () => {
    console.log('[DAILY SUMMARY] Compilation et envoi du résumé quotidien');
    await sendDailySummary();
  });

  // Backup quotidien à 21h
  cron.schedule('0 21 * * *', async () => {
    console.log('[BACKUP] Création d\'une sauvegarde quotidienne');
    await createDailyBackup();
  });

  console.log('✓ CRON jobs actifs (vérifications de joueurs + résumé 20h + backup 21h)');
});

// Vérifier qui invite le bot (seul l'owner peut)
const OWNER_ID = '492627367114702849';

// Counter to verify handler is registered only once
let guildCreateHandlerCount = 0;

client.on('guildCreate', async (guild) => {
  try {
    // ═══════════════════════════════════════════════════════════════
    // 🔴 BAN CHECK MUST BE FIRST - BEFORE ANY OTHER ACTION
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`[GUILD CREATE] ${guild.id} ${guild.name}`);
    
    // Guild join logic does not include ban checks anymore
    console.log(`[GUILD CREATE] ${guild.id} ${guild.name} - no ban check executed`);
    if (isBanned) {
      console.log(`[GUILD BAN - BLOCKED] 🚫 ${guild.id} ${guild.name}`);
      
      // Get ban record to include reason
      const db = (await import('./services/database.js')).default;
      let banReason = 'Aucune raison fournie';
      try {
        const banRecord = await db.query(
          'SELECT reason FROM banned_guilds WHERE guild_id = $1 AND active = true',
          [guild.id]
        );
        if (banRecord.rows.length > 0 && banRecord.rows[0].reason) {
          banReason = banRecord.rows[0].reason;
        }
      } catch (err) {
        console.warn(`[GUILD BAN] Could not fetch ban reason: ${err.message}`);
      }
      
      // Try to send ban message to accessible channel
      try {
        // Priority 1: systemChannel
        let targetChannel = null;
        
        if (guild.systemChannel) {
          const perms = guild.systemChannel.permissionsFor(guild.members.me);
          if (perms?.has(['ViewChannel', 'SendMessages'])) {
            targetChannel = guild.systemChannel;
          }
        }
        
        // Priority 2: First accessible TextChannel
        if (!targetChannel) {
          targetChannel = guild.channels.cache.find(ch => {
            if (!ch.isTextBased?.()) return false;
            const perms = ch.permissionsFor(guild.members.me);
            return perms?.has(['ViewChannel', 'SendMessages']);
          });
        }
        
        // Send ban notification message
        if (targetChannel) {
          await targetChannel.send({
            content: 
              `🚫 **Ce serveur est banni de GorilleTM.**\n` +
              `**Raison:** ${banReason}\n` +
              `Contactez un administrateur si vous pensez que c'est une erreur.`
          });
          console.log(`[GUILD BAN - MESSAGE SENT] ${targetChannel.id}`);
          
          // Wait 1.5 seconds before leaving
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          console.log(`[GUILD BAN - NO CHANNEL] Could not find accessible channel`);
        }
      } catch (msgErr) {
        console.warn(`[GUILD BAN - MESSAGE ERROR] ${msgErr.message}`);
      }
      
      // Leave the server
      try {
        await guild.leave();
        console.log(`[GUILD BAN - LEFT] ✅ ${guild.id}`);
      } catch (leaveError) {
        console.error(`[GUILD BAN - LEAVE ERROR] ${guild.id} - ${leaveError.message}`);
      }
      
      // Log audit AFTER leaving
      try {
        const AuditLogService = (await import('./services/auditLogService.js')).default;
        await AuditLogService.logAction({
          actionType: 'guild_reinvite_blocked',
          adminId: 'system',
          targetId: guild.id,
          targetName: guild.name,
          reason: 'Guild banned',
          details: { wasBlocked: true, banReason: banReason }
        });
      } catch (auditErr) {
        // Silent fail on audit
      }
      
      return; // STOP HERE - NO MORE PROCESSING
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ✅ ONLY PROCEED IF NOT BANNED
    // ═══════════════════════════════════════════════════════════════
    
    guildCreateHandlerCount++;
    console.log(`[HANDLER-COUNT] guildCreate handler called #${guildCreateHandlerCount}`);
    
    console.log(`🆕 Bot invité sur le serveur: ${guild.name} (ID: ${guild.id})`);

    // ==================== OWNER-ONLY INVITE CHECK ====================
    console.log(`\n[STEP 5] Checking if inviter is owner...`);
    
    // Récupérer les audit logs pour voir qui a invité le bot
    const auditLogs = await guild.fetchAuditLogs({
      limit: 10,
      type: AuditLogEvent.BotAdd
    });

    const botAddEntry = auditLogs.entries.first();
    
    console.log(`[OWNER-CHECK]`, {
      auditLogsFound: !!auditLogs,
      botAddEntryFound: !!botAddEntry,
      targetId: botAddEntry?.targetId,
      clientUserId: client.user?.id,
      match: botAddEntry?.targetId === client.user?.id
    });
    
    if (!botAddEntry || botAddEntry.targetId !== client.user.id) {
      console.log(`⚠️ [OWNER-CHECK] Impossible de vérifier l'invité - audit log not found`);
      // Garder le bot par prudence si on peut pas vérifier
      return;
    }

    const inviterId = botAddEntry.executor.id;
    const inviterName = botAddEntry.executor.username;
    
    console.log(`[OWNER-CHECK]`, {
      inviterId: inviterId,
      inviterName: inviterName,
      ownerId: OWNER_ID,
      isOwner: inviterId === OWNER_ID
    });
    
    if (inviterId !== OWNER_ID) {
      console.log(`\n❌ [OWNER-CHECK-FAIL] ${inviterName} tried to invite bot (UNAUTHORIZED)`);
      
      // Envoyer un message avant de partir
      const systemChannel = guild.systemChannel;
      if (systemChannel && systemChannel.permissionsFor(client.user).has('SendMessages')) {
        try {
          await systemChannel.send({
            content: `❌ **Accès refusé** - Seul <@${OWNER_ID}> peut ajouter ce bot sur un serveur.`
          });
        } catch (msgErr) {
          console.warn(`[OWNER-CHECK] Could not send rejection message: ${msgErr.message}`);
        }
      }
      
      // Quitter le serveur
      try {
        await guild.leave();
        console.log(`🚪 [OWNER-CHECK] Bot left guild ${guild.name}`);
      } catch (leaveErr) {
        console.error(`[OWNER-CHECK] Error leaving: ${leaveErr.message}`);
      }
    } else {
      console.log(`\n✅ [OWNER-CHECK-PASS] Bot invited by owner - WELCOME!`);
      
      // ==================== REGISTER SLASH COMMANDS ====================
      console.log(`\n[COMMAND REGISTER] Registering commands...`);
      // Register commands for the new guild (appear immediately)
      const registered = await registerGuildCommands(guild.id);
      
      if (!registered) {
        console.warn(`[GUILD CREATE] Failed to register commands for ${guild.name}`);
      } else {
        console.log(`[GUILD CREATE] Commands registered successfully`);
      }
      
      // Message de bienvenue optional
      const systemChannel = guild.systemChannel;
      if (systemChannel && systemChannel.permissionsFor(client.user).has('SendMessages')) {
        try {
          await systemChannel.send({
            content: `👋 **Bienvenue!** Le bot Pactify est maintenant actif sur ce serveur.\n\nUtilise /config pour configurer le channel d'alertes!`
          });
        } catch (welcomeErr) {
          console.warn(`[GUILD CREATE] Could not send welcome message: ${welcomeErr.message}`);
        }
      }

      // ==================== SYNC GUILD TO DATABASE ====================
      console.log(`\n[GUILD SYNC] Syncing guild to database...`);
      try {
        await GuildSyncService.syncGuild(guild);
        console.log(`[GUILD SYNC] ✅ Guild sync complete`);
      } catch (syncError) {
        console.error(`[GUILD SYNC] Error syncing guild ${guild.id}:`, syncError);
      }
    }
    
  } catch (error) {
    console.error(`❌ [GUILD CREATE - ERROR] ${error.message}`);
    console.error(error.stack);
  }
});

// ==================== GUILD DELETE EVENT ====================
// When bot is removed from a guild, mark it as bot_present=false
client.on('guildDelete', async (guild) => {
  console.log(`[GUILD DELETE] Bot removed from guild: ${guild.name} (${guild.id})`);
  
  try {
    await GuildSyncService.handleGuildDelete(guild.id);
  } catch (error) {
    console.error(`[GUILD DELETE] Error handling guild delete:`, error);
  }
});

// ==================== GUILD MEMBER ADD EVENT ====================
// When a member joins, update member_count
client.on('guildMemberAdd', async (member) => {
  try {
    await GuildSyncService.handleMemberAdd(member.guild);
  } catch (error) {
    console.error(`[GUILD MEMBER ADD] Error:`, error);
  }
});

// ==================== GUILD MEMBER REMOVE EVENT ====================
// When a member leaves, update member_count
client.on('guildMemberRemove', async (member) => {
  try {
    await GuildSyncService.handleMemberRemove(member.guild);
  } catch (error) {
    console.error(`[GUILD MEMBER REMOVE] Error:`, error);
  }
});

// Listener pour les messages broadcast
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    // Vérifier si le message vient du channel broadcast
    if (message.channelId === config.broadcastChannelId && message.author.id === config.ownerIds[0]) {
      const content = message.content;
      
      if (!content) return;

      let sent = 0;
      let failed = 0;
      
      const broadcastChannelName = config.broadcastChannelName || 'announcements';

      // Envoyer à tous les serveurs
      for (const guild of client.guilds.cache.values()) {
        try {
          // Chercher d'abord le channel avec le nom configuré
          let channel = guild.channels.cache.find(c => 
            c.isTextBased() && 
            c.name.toLowerCase() === broadcastChannelName.toLowerCase() &&
            c.permissionsFor(client.user)?.has('SendMessages')
          );
          
          // Si le channel configuré n'existe pas, chercher le premier channel texte avec permissions
          if (!channel) {
            channel = guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(client.user)?.has('SendMessages'));
          }
          
          if (channel) {
            await channel.send({
              embeds: [new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('📢 ANNONCE')
                .setDescription(content)
                .setFooter({ text: `${guild.name} • Message du créateur du bot` })
                .setTimestamp()]
            });
            sent++;
          }
        } catch (err) {
          console.error(`Erreur broadcast pour ${guild.name}:`, err);
          failed++;
        }
      }

      // Confirmation
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('✅ Broadcast Envoyé')
          .setDescription(`Envoyé à **${sent}** serveurs${failed > 0 ? `\n:Échecs: ${failed}` : ''}`)],
        allowedMentions: { repliedUser: false }
      });

      console.log(`📢 [BROADCAST] Envoyé à ${sent} serveurs`);
    }
  } catch (error) {
    console.error('[BROADCAST ERROR]', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  // Gérer les slash commands
  if (interaction.isChatInputCommand()) {
    const commandName = interaction.commandName;
    const commandStartTime = performance.now();
    let middlewareConflict = null;
    let commandBlockedBy = null;

    try {
      // ============================================
      // PHASE 2: Global Middleware Integration
      // ============================================
      // Mode SAFE: Middleware runs in parallel with old checks
      // If middleware fails, old checks take priority
      
      // 1️⃣ CHECK IF MIDDLEWARE IS ENABLED
      let middlewareEnabled = true;
      try {
        middlewareEnabled = await FeatureFlagService.isEnabled('middleware_enabled');
      } catch (flagError) {
        console.error('[PHASE2] Error checking middleware flag, assuming enabled:', flagError.message);
      }

      // 1️⃣ RUN NEW MIDDLEWARE (Safe mode - all wrapped in try-catch)
      let middlewareResult = null;
      if (middlewareEnabled) {
        try {
          middlewareResult = await GlobalCommandMiddleware.execute(interaction, commandName);
          if (!middlewareResult.proceed) {
            commandBlockedBy = middlewareResult.reason;
            console.log(`[PHASE2] Middleware blocked command: ${commandBlockedBy}`);
          }
        } catch (middlewareError) {
          console.error(`[PHASE2] Middleware error (safe fallback): ${middlewareError.message}`);
          // Continue with old checks if middleware fails
        }
      } else {
        console.log(`[PHASE2] Middleware disabled, skipping (using old checks only)`);
      }

      // 2️⃣ RUN OLD CHECKS (for conflict detection)
      let oldChecksBlocked = false;

      // OLD CHECK 2: Maintenance mode from config
      try {
        const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        
        // Mode maintenance: bloquer tout le monde sauf les whitelistés
        if (config.maintenanceMode) {
          const isWhitelisted = await MaintenanceWhitelistService.isWhitelisted(interaction.user.id);
          
          if (!isWhitelisted) {
            oldChecksBlocked = true;
            
            // CONFLICT DETECTION
            if (middlewareResult?.proceed) {
              middlewareConflict = 'OLD:MAINTENANCE vs NEW:ALLOWED';
              console.warn(`[CONFLICT] Maintenance blocked but middleware allowed: ${commandName}`);
            }
            
            commandBlockedBy = commandBlockedBy || 'Maintenance (old check)';
            
            return interaction.reply({
              content: '🔴 **Le bot est actuellement en maintenance.** Les commandes sont temporairement désactivées.',
              flags: 64
            });
          }
          
          console.log(`[WHITELIST] User ${interaction.user.id} bypassed global maintenance (whitelisted)`);
        }
      } catch (error) {
        console.error('[MAINTENANCE CHECK] Erreur:', error);
      }

      // PHASE 3C: Per-Command Maintenance Check
      try {
        const isInMaintenance = await CommandMaintenanceService.isCommandInMaintenance(commandName);
        if (isInMaintenance) {
          // Check global whitelist OR command-specific whitelist
          const isWhitelisted = await MaintenanceWhitelistService.isWhitelisted(interaction.user.id, commandName);
          
          if (!isWhitelisted) {
            console.log(`[CMD MAINTENANCE] Command ${commandName} is in maintenance and user ${interaction.user.id} is not whitelisted`);
            return interaction.reply({
              content: `⚠️ **La commande \`/${commandName}\` est actuellement en maintenance.**\n\nElle sera disponible dans peu de temps.`,
              flags: 64
            });
          }
          
          console.log(`[WHITELIST] User ${interaction.user.id} bypassed maintenance for command ${commandName}`);
        }
      } catch (error) {
        console.error('[CMD MAINTENANCE CHECK] Erreur:', error);
      }

      // OLD CHECK 3: Broadcast channel verification
      const subcommand = interaction.options.getSubcommand(false);
      
      if (commandName !== 'broadcast' || subcommand !== 'config') {
        try {
          const broadcastChannelId = await getBroadcastChannel(interaction.guildId);
          if (!broadcastChannelId) {
            oldChecksBlocked = true;
            commandBlockedBy = commandBlockedBy || 'Broadcast not configured (old check)';

            const embed = new EmbedBuilder()
              .setColor(0xFF9900)
              .setTitle('⚠️・CONFIGURATION REQUISE')
              .setDescription('Pour utiliser ce bot, vous devez d\'abord configurer le channel de broadcast!')
              .addFields({
                name: '📝 Pourquoi?',
                value: 'Le bot envoie les annonces importantes, maintenances et nouvelles fonctionnalités dans ce channel'
              })
              .addFields({
                name: '⚙️ Comment configurer?',
                value: '1. Créez ou choisissez un channel (ex: #annonces)\n2. Utilisez: `/broadcast config #annonces`\n3. C\'est tout! Le bot sera alors actif'
              })
              .addFields({
                name: '✅ Une fois configuré',
                value: 'Vous recevrez automatiquement les annonces du bot et pourrez utiliser toutes les commandes'
              })
              .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
              .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: 64 });
          }
        } catch (error) {
          console.error('[BROADCAST CHECK ERROR]', error);
          return interaction.reply({
            content: '❌ Erreur lors de la vérification de configuration',
            flags: 64
          });
        }
      }

      // 3️⃣ CHECK IF BLOCKED BY MIDDLEWARE
      if (middlewareResult && !middlewareResult.proceed) {
        const message = {
          content: `⛔ ${middlewareResult.reason || 'Commande non autorisée.'}`,
          ephemeral: true
        };
        if (!interaction.replied && !interaction.deferred) {
          return interaction.reply(message);
        } else if (interaction.deferred && !interaction.replied) {
          return interaction.editReply(message);
        } else {
          return interaction.followUp(message).catch(() => null);
        }
      }

      // 4️⃣ COMMAND EXECUTION (same as before)
      const command = client.commands.get(commandName);
      if (!command) return;

      // Defer the interaction to allow editReply usage in commands
      await interaction.deferReply();
      
      // Track l'exécution (NEW: using CommandLogService)
      try {
        CommandLogService.logCommand({
          commandName,
          userId: interaction.user.id,
          username: interaction.user.username,
          guildId: interaction.guild?.id,
          guildName: interaction.guild?.name,
          arguments: interaction.options?.data?.map(d => `${d.name}=${d.value}`) || [],
          success: true,
          executionTimeMs: 0 // Will be updated after execution
        }).catch(err => console.error('[CommandLog] Erreur:', err));
      } catch (logError) {
        console.error('[CommandLog] Failed to start logging:', logError);
      }
      
      // OLD: Also keep the old tracker for compatibility
      const { trackCommandExecution } = await import('./utils/database.js');
      trackCommandExecution(commandName, interaction.user.id, interaction.guildId).catch(err => console.error('[TRACK CMD] Erreur:', err));
      
      // Execute the command
      await command.execute(interaction);
      
      // Log successful execution
      const executionTimeMs = Math.round(performance.now() - commandStartTime);
      try {
        CommandLogService.logCommand({
          commandName,
          userId: interaction.user.id,
          username: interaction.user.username,
          guildId: interaction.guild?.id,
          guildName: interaction.guild?.name,
          arguments: interaction.options?.data?.map(d => `${d.name}=${d.value}`) || [],
          success: true,
          executionTimeMs
        }).catch(err => console.error('[CommandLog] Erreur:', err));
        
        // Record stats
        if (interaction.guild) {
          StatsService.recordCommandExecution(commandName, interaction.guild.id, executionTimeMs)
            .catch(err => console.error('[Stats] Erreur:', err));
        }
      } catch (logError) {
        console.error('[CommandLog] Failed to log execution:', logError);
      }
      
    } catch (error) {
      const executionTimeMs = Math.round(performance.now() - commandStartTime);
      
      // ========================================
      // DETAILED ERROR LOGGING
      // ========================================
      console.error('[COMMAND ERROR]', {
        commandName: commandName,
        commandId: interaction.commandId,
        guildId: interaction.guildId,
        guildName: interaction.guild?.name,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        username: interaction.user.username,
        options: interaction.options?.data?.map(d => ({ name: d.name, value: d.value })) || [],
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      });
      
      // Log to database
      try {
        const errorLogService = (await import('./services/errorLogService.js')).default;
        await errorLogService.logCommandError({
          errorType: 'COMMAND_ERROR',
          errorMessage: error.message,
          errorStack: error.stack,
          commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId,
          severity: 'high',
          resolved: false,
          metadata: {
            channelId: interaction.channelId,
            username: interaction.user.username,
            guildName: interaction.guild?.name,
            options: interaction.options?.data?.map(d => d.name) || []
          }
        });
      } catch (logError) {
        console.error('[ERROR LOG SERVICE] Failed to log error:', logError.message);
      }
      
      // Log command execution as failed
      try {
        CommandLogService.logCommand({
          commandName,
          userId: interaction.user.id,
          username: interaction.user.username,
          guildId: interaction.guild?.id,
          guildName: interaction.guild?.name,
          arguments: interaction.options?.data?.map(d => `${d.name}=${d.value}`) || [],
          success: false,
          errorMessage: error.message,
          executionTimeMs
        }).catch(err => console.error('[CommandLog] Erreur:', err));
      } catch (logError) {
        console.error('[CommandLog] Failed to log error:', logError);
      }
      
      // Gérer les erreurs de manière sécurisée
      try {
        const errorCode = error.code || 'COMMAND_FAILED';
        const errorResponse = {
          content: 
            `❌ **Erreur lors de l'exécution de la commande**\n` +
            `**Code erreur:** \`${errorCode}\`\n` +
            `**Commande:** \`/${commandName}\`\n` +
            `L'erreur a été enregistrée et un administrateur a été notifié.`,
          flags: 64 // ephemeral
        };

        if (!interaction.replied && !interaction.deferred) {
          // L'interaction n'a pas encore été ackowledgée
          await interaction.reply(errorResponse);
        } else if (interaction.deferred && !interaction.replied) {
          // deferReply a réussi mais command execution a échoué
          await interaction.editReply(errorResponse);
        }
        // Si replied est true, on peut rien faire de plus
      } catch (replyError) {
        // L'interaction a expiré, impossible de répondre
        console.error('❌ [INTERACTION EXPIRED] Unable to send error response:', {
          commandName,
          userId: interaction.user.id,
          errorMessage: replyError.message
        });
      }
    }
  }

  // Gérer les composants
  if (interaction.isStringSelectMenu() || interaction.isButton()) {
    console.log(`[BUTTON/SELECT] customId=${interaction.customId}, userId=${interaction.user.id}`);
    
    // ==================== BAN CHECK REMOVED ====================
    // No ban checking for buttons/selects anymore.
    
    // Handle bypass pagination buttons
    // Bypass interactive menu handling (Add / Remove / List / Back)
    if (interaction.customId && interaction.customId.startsWith('bypass_menu_')) {
      try {
        // Only owner can interact with the bypass UI
        const OWNER_ID = process.env.OWNER_ID || process.env.OWNER_IDS?.split(',')[0] || '492627367114702849';
        if (interaction.user.id !== OWNER_ID) {
          return interaction.reply({ content: '❌ Seul le créateur du bot peut utiliser ce panneau.', flags: 64 });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
        const id = interaction.customId.replace('bypass_menu_', '');

        // Main menu
        if (id === 'back') {
          const embed = new EmbedBuilder()
            .setTitle('Gestion Bypass')
            .setDescription('Utilise les boutons ci-dessous pour **Add**, **Remove** ou **List** les utilisateurs bypass.\n\n• Add: ouvre un formulaire (mention ou id) + note (obligatoire)\n• Remove: ouvre un formulaire (mention ou id)')
            .setColor(0x5865F2);

          const addBtn = new ButtonBuilder().setCustomId('bypass_menu_add').setLabel('Add').setStyle(ButtonStyle.Success);
          const removeBtn = new ButtonBuilder().setCustomId('bypass_menu_remove').setLabel('Remove').setStyle(ButtonStyle.Danger);
          const listBtn = new ButtonBuilder().setCustomId('bypass_menu_list').setLabel('List').setStyle(ButtonStyle.Primary);
          const row = new ActionRowBuilder().addComponents(addBtn, removeBtn, listBtn);

          return interaction.update({ embeds: [embed], components: [row] }).catch(() => null);
        }

        // Add -> open modal to collect target and note
        if (id === 'add') {
          const modal = new ModalBuilder().setCustomId(`bypass_modal_add:${interaction.message.id}`).setTitle('Ajouter un bypass');
          const targetInput = new TextInputBuilder().setCustomId('bypass_target').setLabel('Utilisateur (mention ou id)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('@user ou id');
          const noteInput = new TextInputBuilder().setCustomId('bypass_note').setLabel('Note (raison) - Obligatoire').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Ex: Membre de l\'équipe');
          modal.addComponents(new ActionRowBuilder().addComponents(targetInput), new ActionRowBuilder().addComponents(noteInput));
          return interaction.showModal(modal).catch(err => { console.error('[BYPASS] showModal error', err); });
        }

        // Remove -> open modal to collect target
        if (id === 'remove') {
          const modal = new ModalBuilder().setCustomId(`bypass_modal_remove:${interaction.message.id}`).setTitle('Retirer un bypass');
          const targetInput = new TextInputBuilder().setCustomId('bypass_target').setLabel('Utilisateur (mention ou id)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('@user ou id');
          modal.addComponents(new ActionRowBuilder().addComponents(targetInput));
          return interaction.showModal(modal).catch(err => { console.error('[BYPASS] showModal error', err); });
        }

        // List -> render first page with Back button
        if (id === 'list') {
          const BypassService = (await import('./services/bypassService.js')).default;
          const rows = await BypassService.list();
          const perPage = 6;
          const pages = [];
          for (let i = 0; i < rows.length; i += perPage) {
            const slice = rows.slice(i, i + perPage);
            const lines = [];
            for (const r of slice) {
              let who = r.discord_id;
              try { const u = await interaction.client.users.fetch(r.discord_id).catch(() => null); if (u) who = `${u.tag} (<@${r.discord_id}>)`; } catch (e) {}
              let addedBy = r.added_by || 'unknown';
              try { const a = await interaction.client.users.fetch(r.added_by).catch(() => null); if (a) addedBy = `${a.tag} (<@${r.added_by}>)`; } catch (e) {}
              const note = r.note ? ` — ${r.note}` : '';
              lines.push(`**${who}**\nAjouté par: ${addedBy}${note}`);
            }
            pages.push(lines.join('\n\n'));
          }

          const page = 0;
          const embed = new EmbedBuilder().setTitle('Liste des utilisateurs bypass').setDescription(pages[page] || 'Aucun').setFooter({ text: `Page ${page + 1} / ${pages.length}` });
          const prev = new ButtonBuilder().setCustomId(`bypass_page_prev:${page}`).setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(true);
          const next = new ButtonBuilder().setCustomId(`bypass_page_next:${page}`).setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(pages.length <= 1);
          const back = new ButtonBuilder().setCustomId('bypass_menu_back').setLabel('↩️ Menu').setStyle(ButtonStyle.Secondary);
          const row = new ActionRowBuilder().addComponents(prev, next, back);
          return interaction.update({ embeds: [embed], components: [row] }).catch(() => null);
        }
      } catch (e) {
        console.error('[BYPASS MENU] Error:', e.message || e);
      }
      return;
    }

    if (interaction.customId && interaction.customId.startsWith('bypass_page_')) {
      try {
        const [prefix, pageStr] = interaction.customId.split(':');
        const parts = prefix.split('_'); // ['bypass','page','prev']
        const dir = parts[2];
        const currentPage = Number(pageStr) || 0;

        const BypassService = (await import('./services/bypassService.js')).default;
        const rows = await BypassService.list();
        const perPage = 6;
        const pages = [];
        for (let i = 0; i < rows.length; i += perPage) {
          const slice = rows.slice(i, i + perPage);
          const lines = [];
          for (const r of slice) {
            let who = r.discord_id;
            try { const u = await interaction.client.users.fetch(r.discord_id).catch(() => null); if (u) who = `${u.tag} (<@${r.discord_id}>)`; } catch (e) {}
            let addedBy = r.added_by || 'unknown';
            try { const a = await interaction.client.users.fetch(r.added_by).catch(() => null); if (a) addedBy = `${a.tag} (<@${r.added_by}>)`; } catch (e) {}
            const note = r.note ? ` — ${r.note}` : '';
            lines.push(`**${who}**\nAjouté par: ${addedBy}${note}`);
          }
          pages.push(lines.join('\n\n'));
        }

        let newPage = currentPage;
        if (dir === 'next') newPage = Math.min(pages.length - 1, currentPage + 1);
        if (dir === 'prev') newPage = Math.max(0, currentPage - 1);

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const embed = new EmbedBuilder().setTitle('Liste des utilisateurs bypass').setDescription(pages[newPage] || 'Aucun').setFooter({ text: `Page ${newPage + 1} / ${pages.length}` });

        const prev = new ButtonBuilder().setCustomId(`bypass_page_prev:${newPage}`).setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(newPage === 0);
        const next = new ButtonBuilder().setCustomId(`bypass_page_next:${newPage}`).setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(newPage >= pages.length - 1);
        const row = new ActionRowBuilder().addComponents(prev, next);

        await interaction.update({ embeds: [embed], components: [row] }).catch(() => null);
      } catch (e) {
        console.error('[BYPASS PAGINATION] Error:', e.message || e);
      }
      return;
    }

    // Admin panel handling removed
    if (interaction.customId && (interaction.customId.startsWith('admin_') || interaction.customId.startsWith('logs_') || interaction.customId.startsWith('cmd_'))) {
      // ignore legacy admin panel interactions
      return;
    }
    if (interaction.customId.startsWith('perms_') || interaction.customId === 'perms_back') {
      try {
        await handlePermsInteraction(interaction);
      } catch (error) {
        console.error('Perms interaction error:', error);
      }
      return;
    }

    // Handler pour le debannissement des serveurs (désactivé)
    if (interaction.isStringSelectMenu() && interaction.customId === 'server_unban_select') {
      return interaction.reply({
        content: '🚫 La fonctionnalité de débannissement serveur est désactivée.',
        flags: 64
      }).catch(() => null);
    }

    // Handler indépendant pour le bouton Sécurité
    if (interaction.isButton() && interaction.customId === 'admin_security') {
      try {
        await interaction.deferUpdate();
        const securityEmbed = await getSecurityEmbed();
        const buttons = getSecurityActionButtons();
        await interaction.editReply({ embeds: [securityEmbed], components: [buttons] });
      } catch (error) {
        console.error('Erreur security button:', error);
        try {
          await interaction.followUp({
            content: `❌ Erreur: ${error.message}`,
            flags: 64
          });
        } catch (e) {
          console.error('Error sending error message:', e);
        }
      }
      return;
    }

    // Wrappez tous les handlers de boutons admin dans un try/catch
    try {
      // Handler pour le select menu de sélection de serveur
      if (interaction.isStringSelectMenu() && interaction.customId === 'admin_server_select') {
        const serverId = interaction.values[0];
        const guild = client.guilds.cache.get(serverId);
        
        if (!guild) {
          await interaction.update({ content: '❌ Serveur non trouvé', components: [] });
          return;
        }

        const { deletePlayersByGuild } = await import('./utils/database.js');
        
        const isBanned = false;
        const banInfo = null;

        // Créer l'embed d'infos du serveur
        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle(`📋 ${guild.name}`)
          .setThumbnail(guild.iconURL())
          .addFields(
            { name: '🆔 ID', value: `\`${guild.id}\``, inline: true },
            { name: '👥 Membres', value: `\`${guild.memberCount}\``, inline: true },
            { name: '📅 Créé', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '🎯 Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
            { name: '📱 Channels', value: `\`${guild.channels.cache.size}\``, inline: true },
            { name: '👤 Rôles', value: `\`${guild.roles.cache.size}\``, inline: true }
          );

        embed.setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' }).setTimestamp();

        // Boutons d'actions
        const actionButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`server_delete_${serverId}`)
            .setLabel('🗑️ Supprimer les données')
            .setStyle(ButtonStyle.Danger)
        );

        const backButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin_servers')
            .setLabel('← Retour')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [actionButtons, backButton] });
      } else if (interaction.isButton() && interaction.customId.startsWith('server_delete_')) {
        // Handler pour supprimer les données du serveur
        const serverId = interaction.customId.replace('server_delete_', '');
        const guild = client.guilds.cache.get(serverId);

        // Créer un modal pour confirmation
        const confirmationInput = new TextInputBuilder()
          .setCustomId('delete_confirmation')
          .setLabel('Confirmation: tapez "CONFIRMER"')
          .setPlaceholder('Type CONFIRMER pour valider la suppression')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const confirmRow = new ActionRowBuilder().addComponents(confirmationInput);
        const confirmModal = new ModalBuilder()
          .setCustomId(`delete_modal_${serverId}`)
          .setTitle(`🗑️ Supprimer ${guild?.name || 'Serveur'}`)
          .addComponents(confirmRow);

        await interaction.showModal(confirmModal);
      } else if (interaction.isButton() && interaction.customId.startsWith('server_ban_')) {
        return interaction.reply({
          content: '🚫 La fonctionnalité de ban serveur est désactivée.',
          flags: 64
        });
      } else if (interaction.isButton() && interaction.customId.startsWith('server_unban_')) {
        return interaction.reply({
          content: '🚫 La fonctionnalité de débannissement serveur est désactivée.',
          flags: 64
        });
      } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('logs_select_')) {
        try {
          const logType = interaction.customId.replace('logs_select_', '');
          const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
          const config = JSON.parse(readFileSync(configPath, 'utf8'));
        
        const selectedChannelId = interaction.values[0];
        const selectedChannel = interaction.guild.channels.cache.get(selectedChannelId);
        
        if (!config.logChannels) {
          config.logChannels = {};
        }
        
        config.logChannels[logType] = selectedChannelId;
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        // Montrer une confirmation dans le panel lui-même
        const confirmEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Configuration Sauvegardée')
          .setDescription(`**${logType.toUpperCase()}** configuré sur ${selectedChannel}`)
          .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
          .setTimestamp();
        
        // Mettre à jour le message du panel avec la confirmation
        await interaction.update({ embeds: [confirmEmbed], components: [] });
        
        logToChannelAsync('admin', createLogEmbed(
          'Configuration de Log Modifiée',
          `${interaction.user.username} a configuré ${logType} sur ${selectedChannel}`
        ));
        
        // Après 2 secondes: revenir au panel admin principal avec tous les boutons
        setTimeout(async () => {
          try {
            const panelMessageId = adminPanelMessages.get(interaction.guildId);
            if (!panelMessageId) return;
            
            // Essayer de fetch le message du panel
            let panelMessage;
            try {
              panelMessage = await interaction.channel.messages.fetch(panelMessageId);
            } catch (fetchErr) {
              // Le message n'existe plus, skip la mise à jour
              console.warn(`Panel message ${panelMessageId} not found, skipping update`);
              return;
            }
            
            const startTime = Math.floor((Date.now() - interaction.client.uptime) / 1000);
            const botCommandsCount = 26;
            
            // Recréer le panel admin principal
            const panelEmbed = new EmbedBuilder()
              .setColor(0x2ECC71)
              .setAuthor({ name: '🤖 PANEL ADMINISTRATEUR', iconURL: interaction.client.user.displayAvatarURL() })
              .setTitle('⚙️ Centre de Contrôle Gorille™')
              .setDescription(`👋 Bienvenue **${interaction.user.username}**!\n\n> Gère ton bot depuis ce panel central`)
              .setThumbnail(interaction.client.user.displayAvatarURL())
              .addFields(
                {
                  name: '━━━━━ 🟢 STATUT SYSTÈME 🟢 ━━━━━',
                  value: ' ',
                  inline: false
                },
                {
                  name: '🟢 Status',
                  value: '`Online & Active`',
                  inline: true
                },
                {
                  name: '⏱️ Uptime',
                  value: `<t:${startTime}:R>`,
                  inline: true
                },
                {
                  name: '🔧 Mode Maintenance',
                  value: config.maintenanceMode ? '🔴 `ACTIVÉ`' : '🟢 `Désactivé`',
                  inline: true
                },
                {
                  name: '━━━━━ 📊 STATISTIQUES 📊 ━━━━━',
                  value: ' ',
                  inline: false
                },
                {
                  name: '📋 Serveurs Actifs',
                  value: `\`${interaction.client.guilds.cache.size}\` guildes`,
                  inline: true
                },
                {
                  name: '👥 Utilisateurs Cachés',
                  value: `\`${interaction.client.users.cache.size}\` users`,
                  inline: true
                },
                {
                  name: '🤖 Commandes',
                  value: `\`${botCommandsCount}\` commandes`,
                  inline: true
                },
                {
                  name: '━━━━━ 🔐 CONFIGURATION 🔐 ━━━━━',
                  value: ' ',
                  inline: false
                },
                {
                  name: '📢 Broadcast Channel',
                  value: config.broadcastChannelId ? `<#${config.broadcastChannelId}>` : '`Non configuré`',
                  inline: true
                },
                {
                  name: '📝 Log Channels',
                  value: `\`${Object.keys(config.logChannels || {}).length}\` channels`,
                  inline: true
                },
                {
                  name: '🎯 Créateur',
                  value: `<@${config.ownerIds[0]}>`,
                  inline: true
                }
              )
.setFooter({ text: `✨ Créé par LeBelge_e | ${getVersion()}`, iconURL: interaction.client.user.displayAvatarURL() })
              .setTimestamp();
            
            // Recréer les boutons du panel avec les 6 boutons refactorisés
            const buttonsRow1 = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_maintenance')
                .setLabel(config.maintenanceMode ? 'Maint: ON' : 'Maint: OFF')
                .setEmoji(config.maintenanceMode ? '🟢' : '🔴')
                .setStyle(config.maintenanceMode ? ButtonStyle.Success : ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('admin_servers')
                .setLabel('Serveurs')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('admin_security')
                .setLabel('Sécurité')
                .setEmoji('🛡️')
                .setStyle(ButtonStyle.Danger)
            );
            
            const buttonsRow2 = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_broadcast')
                .setLabel('Broadcast')
                .setEmoji('📢')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('admin_changelog')
                .setLabel('Changelog')
                .setEmoji('📰')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('admin_backups')
                .setLabel('Backups')
                .setEmoji('💾')
                .setStyle(ButtonStyle.Secondary)
            );

            const buttonsRow3 = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_commands')
                .setLabel('Commandes Admin')
                .setEmoji('🤖')
                .setStyle(ButtonStyle.Secondary)
            );
            
            // Éditer le message du panel original pour revenir à l'état initial
            await panelMessage.edit({ embeds: [panelEmbed], components: [buttonsRow1, buttonsRow2, buttonsRow3] });
          } catch (e) {
            console.error('Error reverting to admin panel:', e);
          }
        }, 2000);
      } catch (error) {
        console.error('Logs select menu error:', error);
        await interaction.reply({
          content: '❌ Erreur lors de la sauvegarde',
          flags: 64
        }).catch(() => {});
      }
      return;
    }

    // Handler pour archiver le changelog
    if (interaction.isButton() && interaction.customId === 'changelog_clear') {
      try {
        const { clearTodayChanges } = await import('./utils/dailyChangelog.js');
        clearTodayChanges();

        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('✅ Changelog Archivé')
          .setDescription('Le changelog d\'aujourd\'hui a été archivé et réinitialisé.')
          .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
          .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

        logToChannelAsync('admin', createLogEmbed(
          'Changelog Archivé',
          `${interaction.user.username} a archivé le changelog du jour`
        ));
      } catch (error) {
        console.error('Erreur clear changelog:', error);
        try {
          await interaction.followUp({
            content: `❌ Erreur: ${error.message}`,
            flags: 64
          });
        } catch (e) {
          console.error('Error sending error message:', e);
        }
      }
      return;
    }

    // Handler pour publier le changelog
    if (interaction.isButton() && interaction.customId === 'changelog_publish') {
      try {
        await interaction.deferUpdate();
        const { getTodayChanges } = await import('./utils/dailyChangelog.js');
        const { getBroadcastChannel } = await import('./utils/database.js');
        const todayChanges = getTodayChanges();

        const changesList = todayChanges.slice(0, 20)
          .map((change, i) => `${i + 1}. ${change}`)
          .join('\n');

        const publishEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('📰 CHANGELOG DU JOUR')
          .setDescription(`**${todayChanges.length}** changement(s) publiés`)
          .addFields(
            { name: '⚙️ Mises à Jour', value: changesList || '📭 Aucun changement', inline: false }
          )
          .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
          .setTimestamp();

        let sentCount = 0;
        let failedCount = 0;

        // Parcourir les serveurs du bot
        for (const guild of client.guilds.cache.values()) {
          try {
            // Récupérer le channel configuré pour ce serveur depuis la base de données
            const broadcastChannelId = await getBroadcastChannel(guild.id);
            
            if (!broadcastChannelId) {
              failedCount++;
              continue;
            }

            const broadcastChannel = guild.channels.cache.get(broadcastChannelId);
            if (broadcastChannel && broadcastChannel.isTextBased()) {
              await broadcastChannel.send({ embeds: [publishEmbed] });
              sentCount++;
            } else {
              failedCount++;
            }
          } catch (err) {
            console.warn(`Erreur envoi changelog guild ${guild.id}:`, err);
            failedCount++;
          }
        }

        const successEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('✅ Changelog Publié')
          .setDescription(`Changelog publiée sur **${sentCount}** serveur(s)\n❌ **${failedCount}** serveur(s) non configuré(s)`)
          .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
          .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed], components: [] });

        logToChannelAsync('admin', createLogEmbed(
          'Changelog Publiée',
          `${interaction.user.username} a publié le changelog sur ${sentCount} serveurs (${failedCount} non configurés)`
        ));

        // Retour au panel principal après 3 secondes
        setTimeout(async () => {
          try {
            const panelData = await reloadAdminPanel(interaction);
            if (panelData) {
              await interaction.editReply(panelData);
            }
          } catch (err) {
            console.error('Error returning to admin panel after changelog publish:', err);
          }
        }, 3000);
      } catch (error) {
        console.error('Erreur publish changelog:', error);
        try {
          await interaction.followUp({
            content: `❌ Erreur: ${error.message}`,
            flags: 64
          });
        } catch (e) {
          console.error('Error sending error message:', e);
        }
      }
      return;
    }

    // Gérer les boutons du panel admin et logs
    if (interaction.customId.startsWith('admin_') || interaction.customId.startsWith('logs_') || interaction.customId.startsWith('cmd_')) {
      const adminCommand = client.commands.get('admin');
      if (adminCommand) {
        try {
          // Pour les boutons du panel, éditer le message au lieu de créer une nouvelle réponse

          if (interaction.customId === 'admin_servers') {
            // Tracker le message du panel
            console.log(`[admin_servers] Click detected`);
            
            if (!adminPanelMessages.has(interaction.guildId)) {
              adminPanelMessages.set(interaction.guildId, interaction.message.id);
            }

            const guilds = client.guilds.cache.sort((a, b) => b.memberCount - a.memberCount);
            
            // Créer les options pour le select menu (max 25)
            const options = guilds.map((g, i) => ({
              label: g.name.substring(0, 100),
              value: g.id,
              description: `${g.memberCount} membres`,
              emoji: '✅'
            })).slice(0, 25);

            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId('admin_server_select')
              .setPlaceholder('Sélectionne un serveur pour voir les options')
              .addOptions(options);

            const embed = new EmbedBuilder()
              .setColor(0x3498DB)
              .setAuthor({ name: '📋 SERVEURS', iconURL: client.user.displayAvatarURL() })
              .setDescription(`**${guilds.size}** serveurs actifs\n\nSélectionne un serveur pour voir les options (suppression, ban, débannissement)`)
              .setThumbnail(client.user.displayAvatarURL())
              .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: client.user.displayAvatarURL() })
              .setTimestamp();
            
            const selectRow = new ActionRowBuilder().addComponents(selectMenu);
            
            const menuButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_panel_back')
                .setLabel('← Retour au Panel')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
            );
            
            await interaction.update({ embeds: [embed], components: [selectRow, menuButtons] });
            logToChannelAsync('admin', createLogEmbed(
              'Gestion Serveurs Ouverte',
              `${interaction.user.username} a ouvert la gestion des serveurs`
            ));
          } else if (interaction.customId === 'admin_logs') {
            // Tracker le message du panel
            if (!adminPanelMessages.has(interaction.guildId)) {
              adminPanelMessages.set(interaction.guildId, interaction.message.id);
            }
            
            const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
            const config = JSON.parse(readFileSync(configPath, 'utf8'));
            
            const logChannels = config.logChannels || {};
            const logTypes = ['permissions', 'security', 'errors', 'admin', 'maintenance', 'broadcast', 'general'];
            
            const embed = new EmbedBuilder()
              .setColor(0xFFA500)
              .setTitle('⚙️・CONFIGURATION DES LOGS')
              .setDescription('Cliquez sur un type de log pour configurer son channel')
              .addFields(
                logTypes.map(type => ({
                  name: type.toUpperCase(),
                  value: logChannels[type] ? `Canal: <#${logChannels[type]}>` : '```Non configuré```',
                  inline: true
                }))
              )
              .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
              .setTimestamp();
            
            // Créer les boutons pour configurer chaque type
            const logsButtons1 = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('logs_config_permissions')
                .setLabel('Permissions')
                .setEmoji('🔐')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('logs_config_security')
                .setLabel('Sécurité')
                .setEmoji('🛡️')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('logs_config_errors')
                .setLabel('Erreurs')
                .setEmoji('⚠️')
                .setStyle(ButtonStyle.Secondary)
            );
            
            const logsButtons2 = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('logs_config_admin')
                .setLabel('Admin')
                .setEmoji('👑')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('logs_config_maintenance')
                .setLabel('Maintenance')
                .setEmoji('🔧')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('logs_config_broadcast')
                .setLabel('Broadcast')
                .setEmoji('📢')
                .setStyle(ButtonStyle.Secondary)
            );
            
            const logsButtons3 = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('logs_config_general')
                .setLabel('Général')
                .setEmoji('📝')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('logs_back')
                .setLabel('← Retour')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Danger)
            );
            
            await interaction.update({ embeds: [embed], components: [logsButtons1, logsButtons2, logsButtons3] });
            logToChannelAsync('admin', createLogEmbed(
              'Menu de Configuration des Logs Ouvert',
              `\`${interaction.user.username}\` a ouvert le menu de ***configuration des logs***`
            ));
          } else if (interaction.customId === 'logs_back') {
            // Retour au panel principal depuis le menu des logs
            console.log('[logs_back] User clicked back button');
            const panelData = await reloadAdminPanel(interaction);
            if (panelData) {
              console.log('[logs_back] Returning to main panel via interaction.update()');
              await interaction.update(panelData);
            }
          } else if (interaction.customId === 'admin_maintenance') {
            // Charger la config
            const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
            const config = JSON.parse(readFileSync(configPath, 'utf8'));
            
            // Toggle la maintenance
            config.maintenanceMode = !config.maintenanceMode;
            writeFileSync(configPath, JSON.stringify(config, null, 2));
            
            // Recharger le panel complètement avec le nouveau statut maintenance
            const panelData = await reloadAdminPanel(interaction);
            if (panelData) {
              await interaction.update(panelData);
              console.log(`[admin_maintenance] ✅ Panel updated - maintenance is now ${config.maintenanceMode ? 'ON' : 'OFF'}`);
            }
            
            logToChannelAsync('admin', createLogEmbed(
              'Maintenance Modifiée',
              `\`${interaction.user.username}\` a ***${config.maintenanceMode ? 'activé' : 'désactivé'}*** la maintenance`
            ));
          } else if (interaction.customId === 'admin_config') {
            // Tracker le message du panel
            if (!adminPanelMessages.has(interaction.guildId)) {
              adminPanelMessages.set(interaction.guildId, interaction.message.id);
            }

            const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
            const config = JSON.parse(readFileSync(configPath, 'utf8'));
            const embed = new EmbedBuilder()
              .setColor(0xD4AF37)
              .setAuthor({ name: '⚙️ CONFIGURATION', iconURL: client.user.displayAvatarURL() })
              .setDescription('Configuration globale du bot')
              .setThumbnail(client.user.displayAvatarURL())
              .addFields(
                { name: '📢 Broadcast Channel', value: config.broadcastChannelId ? `<#${config.broadcastChannelId}>` : '`Non configuré`', inline: true },
                { name: '📝 Log Channels', value: `\`${Object.keys(config.logChannels || {}).length}\` channels`, inline: true },
                { name: '🎯 Créateurs', value: config.ownerIds.map(id => `<@${id}>`).join(', '), inline: false },
                { name: '🔧 Maintenance', value: config.maintenanceMode ? '🔴 ACTIF' : '🟢 INACTIF', inline: true },
                { name: '━━━━━━━━━━━━', value: ' ', inline: false }
              )
              .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: client.user.displayAvatarURL() })
              .setTimestamp();
            
            const backButton = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_panel_back')
                .setLabel('← Retour au Panel')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Danger)
            );

            await interaction.update({ embeds: [embed], components: [backButton] });
            logToChannelAsync('admin', createLogEmbed(
              'Configuration Consultée',
              `${interaction.user.username} a consulté la configuration`
            ));
          } else if (interaction.customId === 'admin_database') {
            // Tracker le message du panel
            if (!adminPanelMessages.has(interaction.guildId)) {
              adminPanelMessages.set(interaction.guildId, interaction.message.id);
            }

            const embed = new EmbedBuilder()
              .setColor(0x9B59B6)
              .setTitle('💾・BASE DE DONNÉES')
              .setDescription('Informations sur la base de données')
              .addFields(
                { name: '📊 Status', value: '`Connecté & Actif`', inline: true },
                { name: '📁 Type', value: '`SQLite3`', inline: true },
                { name: '📋 Tables', value: '`players, saved, saved_info, permissions, audit_logs, broadcast_config`', inline: false },
                { name: '🔐 Sauvegardes', value: 'Les données sont automatiquement sauvegardées', inline: false }
              )
              .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
              .setTimestamp();
            
            const backButton = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_panel_back')
                .setLabel('← Retour au Panel')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Danger)
            );

            await interaction.update({ embeds: [embed], components: [backButton] });
            logToChannelAsync('admin', createLogEmbed(
              'Base de Données Consultée',
              `${interaction.user.username} a consulté le statut de la base de données`
            ));
          } else if (interaction.customId === 'admin_commands') {
            // Tracker le message du panel
            if (!adminPanelMessages.has(interaction.guildId)) {
              adminPanelMessages.set(interaction.guildId, interaction.message.id);
            }

            // Afficher le menu des commandes admin (fonctions utiles uniquement)
            const commandsEmbed = new EmbedBuilder()
              .setColor(0x3498DB)
              .setAuthor({ name: '🤖 COMMANDES ADMIN', iconURL: client.user.displayAvatarURL() })
              .setDescription('Actions utiles pour la gestion du bot')
              .setThumbnail(client.user.displayAvatarURL())
              .addFields(
                { name: '🗑️ Clear Cache', value: 'Réinitialiser le cache', inline: true },
                { name: '🔢 Version', value: 'Changer la version du bot', inline: true }
              )
              .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: client.user.displayAvatarURL() })
              .setTimestamp();

            const commandButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('cmd_clearCache')
                .setLabel('Clear Cache')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('cmd_version')
                .setLabel('Version')
                .setEmoji('🔢')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('admin_commands_back')
                .setLabel('← Retour')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
            );

            await interaction.update({ embeds: [commandsEmbed], components: [commandButtons] });
            
            logToChannelAsync('admin', createLogEmbed(
              'Menu des Commandes Admin Ouvert',
              `\`${interaction.user.username}\` a ouvert le menu des commandes admin`
            ));
          } else if (interaction.customId === 'admin_broadcast') {
            // Tracker le message du panel
            if (!adminPanelMessages.has(interaction.guildId)) {
              adminPanelMessages.set(interaction.guildId, interaction.message.id);
            }

            // Vérifier que le serveur a un channel de broadcast configuré
            const { getBroadcastChannel } = await import('./utils/database.js');
            const broadcastChannelId = await getBroadcastChannel(interaction.guildId);

            if (!broadcastChannelId) {
              return await interaction.reply({
                content: '❌ Aucun canal de broadcast configuré!\n\nUtilise la commande `/broadcast config` pour configurer un canal.',
                flags: 64
              });
            }

            // Créer un modal professionnel pour le broadcast
            const broadcastTitleInput = new TextInputBuilder()
              .setCustomId('broadcast_title_input')
              .setLabel('📢 Titre du Message')
              .setPlaceholder('Ex: Mise à jour importante...')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMinLength(5)
              .setMaxLength(100);
            
            const broadcastContentInput = new TextInputBuilder()
              .setCustomId('broadcast_content_input')
              .setLabel('📝 Contenu/Description')
              .setPlaceholder('Écrivez le message complet...')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMinLength(10)
              .setMaxLength(2000);
            
            const broadcastRow1 = new ActionRowBuilder().addComponents(broadcastTitleInput);
            const broadcastRow2 = new ActionRowBuilder().addComponents(broadcastContentInput);
            
            const broadcastModal = new ModalBuilder()
              .setCustomId('broadcast_modal_pro')
              .setTitle('📢🎨 BROADCAST - INFO')
              .addComponents(broadcastRow1, broadcastRow2);
            
            await interaction.showModal(broadcastModal);
          } else if (interaction.customId === 'admin_changelog') {
            // Afficher le changelog quotidien
            try {
              const { getTodayChanges } = await import('./utils/dailyChangelog.js');
              const todayChanges = getTodayChanges();

              if (!todayChanges || todayChanges.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                  .setColor(0x95A5A6)
                  .setTitle('📰・CHANGELOG')
                  .setDescription('📭 Aucun changement enregistré pour aujourd\'hui')
                  .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
                  .setTimestamp();
                
                const backButton = new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId('admin_panel_back')
                    .setLabel('← Retour')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                );
                
                return await interaction.update({ embeds: [emptyEmbed], components: [backButton] });
              }

              // Créer l'embed du changelog
              const changelogEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('📰・CHANGELOG DU JOUR')
                .setAuthor({ name: '📋 Suivi des Changements', iconURL: client.user.displayAvatarURL() })
                .setDescription(`**${todayChanges.length}** changement(s) enregistré(s) aujourd\'hui`);

              const changesList = todayChanges.slice(0, 20)
                .map((change, i) => `${i + 1}. ${change}`)
                .join('\n');

              changelogEmbed.addFields(
                { name: '⚙️ Actions du Bot', value: changesList || '📭 Aucun changement', inline: false }
              )
              .setFooter({ text: `${todayChanges.length} changement(s) au total`, iconURL: client.user.displayAvatarURL() })
              .setTimestamp();

              const actionButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('changelog_clear')
                  .setLabel('🗑️ Archiver et Réinitialiser')
                  .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                  .setCustomId('changelog_publish')
                  .setLabel('📢 Publier sur Tous les Serveurs')
                  .setStyle(ButtonStyle.Success)
              );

              const backButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('admin_panel_back')
                  .setLabel('← Retour')
                  .setEmoji('⬅️')
                  .setStyle(ButtonStyle.Secondary)
              );

              await interaction.update({ embeds: [changelogEmbed], components: [actionButtons, backButton] });
            } catch (error) {
              console.error('Erreur changelog:', error);
              await interaction.reply({
                content: '❌ Erreur lors de la lecture du changelog',
                flags: 64
              });
            }

          } else if (interaction.customId === 'admin_commands_back') {
            // Revenir au panel principal
            console.log('[admin_commands_back] User clicked back button');
            const panelData = await reloadAdminPanel(interaction);
            if (panelData) {
              console.log('[admin_commands_back] Returning to main panel via interaction.update()');
              await interaction.update(panelData);
            }
            logToChannelAsync('admin', createLogEmbed(
              'Retour au Panel Principal',
              `${interaction.user.username} a quitté le menu des commandes admin`
            ));
          } else if (interaction.customId === 'cmd_version') {
            // Ouvrir le modal pour changer la version
            if (!adminPanelMessages.has(interaction.guildId)) {
              adminPanelMessages.set(interaction.guildId, interaction.message.id);
            }

            const versionInput = new TextInputBuilder()
              .setCustomId('version_input')
              .setLabel('🔢 Numéro de Version')
              .setPlaceholder('Ex: 1.0.3')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMinLength(3)
              .setMaxLength(20);
            
            const versionRow = new ActionRowBuilder().addComponents(versionInput);
            
            const versionModal = new ModalBuilder()
              .setCustomId('version_modal_pro')
              .setTitle('🔢 CHANGER LA VERSION')
              .addComponents(versionRow);
            
            await interaction.showModal(versionModal);
          } else if (interaction.customId === 'cmd_status') {
            // Afficher le statut détaillé du bot
            const startTime = Math.floor((Date.now() - client.uptime) / 1000);
            const uptime = client.uptime / 1000;
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            const statusEmbed = new EmbedBuilder()
              .setColor(0x2ECC71)
              .setTitle('📊・STATUS DÉTAILLÉ')
              .setDescription('État complet du bot Pactify')
              .addFields(
                { name: '🟢 Statut', value: '`Online & Active`', inline: true },
                { name: '⏱️ Uptime', value: `\`${days}j ${hours}h ${minutes}m ${seconds}s\``, inline: true },
                { name: '🔌 Ping', value: `\`${client.ws.ping}ms\``, inline: true },
                { name: '📁 Mémoire', value: `\`${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB\``, inline: true },
                { name: '📋 Guildes', value: `\`${client.guilds.cache.size}\` serveurs`, inline: true },
                { name: '👥 Utilisateurs', value: `\`${client.users.cache.size}\` users`, inline: true },
                { name: '🤖 Commandes', value: '`26` commandes', inline: true },
                { name: '📢 Channels', value: `\`${client.channels.cache.size}\` channels`, inline: true },
                { name: '💬 Messages cachés', value: `\`${client.guilds.cache.reduce((a, b) => a + (b.messages?.cache?.size || 0), 0)}\` messages`, inline: true }
              )
              .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: client.user.displayAvatarURL() })
              .setTimestamp();
            
            const backButton = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_commands_back')
                .setLabel('← Retour')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
            );
            
            await interaction.update({ embeds: [statusEmbed], components: [backButton] });
          } else if (interaction.customId === 'cmd_servers') {
            // Afficher la liste des serveurs
            const guilds = client.guilds.cache;
            const guildList = guilds.map((g, i) => {
              const owner = g.ownerId;
              const memberCount = g.memberCount;
              return `**${i + 1}.** ${g.name} (\`${memberCount}\` members, <@${owner}>)`;
            }).slice(0, 10).join('\n');
            
            const serversEmbed = new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle('📋・SERVEURS')
              .setDescription(`Nombre total: **${guilds.size}** serveurs\n\n${guildList || 'Aucun serveur'}`)
              .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
              .setTimestamp();
            
            const backButton = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_commands_back')
                .setLabel('← Retour')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
            );
            
            await interaction.update({ embeds: [serversEmbed], components: [backButton] });
          } else if (interaction.customId === 'cmd_logs') {
            // Afficher le menu de configuration des logs
            const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
            const config = JSON.parse(readFileSync(configPath, 'utf8'));
            
            const logsEmbed = new EmbedBuilder()
              .setColor(0xF39C12)
              .setTitle('📊・CONFIGURATION DES LOGS')
              .setDescription('Gérer les channels de logs')
              .addFields(
                { name: '👮 Permissions', value: config.logChannels?.permissions ? `<#${config.logChannels.permissions}>` : '`Non configuré`', inline: true },
                { name: '🔐 Sécurité', value: config.logChannels?.security ? `<#${config.logChannels.security}>` : '`Non configuré`', inline: true },
                { name: '⚠️ Erreurs', value: config.logChannels?.errors ? `<#${config.logChannels.errors}>` : '`Non configuré`', inline: true },
                { name: '👑 Admin', value: config.logChannels?.admin ? `<#${config.logChannels.admin}>` : '`Non configuré`', inline: true },
                { name: '🔧 Maintenance', value: config.logChannels?.maintenance ? `<#${config.logChannels.maintenance}>` : '`Non configuré`', inline: true },
                { name: '📢 Broadcast', value: config.logChannels?.broadcast ? `<#${config.logChannels.broadcast}>` : '`Non configuré`', inline: true },
                { name: '📝 Général', value: config.logChannels?.general ? `<#${config.logChannels.general}>` : '`Non configuré`', inline: true }
              )
              .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
              .setTimestamp();
            
            const backButton = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_commands_back')
                .setLabel('← Retour')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
            );
            
            await interaction.update({ embeds: [logsEmbed], components: [backButton] });
          } else if (interaction.customId === 'admin_stats') {
            // Afficher les statistiques
            const statsEmbed = await getStatisticsEmbed();
            const backButton = getBackButton();
            await interaction.update({ embeds: [statsEmbed], components: [backButton] });
          } else if (interaction.customId === 'admin_backups') {
            // Afficher les sauvegardes disponibles
            try {
              const { getAvailableBackups } = await import('./utils/backupManager.js');
              const backups = getAvailableBackups();

              if (!backups || backups.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                  .setColor(0x95A5A6)
                  .setTitle('💾・SAUVEGARDES')
                  .setDescription('📭 Aucune sauvegarde disponible')
                  .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
                  .setTimestamp();
                
                const backButton = new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId('admin_panel_back')
                    .setLabel('← Retour')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                );
                
                return await interaction.update({ embeds: [emptyEmbed], components: [backButton] });
              }

              // Créer l'embed avec les sauvegardes
              const backupsEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('💾・GESTION DES SAUVEGARDES')
                .setAuthor({ name: '📋 Backups Disponibles', iconURL: client.user.displayAvatarURL() })
                .setDescription(`**${backups.length}** sauvegarde(s) trouvée(s)\n> Sauvegardes créées à 21h chaque jour\n> Suppression automatique après 72h`);

              const backupsList = backups.slice(0, 10)
                .map((backup, i) => {
                  const size = backup.size ? `${(backup.size / 1024 / 1024).toFixed(2)}MB` : 'N/A';
                  const date = new Date(backup.date).toLocaleDateString('fr-FR');
                  return `${i + 1}. **${backup.date}** (${size})`;
                })
                .join('\n');

              backupsEmbed.addFields(
                { name: '📅 Sauvegardes', value: backupsList, inline: false }
              )
              .setFooter({ text: `${backups.length} sauvegarde(s) au total`, iconURL: client.user.displayAvatarURL() })
              .setTimestamp();

              // Créer le select menu pour choisir une sauvegarde
              const backupOptions = backups.slice(0, 25).map((backup, i) => ({
                label: `${backup.date} (${backup.size ? (backup.size / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'})`,
                value: backup.date,
                description: `Créée le ${new Date(backup.date).toLocaleDateString('fr-FR')}`,
                emoji: '💾'
              }));

              const backupSelect = new StringSelectMenuBuilder()
                .setCustomId('backup_select')
                .setPlaceholder('Sélectionne une sauvegarde à restaurer')
                .addOptions(backupOptions);

              const selectRow = new ActionRowBuilder().addComponents(backupSelect);

              const backButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('admin_panel_back')
                  .setLabel('← Retour')
                  .setEmoji('⬅️')
                  .setStyle(ButtonStyle.Secondary)
              );

              await interaction.update({ embeds: [backupsEmbed], components: [selectRow, backButton] });
            } catch (error) {
              console.error('Erreur backups:', error);
              await interaction.reply({
                content: `❌ Erreur: ${error.message}`,
                flags: 64
              });
            }
          } else if (interaction.isStringSelectMenu() && interaction.customId === 'backup_select') {
            // Gérer la sélection d'une sauvegarde pour restauration
            try {
              const selectedDate = interaction.values[0];

              const confirmEmbed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('⚠️ Confirmation de Restauration')
                .setDescription(`Êtes-vous sûr de vouloir restaurer la sauvegarde du **${selectedDate}**?\n\n⚠️ **ATTENTION:** Cette action remplacera la base de données actuelle!`)
                .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
                .setTimestamp();

              const confirmButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`backup_restore_${selectedDate}`)
                  .setLabel('✅ Restaurer')
                  .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                  .setCustomId('admin_backups')
                  .setLabel('❌ Annuler')
                  .setStyle(ButtonStyle.Secondary)
              );

              await interaction.update({ embeds: [confirmEmbed], components: [confirmButtons] });
            } catch (error) {
              console.error('Erreur backup select:', error);
              await interaction.reply({
                content: `❌ Erreur: ${error.message}`,
                flags: 64
              });
            }
          } else if (interaction.isButton() && interaction.customId.startsWith('backup_restore_')) {
            // Restaurer la sauvegarde
            try {
              const backupDate = interaction.customId.replace('backup_restore_', '');
              const { restoreBackup } = await import('./utils/backupManager.js');

              const result = restoreBackup(backupDate);

              if (!result) {
                return await interaction.reply({
                  content: `❌ Sauvegarde du ${backupDate} introuvable ou invalide`,
                  flags: 64
                });
              }

              const successEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('✅ Restauration Réussie')
                .setDescription(`La sauvegarde du **${backupDate}** a été restaurée avec succès!\n\n⚠️ **Important:** Veuillez redémarrer le bot pour que les changements prennent effet.`)
                .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
                .setTimestamp();

              await interaction.update({ embeds: [successEmbed], components: [] });

              logToChannelAsync('admin', createLogEmbed(
                'Sauvegarde Restaurée',
                `${interaction.user.username} a restauré la sauvegarde du **${backupDate}**`
              ));
            } catch (error) {
              console.error('Erreur restore backup:', error);
              await interaction.reply({
                content: `❌ Erreur lors de la restauration: ${error.message}`,
                flags: 64
              });
            }
          } else if (interaction.customId === 'admin_banned_servers') {
            return interaction.reply({
              content: '🚫 La gestion des serveurs bannis est désactivée.',
              flags: 64
            });
          } else if (interaction.customId === 'admin_ban_user') {
            return interaction.reply({
              content: '🚫 La fonctionnalité de ban utilisateur est désactivée.',
              flags: 64
            });
          } else if (interaction.customId === 'admin_unban_user') {
            return interaction.reply({
              content: '🚫 La fonctionnalité de débannissement utilisateur est désactivée.',
              flags: 64
            });
          } else if (interaction.customId === 'admin_panel_back') {
            // Retour au panel principal
            console.log('[admin_panel_back] User clicked back button');
            console.log(`[admin_panel_back] Returning to main panel via interaction.update()`);
            
            try {
              // Charger les données du panel
              const panelData = await reloadAdminPanel(interaction);
              if (panelData) {
                console.log('[admin_panel_back] Panel data loaded, updating interaction');
                // Utiliser interaction.update() parce qu'on est sur un sous-message (Serveurs, Status, etc)
                // et on doit retourner au panel original via cette interaction
                await interaction.update(panelData);
                console.log('[admin_panel_back] ✅ Successfully updated interaction back to main panel');
              } else {
                console.error('[admin_panel_back] ❌ Panel data is null - reloadAdminPanel failed');
                await interaction.update({
                  content: '❌ Erreur lors du chargement du panel',
                  embeds: [],
                  components: []
                }).catch(err => console.error('[admin_panel_back] Failed to send error message:', err));
              }
            } catch (err) {
              console.error('[admin_panel_back] Exception occurred:', err);
              await interaction.update({
                content: '❌ Une erreur est survenue lors du retour au panel',
                embeds: [],
                components: []
              }).catch(e => console.error('[admin_panel_back] Failed to send exception message:', e));
            }
          } else if (interaction.customId === 'cmd_clearCache') {
            // Effacer le cache du panel admin
            const panelCachePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-panel-cache.json');
            
            try {
              // Vider le cache de panels
              writeFileSync(panelCachePath, JSON.stringify({}, null, 2));
              
              // Effacer la Map en mémoire
              adminPanelMessages.clear();
              
              const clearEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('✅・CACHE CLEARED')
                .setDescription('Le cache du panel admin a été vidé avec succès')
                .addFields({
                  name: '🧹 Action effectuée',
                  value: 'Le fichier `admin-panel-cache.json` a été réinitialisé',
                  inline: false
                })
                .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
                .setTimestamp();
              
              await interaction.update({ embeds: [clearEmbed] });
              
              logToChannelAsync('admin', createLogEmbed(
                'Cache Vidé',
                `${interaction.user.username} a vidé le cache du panel admin`
              ));

              // Après 2 secondes: retour au panel de commandes admin
              setTimeout(async () => {
                try {
                  const commandsEmbed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setAuthor({ name: '🤖 COMMANDES ADMIN', iconURL: interaction.client.user.displayAvatarURL() })
                    .setDescription('Sélectionnez une action à effectuer')
                    .setThumbnail(interaction.client.user.displayAvatarURL())
                    .addFields(
                      { name: '📊 Status Détaillé', value: 'État complet du bot', inline: true },
                      { name: '📋 Serveurs Actifs', value: 'Liste de tous les serveurs', inline: true },
                      { name: '📝 Logs Admin', value: 'Configuration des logs', inline: true },
                      { name: '🔧 Base de Données', value: 'Gestion de la BD', inline: true },
                      { name: '🗑️ Clear Cache', value: 'Réinitialiser le cache', inline: true },
                      { name: '━━━━━━━━━━━━', value: ' ', inline: false }
                    )
                    .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.client.user.displayAvatarURL() })
                    .setTimestamp();

                  const commandButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                      .setCustomId('cmd_status')
                      .setLabel('Status')
                      .setEmoji('📊')
                      .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                      .setCustomId('cmd_servers')
                      .setLabel('Serveurs')
                      .setEmoji('📋')
                      .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                      .setCustomId('cmd_logs')
                      .setLabel('Logs')
                      .setEmoji('📝')
                      .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                      .setCustomId('cmd_clearCache')
                      .setLabel('Cache')
                      .setEmoji('🗑️')
                      .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                      .setCustomId('admin_commands_back')
                      .setLabel('Retour')
                      .setEmoji('⬅️')
                      .setStyle(ButtonStyle.Secondary)
                  );

                  await interaction.editReply({ embeds: [commandsEmbed], components: [commandButtons] });
                } catch (e) {
                  console.error('Error reverting to admin commands menu after clear cache:', e);
                }
              }, 2000);
            } catch (e) {
              const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌・ERREUR')
                .setDescription('Une erreur s\'est produite lors du vidage du cache')
                .addFields({
                  name: '⚠️ Erreur',
                  value: e.message,
                  inline: false
                })
                .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
                .setTimestamp();
              
              await interaction.update({ embeds: [errorEmbed] });
            }
          } else if (interaction.customId.startsWith('logs_config_')) {
            const logType = interaction.customId.replace('logs_config_', '');
            const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
            const config = JSON.parse(readFileSync(configPath, 'utf8'));
            
            const logChannels = config.logChannels || {};
            const currentChannel = logChannels[logType];
            
            const embed = new EmbedBuilder()
              .setColor(0xFFA500)
              .setTitle(`⚙️・Configuration: ${logType.toUpperCase()}`)
              .setDescription('Sélectionnez un channel pour ce type de log')
              .addFields({
                name: 'Channel actuellement configuré',
                value: currentChannel ? `<#${currentChannel}>` : '```Aucun```',
                inline: false
              })
              .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
              .setTimestamp();
            
            // Créer un modal avec un champ de recherche
            const searchInput = new TextInputBuilder()
              .setCustomId(`logs_search_input_${logType}`)
              .setLabel(`Chercher un channel (${logType})`)
              .setPlaceholder('Taper le début du nom du channel...')
              .setStyle(TextInputStyle.Short)
              .setRequired(false);
            
            const searchRow = new ActionRowBuilder().addComponents(searchInput);
            
            const modal = new ModalBuilder()
              .setCustomId(`logs_search_modal_${logType}`)
              .setTitle(`Configurer ${logType.toUpperCase()}`)
              .addComponents(searchRow);
            
            await interaction.showModal(modal);
          }
        } catch (error) {
          console.error('Admin button error:', error);
          try {
            await interaction.update({ content: '❌ Erreur lors de la mise à jour' }).catch(() => {});
          } catch (e) {
            console.error('Update error:', e);
          }
        }
      }
      return;
    }
    } catch (buttonHandlerError) {
      console.error('[ADMIN PANEL BUTTON] Erreur lors du traitement du bouton:', buttonHandlerError);
      try {
        await interaction.deferUpdate();
      } catch (ackError) {
        console.error('[ADMIN PANEL BUTTON] Impossible d\'acknowledger l\'interaction:', ackError);
      }
    }
  }

  // Gérer le select menu des couleurs pour le broadcast
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      // Support both autocomplete and handleAutocomplete
      if (command.autocomplete) {
        await command.autocomplete(interaction);
      } else if (command.handleAutocomplete) {
        await command.handleAutocomplete(interaction);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
    }
  }

  // Admin Panel - Modal Submissions (PHASE 3B.4)
  // Ban checks have been disabled.

  if (interaction.isModalSubmit() && interaction.customId.startsWith('admin_modal_')) {
    try {
      console.log('[ADMIN MODAL] Processing modal:', interaction.customId);
      await handleAdminModalSubmit(interaction);
    } catch (error) {
      console.error('[ADMIN MODAL ERROR]', error);
      try {
        await interaction.reply({
          content: `❌ Erreur: ${error.message}`,
          flags: 64
        });
      } catch {
        console.error('[ADMIN MODAL] Could not send error response');
      }
    }
  }

  // Bypass modals (add / remove)
  if (interaction.isModalSubmit() && interaction.customId.startsWith('bypass_modal_add:')) {
    try {
      const OWNER_ID = process.env.OWNER_ID || process.env.OWNER_IDS?.split(',')[0] || '492627367114702849';
      if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({ content: '❌ Seul le créateur du bot peut effectuer cette action.', flags: 64 });
      }

      const parts = interaction.customId.split(':');
      const messageId = parts[1];
      const rawTarget = interaction.fields.getTextInputValue('bypass_target').trim();
      const note = interaction.fields.getTextInputValue('bypass_note').trim();

      // Parse mention or id
      const m = rawTarget.match(/<@!?(\d+)>/);
      let discordId = m ? m[1] : (rawTarget.match(/^\d+$/) ? rawTarget : null);
      if (!discordId) {
        // Try to resolve by guild members (accept username, nickname or tag like LeBelge_e or LeBelge_e#1234)
        try {
          const guild = interaction.guild;
          if (guild) {
            const query = rawTarget.replace(/^@/, '').trim();
            const members = await guild.members.fetch({ query, limit: 10 }).catch(() => null);
            if (members && members.size > 0) {
              // Prefer exact tag match, then exact username, then first result
              let found = members.find(mb => mb.user.tag.toLowerCase() === query.toLowerCase());
              if (!found) found = members.find(mb => mb.user.username.toLowerCase() === query.toLowerCase());
              if (!found) found = members.first();
              if (found) discordId = found.user.id;
            }
          }
        } catch (e) {
          console.error('[BYPASS MODAL] member lookup error', e);
        }
      }
      if (!discordId) {
        return interaction.reply({ content: '❌ Cible invalide. Indique une mention (@user), un ID, ou un pseudo présent sur le serveur.', flags: 64 });
      }

      const BypassService = (await import('./services/bypassService.js')).default;
      const res = await BypassService.add(discordId, interaction.user.id, note);

      // Try to restore main menu embed on the original message
      try {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const embed = new EmbedBuilder()
          .setTitle('Gestion Bypass')
          .setDescription('Utilise les boutons ci-dessous pour **Add**, **Remove** ou **List** les utilisateurs bypass.\n\n• Add: ouvre un formulaire (mention ou id) + note (obligatoire)\n• Remove: ouvre un formulaire (mention ou id)')
          .setColor(0x5865F2);
        const addBtn = new ButtonBuilder().setCustomId('bypass_menu_add').setLabel('Add').setStyle(ButtonStyle.Success);
        const removeBtn = new ButtonBuilder().setCustomId('bypass_menu_remove').setLabel('Remove').setStyle(ButtonStyle.Danger);
        const listBtn = new ButtonBuilder().setCustomId('bypass_menu_list').setLabel('List').setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(addBtn, removeBtn, listBtn);

        const ch = interaction.channel;
        if (messageId && ch) {
          const msg = await ch.messages.fetch(messageId).catch(() => null);
          if (msg) await msg.edit({ embeds: [embed], components: [row] }).catch(() => null);
        }
      } catch (e) { console.error('[BYPASS MODAL] restore menu error', e); }

      if (res && res.success) {
        return interaction.reply({ content: `✅ Utilisateur ajouté au bypass. (${discordId})`, flags: 64 });
      }
      return interaction.reply({ content: `❌ Erreur: ${res.error || 'unknown'}`, flags: 64 });
    } catch (e) {
      console.error('[BYPASS MODAL ADD] Error', e);
      try { return interaction.reply({ content: `❌ Erreur interne: ${e.message}`, flags: 64 }); } catch { }
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('bypass_modal_remove:')) {
    try {
      const OWNER_ID = process.env.OWNER_ID || process.env.OWNER_IDS?.split(',')[0] || '492627367114702849';
      if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({ content: '❌ Seul le créateur du bot peut effectuer cette action.', flags: 64 });
      }

      const parts = interaction.customId.split(':');
      const messageId = parts[1];
      const rawTarget = interaction.fields.getTextInputValue('bypass_target').trim();
      const m = rawTarget.match(/<@!?(\d+)>/);
      let discordId = m ? m[1] : (rawTarget.match(/^\d+$/) ? rawTarget : null);
      if (!discordId) {
        try {
          const guild = interaction.guild;
          if (guild) {
            const query = rawTarget.replace(/^@/, '').trim();
            const members = await guild.members.fetch({ query, limit: 10 }).catch(() => null);
            if (members && members.size > 0) {
              let found = members.find(mb => mb.user.tag.toLowerCase() === query.toLowerCase());
              if (!found) found = members.find(mb => mb.user.username.toLowerCase() === query.toLowerCase());
              if (!found) found = members.first();
              if (found) discordId = found.user.id;
            }
          }
        } catch (e) {
          console.error('[BYPASS MODAL] member lookup error', e);
        }
      }
      if (!discordId) {
        return interaction.reply({ content: '❌ Cible invalide. Indique une mention (@user), un ID, ou un pseudo présent sur le serveur.', flags: 64 });
      }

      const BypassService = (await import('./services/bypassService.js')).default;
      const res = await BypassService.remove(discordId);

      // Restore main menu
      try {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const embed = new EmbedBuilder()
          .setTitle('Gestion Bypass')
          .setDescription('Utilise les boutons ci-dessous pour **Add**, **Remove** ou **List** les utilisateurs bypass.\n\n• Add: ouvre un formulaire (mention ou id) + note (obligatoire)\n• Remove: ouvre un formulaire (mention ou id)')
          .setColor(0x5865F2);
        const addBtn = new ButtonBuilder().setCustomId('bypass_menu_add').setLabel('Add').setStyle(ButtonStyle.Success);
        const removeBtn = new ButtonBuilder().setCustomId('bypass_menu_remove').setLabel('Remove').setStyle(ButtonStyle.Danger);
        const listBtn = new ButtonBuilder().setCustomId('bypass_menu_list').setLabel('List').setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(addBtn, removeBtn, listBtn);

        const ch = interaction.channel;
        if (messageId && ch) {
          const msg = await ch.messages.fetch(messageId).catch(() => null);
          if (msg) await msg.edit({ embeds: [embed], components: [row] }).catch(() => null);
        }
      } catch (e) { console.error('[BYPASS MODAL] restore menu error', e); }

      if (res && res.success) {
        return interaction.reply({ content: `✅ Utilisateur retiré du bypass. (${discordId})`, flags: 64 });
      }
      return interaction.reply({ content: `❌ Erreur: ${res.error || 'unknown'}`, flags: 64 });
    } catch (e) {
      console.error('[BYPASS MODAL REMOVE] Error', e);
      try { return interaction.reply({ content: `❌ Erreur interne: ${e.message}`, flags: 64 }); } catch { }
    }
  }

  // Gérer le modal de suppression de données serveur
  if (interaction.isModalSubmit() && interaction.customId.startsWith('delete_modal_')) {
    try {
      const serverId = interaction.customId.replace('delete_modal_', '');
      const guild = client.guilds.cache.get(serverId);
      const confirmation = interaction.fields.getTextInputValue('delete_confirmation');

      if (confirmation.toUpperCase() !== 'CONFIRMER') {
        return await interaction.reply({
          content: '❌ Suppression annulée - confirmation invalide',
          flags: 64
        });
      }

      const { deletePlayersByGuild } = await import('./utils/database.js');
      
      // Supprimer tous les données du serveur
      await deletePlayersByGuild(serverId);

      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('✅ Données Supprimées')
        .setDescription(`Toutes les données du serveur **${guild?.name || serverId}** ont été supprimées.`)
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: 64 });

      logToChannelAsync('admin', createLogEmbed(
        'Données Serveur Supprimées',
        `${interaction.user.username} a supprimé les données de **${guild?.name || serverId}** (${serverId})`
      ));
    } catch (error) {
      console.error('Delete modal error:', error);
      await interaction.reply({
        content: `❌ Erreur lors de la suppression: ${error.message}`,
        flags: 64
      });
    }
  }

  // Gérer le modal de bannissement de serveur (désactivé)
  if (interaction.isModalSubmit() && interaction.customId.startsWith('ban_modal_')) {
    await interaction.reply({
      content: '🚫 La fonctionnalité de ban serveur est désactivée.',
      flags: 64
    }).catch(() => null);
  }

  // Gérer le modal Broadcast
  if (interaction.isModalSubmit() && interaction.customId === 'broadcast_modal_pro') {
    try {
      const broadcastTitle = interaction.fields.getTextInputValue('broadcast_title_input');
      const broadcastContent = interaction.fields.getTextInputValue('broadcast_content_input');
      
      if (!broadcastTitle || !broadcastContent) {
        return await interaction.reply({
          content: '❌ Titre et contenu sont obligatoires',
          flags: 64
        });
      }

      // Créer le select menu des couleurs
      const colorSelect = new StringSelectMenuBuilder()
        .setCustomId('broadcast_color_select')
        .setPlaceholder('🎨 Choisissez une couleur...')
        .addOptions([
          { label: '🟢 Vert', value: 'green', emoji: '🟢' },
          { label: '🔴 Rouge', value: 'red', emoji: '🔴' },
          { label: '🔵 Bleu', value: 'blue', emoji: '🔵' },
          { label: '⭐ Or', value: 'gold', emoji: '⭐' },
          { label: '🟠 Orange', value: 'orange', emoji: '🟠' },
          { label: '💜 Violet', value: 'purple', emoji: '💜' }
        ]);

      const cancelButton = new ButtonBuilder()
        .setCustomId('broadcast_cancel')
        .setLabel('❌ Annuler')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger);

      const actionRow1 = new ActionRowBuilder().addComponents(colorSelect);
      const actionRow2 = new ActionRowBuilder().addComponents(cancelButton);

      // Afficher un embed de confirmation avec le select menu (couleur bleu par défaut)
      const previewEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setAuthor({ name: '📢 APERÇU BROADCAST', iconURL: client.user.displayAvatarURL() })
        .setTitle(broadcastTitle)
        .setDescription(broadcastContent)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields({ name: '━━━━━━━━━━━━━━━━━', value: '**Sélectionnez une couleur ci-dessous pour envoyer**', inline: false })
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      // Stocker les données temporaires pour le select menu
      client.broadcastData = client.broadcastData || {};
      client.broadcastData[interaction.user.id] = { title: broadcastTitle, content: broadcastContent };

      // Récupérer le message du panel admin
      const panelMessageId = adminPanelMessages.get(interaction.guildId);
      if (!panelMessageId) {
        return await interaction.reply({
          content: '❌ Panel admin non disponible',
          flags: 64
        });
      }

      let panelMessage;
      try {
        panelMessage = await interaction.channel.messages.fetch(panelMessageId);
      } catch (fetchErr) {
        return await interaction.reply({
          content: '❌ Message du panel introuvable',
          flags: 64
        });
      }

      // Mettre à jour le panel avec l'aperçu du broadcast
      try {
        await panelMessage.edit({ embeds: [previewEmbed], components: [actionRow1, actionRow2] });
        // Fermer le modal pour l'utilisateur
        await interaction.deferUpdate();
      } catch (editErr) {
        console.error('Erreur lors de la modification du panel:', editErr);
        return await interaction.reply({
          content: '❌ Erreur lors de la mise à jour du panel',
          flags: 64
        });
      }

    } catch (error) {
      console.error('Erreur lors du traitement du modal broadcast:', error);
      await interaction.reply({ content: '❌ Une erreur est survenue', flags: 64 });
    }
  }

  // Gérer le modal du changement de version
  if (interaction.isModalSubmit() && interaction.customId === 'version_modal_pro') {
    try {
      const newVersion = interaction.fields.getTextInputValue('version_input');
      
      if (!newVersion || newVersion.trim() === '') {
        return await interaction.reply({
          content: '❌ Vous devez entrer une version valide',
          flags: 64
        });
      }

      // Créer l'aperçu de la nouvelle version
      const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      const currentVersion = config.version || '1.0.0';

      const versionPreviewEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setAuthor({ name: '🔢 APERÇU VERSION', iconURL: client.user.displayAvatarURL() })
        .setTitle('Changement de Version')
        .setDescription(`Êtes-vous sûr de vouloir changer la version?`)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: '📌 Version Actuelle', value: `\`${currentVersion}\``, inline: true },
          { name: '🆕 Nouvelle Version', value: `\`${newVersion}\``, inline: true },
          { name: '━━━━━━━━━━━━', value: 'Cliquez sur "Confirmer" pour appliquer le changement', inline: false }
        )
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      // Boutons de confirmation et annulation
      const confirmButton = new ButtonBuilder()
        .setCustomId(`version_confirm_${newVersion}`)
        .setLabel('✅ Confirmer')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success);

      const cancelButton = new ButtonBuilder()
        .setCustomId('version_cancel')
        .setLabel('❌ Annuler')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger);

      const versionActionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      // Stocker les données temporaires
      client.versionData = client.versionData || {};
      client.versionData[interaction.user.id] = { newVersion, currentVersion };

      // Récupérer le message du panel admin
      const panelMessageId = adminPanelMessages.get(interaction.guildId);
      if (!panelMessageId) {
        return await interaction.reply({
          content: '❌ Panel admin non disponible',
          flags: 64
        });
      }

      let panelMessage;
      try {
        panelMessage = await interaction.channel.messages.fetch(panelMessageId);
      } catch (fetchErr) {
        return await interaction.reply({
          content: '❌ Message du panel introuvable',
          flags: 64
        });
      }

      // Mettre à jour le panel avec l'aperçu de la version
      try {
        await panelMessage.edit({ embeds: [versionPreviewEmbed], components: [versionActionRow] });
        // Fermer le modal pour l'utilisateur
        await interaction.deferUpdate();
      } catch (editErr) {
        console.error('Erreur lors de la modification du panel:', editErr);
        return await interaction.reply({
          content: '❌ Erreur lors de la mise à jour du panel',
          flags: 64
        });
      }

    } catch (error) {
      console.error('Erreur lors du traitement du modal version:', error);
      await interaction.reply({ content: '❌ Une erreur est survenue', flags: 64 });
    }
  }

  // Gérer le modal de bannissement d'utilisateur (fonctionnalité désactivée)
  if (interaction.isModalSubmit() && interaction.customId === 'modal_ban_user') {
    await interaction.reply({
      content: '🚫 La fonctionnalité de ban utilisateur est désactivée.',
      flags: 64
    }).catch(() => {});
  }

  // Gérer le select menu des couleurs pour le broadcast
  if (interaction.isStringSelectMenu() && interaction.customId === 'broadcast_color_select') {
    try {
      const selectedColor = interaction.values[0];
      const broadcastData = client.broadcastData?.[interaction.user.id];

      if (!broadcastData) {
        return await interaction.deferUpdate();
      }

      const { title, content } = broadcastData;
      const colorMap = {
        'green': 0x2ECC71,
        'red': 0xFF6B6B,
        'blue': 0x3498DB,
        'gold': 0xD4AF37,
        'orange': 0xFFA500,
        'purple': 0x9B59B6
      };
      const embedColor = colorMap[selectedColor] || 0x2ECC71;

      // Créer l'embed avec la couleur sélectionnée
      const finalEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: '📢 ANNONCE OFFICIELLE', iconURL: client.user.displayAvatarURL() })
        .setTitle(title)
        .setDescription(content)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields({ name: '━━━━━━━━━━━━━━━━━', value: '✨ Message du créateur du bot', inline: false })
        .setFooter({ text: `✨ Créé par LeBelge_e | Gorille™・BOTS`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      // Créer le select menu coloré et un bouton de confirmation
      const colorSelect = new StringSelectMenuBuilder()
        .setCustomId('broadcast_color_select')
        .setPlaceholder(`🎨 Couleur sélectionnée: ${selectedColor}`)
        .addOptions([
          { label: '🟢 Vert', value: 'green', emoji: '🟢', default: selectedColor === 'green' },
          { label: '🔴 Rouge', value: 'red', emoji: '🔴', default: selectedColor === 'red' },
          { label: '🔵 Bleu', value: 'blue', emoji: '🔵', default: selectedColor === 'blue' },
          { label: '⭐ Or', value: 'gold', emoji: '⭐', default: selectedColor === 'gold' },
          { label: '🟠 Orange', value: 'orange', emoji: '🟠', default: selectedColor === 'orange' },
          { label: '💜 Violet', value: 'purple', emoji: '💜', default: selectedColor === 'purple' }
        ]);

      const confirmButton = new ButtonBuilder()
        .setCustomId(`broadcast_confirm_${selectedColor}`)
        .setLabel('✅ Envoyer')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success);

      const cancelButton = new ButtonBuilder()
        .setCustomId('broadcast_cancel')
        .setLabel('❌ Annuler')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger);

      const actionRow1 = new ActionRowBuilder().addComponents(colorSelect);
      const actionRow2 = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      // Mettre à jour le panel directement
      await interaction.update({ embeds: [finalEmbed], components: [actionRow1, actionRow2] });

    } catch (error) {
      console.error('Erreur lors de la sélection de couleur:', error);
      await interaction.deferUpdate();
    }
  }

  // Gérer le bouton d'annulation
  if (interaction.isButton() && interaction.customId === 'broadcast_cancel') {
    try {
      console.log('[broadcast_cancel] User cancelled broadcast');
      
      // Nettoyer les données temporaires
      delete client.broadcastData[interaction.user.id];

      // Recharger le panel principal avec la fonction réutilisable
      const panelData = await reloadAdminPanel(interaction);
      if (panelData) {
        console.log('[broadcast_cancel] Returning to main panel via interaction.update()');
        await interaction.update(panelData);
      }

    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
      await interaction.deferUpdate();
    }
  }

  // Gérer le bouton de confirmation du broadcast
  if (interaction.isButton() && interaction.customId.startsWith('broadcast_confirm_')) {
    try {
      const selectedColor = interaction.customId.replace('broadcast_confirm_', '');
      const broadcastData = client.broadcastData?.[interaction.user.id];

      if (!broadcastData) {
        return await interaction.deferUpdate();
      }

      const { title, content } = broadcastData;
      const colorMap = {
        'green': 0x2ECC71,
        'red': 0xFF6B6B,
        'blue': 0x3498DB,
        'gold': 0xD4AF37,
        'orange': 0xFFA500,
        'purple': 0x9B59B6
      };
      const embedColor = colorMap[selectedColor] || 0x2ECC71;

      // Afficher message d'envoi en cours
      const loadingEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setAuthor({ name: '⏳ BROADCAST EN COURS', iconURL: client.user.displayAvatarURL() })
        .setTitle('Transmission en cours...')
        .setDescription('Envoi du message à tous les serveurs configurés\n\n*Veuillez patienter...*')
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      // Récupérer le panel et le mettre à jour
      const panelMessageId = adminPanelMessages.get(interaction.guildId);
      let panelMessage;
      if (panelMessageId) {
        try {
          panelMessage = await interaction.channel.messages.fetch(panelMessageId);
          await panelMessage.edit({ embeds: [loadingEmbed], components: [] });
        } catch (err) {
          console.error('Erreur lors de la mise à jour du panel:', err);
        }
      }

      await interaction.deferUpdate();

      // Envoyer à tous les serveurs
      let sent = 0;
      let skipped = 0;

      for (const guild of client.guilds.cache.values()) {
        try {
          const broadcastChannelId = await getBroadcastChannel(guild.id);

          if (!broadcastChannelId) {
            skipped++;
            continue;
          }

          const channel = guild.channels.cache.get(broadcastChannelId);

          if (!channel || !channel.isTextBased() || !channel.permissionsFor(client.user)?.has('SendMessages')) {
            skipped++;
            continue;
          }

          await channel.send({
            embeds: [new EmbedBuilder()
              .setColor(embedColor)
              .setAuthor({ name: '📢 ANNONCE OFFICIELLE', iconURL: client.user.displayAvatarURL() })
              .setTitle(title)
              .setDescription(content)
              .setThumbnail(client.user.displayAvatarURL())
              .addFields({ name: '━━━━━━━━━━━━━━━━━', value: '✨ Message du créateur du bot', inline: false })
              .setFooter({ text: `${guild.name} • Message du créateur du bot`, iconURL: client.user.displayAvatarURL() })
              .setTimestamp()]
          });
          sent++;
        } catch (err) {
          console.error(`Erreur broadcast pour ${guild.name}:`, err);
          skipped++;
        }
      }

      // Confirmation professionnelle
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setAuthor({ name: '✅ BROADCAST COMPLÉTÉ', iconURL: client.user.displayAvatarURL() })
        .setTitle(`📢 ${title}`)
        .setDescription(content)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: '🎨 COULEUR', value: `\`${selectedColor}\``, inline: true },
          { name: '✅ SERVEURS', value: `\`${sent}\``, inline: true },
          { name: '⏭️ IGNORÉS', value: `\`${skipped}\``, inline: true },
          { name: '━━━━━━━━━━━━━━━━━', value: '📊 **Contexte**', inline: false },
          { name: 'Envoyé par', value: `\`${interaction.user.username}\``, inline: true },
          { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      // Mettre à jour le panel avec la confirmation
      if (panelMessage) {
        await panelMessage.edit({ embeds: [confirmEmbed], components: [] });
      }

      // Tracker le broadcast
      trackUpdate('Broadcast Sent', `📢 "${title}" envoyé à ${sent} serveurs`, '📢');

      logToChannelAsync('broadcast', createLogEmbed(
        '📢 Broadcast Envoyé',
        `\`${interaction.user.username}\` a envoyé un broadcast\n\n**Titre:** \`${title}\`\n**Couleur:** \`${selectedColor}\`\n**Serveurs:** ***${sent}***\n**Ignorés:** ${skipped}`
      ));

      // Nettoyer les données temporaires
      delete client.broadcastData[interaction.user.id];

      // Annuler le timeout précédent s'il existe (évite les race conditions)
      const existingTimeout = adminPanelTimeouts.get(interaction.guildId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        console.log('[broadcast_confirm] Cleared previous timeout');
      }

      // Après 3 secondes: revenir au panel admin
      const timeoutId = setTimeout(async () => {
        try {
          const panelMessageId = adminPanelMessages.get(interaction.guildId);
          if (!panelMessageId) return;
          
          let panelMessage;
          try {
            panelMessage = await interaction.channel.messages.fetch(panelMessageId);
          } catch (fetchErr) {
            console.warn(`Panel message ${panelMessageId} not found, skipping update`);
            return;
          }
          
          const panelData = await reloadAdminPanel(interaction);
          if (panelData) {
            await panelMessage.edit(panelData);
          }
        } catch (e) {
          console.error('Error reverting to admin panel after broadcast:', e);
        } finally {
          // Nettoyer le timeout du cache quand il est terminé
          adminPanelTimeouts.delete(interaction.guildId);
        }
      }, 2000);
      
      // Sauvegarder le timeoutId pour pouvoir l'annuler s'il y a une nouvelle interaction
      adminPanelTimeouts.set(interaction.guildId, timeoutId);

    } catch (error) {
      console.error('Broadcast button error:', error);
    }
  }

  // Gérer l'annulation du changement de version
  if (interaction.isButton() && interaction.customId === 'version_cancel') {
    try {
      console.log('[version_cancel] User cancelled version change');
      
      // Nettoyer les données temporaires
      delete client.versionData?.[interaction.user.id];

      // Recharger le panel principal avec la fonction réutilisable
      const panelData = await reloadAdminPanel(interaction);
      if (panelData) {
        console.log('[version_cancel] Returning to main panel via interaction.update()');
        await interaction.update(panelData);
      }

    } catch (error) {
      console.error('Erreur lors de l\'annulation du changement de version:', error);
      await interaction.deferUpdate();
    }
  }

  // Gérer le bouton de confirmation du changement de version
  if (interaction.isButton() && interaction.customId.startsWith('version_confirm_')) {
    try {
      const newVersion = interaction.customId.replace('version_confirm_', '');
      const versionData = client.versionData?.[interaction.user.id];

      if (!versionData) {
        return await interaction.deferUpdate();
      }

      // Message de chargement
      const loadingEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setAuthor({ name: '⏳ MISE À JOUR EN COURS', iconURL: client.user.displayAvatarURL() })
        .setTitle('Changement de version...')
        .setDescription('Mise à jour en cours...\n\n*Veuillez patienter...*')
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      // Récupérer le panel et le mettre à jour
      const panelMessageId = adminPanelMessages.get(interaction.guildId);
      let panelMessage;
      if (panelMessageId) {
        try {
          panelMessage = await interaction.channel.messages.fetch(panelMessageId);
          await panelMessage.edit({ embeds: [loadingEmbed], components: [] });
        } catch (err) {
          console.error('Erreur lors de la mise à jour du panel:', err);
        }
      }

      await interaction.deferUpdate();

      // Mettre à jour la configuration
      const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      const oldVersion = config.version;
      config.version = newVersion;
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      // Tracker le changement de version
      trackUpdate('Version Update', `${oldVersion} → ${newVersion}`, '🔢');

      // Confirmation professionnelle
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setAuthor({ name: '✅ VERSION MISE À JOUR', iconURL: client.user.displayAvatarURL() })
        .setTitle('🔢 Version Changée avec Succès')
        .setDescription(`La version du bot a été mise à jour`)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: '📌 Ancienne Version', value: `\`${oldVersion}\``, inline: true },
          { name: '🆕 Nouvelle Version', value: `\`${newVersion}\``, inline: true },
          { name: '━━━━━━━━━━━━', value: '✨ **Information**', inline: false },
          { name: 'Modifiée par', value: `\`${interaction.user.username}\``, inline: true },
          { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      // Mettre à jour le panel avec la confirmation
      if (panelMessage) {
        await panelMessage.edit({ embeds: [confirmEmbed], components: [] });
      }

      logToChannelAsync('admin', createLogEmbed(
        '🔢 Version Mise à Jour',
        `\`${interaction.user.username}\` a changé la version\n\n**Ancienne:** \`${oldVersion}\`\n**Nouvelle:** \`${newVersion}\``
      ));

      // Nettoyer les données temporaires
      delete client.versionData?.[interaction.user.id];

      // Annuler le timeout précédent s'il existe (évite les race conditions)
      const existingTimeout = adminPanelTimeouts.get(interaction.guildId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        console.log('[version_confirm] Cleared previous timeout');
      }

      // Après 2 secondes: revenir au panel admin
      const timeoutId = setTimeout(async () => {
        try {
          const panelMessageId = adminPanelMessages.get(interaction.guildId);
          if (!panelMessageId) return;
          
          let panelMessage;
          try {
            panelMessage = await interaction.channel.messages.fetch(panelMessageId);
          } catch (fetchErr) {
            console.warn(`Panel message ${panelMessageId} not found, skipping update`);
            return;
          }
          
          const panelData = await reloadAdminPanel(interaction);
          if (panelData) {
            await panelMessage.edit(panelData);
          }
        } catch (e) {
          console.error('Error reverting to admin panel after version change:', e);
        } finally {
          // Nettoyer le timeout du cache quand il est terminé
          adminPanelTimeouts.delete(interaction.guildId);
        }
      }, 2000);
      
      // Sauvegarder le timeoutId pour pouvoir l'annuler s'il y a une nouvelle interaction
      adminPanelTimeouts.set(interaction.guildId, timeoutId);

    } catch (error) {
      console.error('Version button error:', error);
    }
  }

  // Gérer les search modals pour les logs
  if (interaction.isModalSubmit() && interaction.customId.startsWith('logs_search_modal_')) {
    try {
      const logType = interaction.customId.replace('logs_search_modal_', '');
      const searchQuery = interaction.fields.getTextInputValue(`logs_search_input_${logType}`).toLowerCase().trim();
      
      const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin-config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      
      // Filtrer les channels en fonction de la recherche (UNIQUEMENT les channels texte)
      const matchedChannels = interaction.guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText)
        .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery))
        .map(c => ({
          label: c.name.substring(0, 100),
          value: c.id,
          description: `#${c.name}`.substring(0, 100)
        }))
        .slice(0, 25);
      
      if (matchedChannels.length === 0) {
        return await interaction.reply({
          content: `❌ Aucun channel trouvé contenant "${searchQuery}"`,
          flags: 64
        });
      }
      
      // Créer le select menu avec les channels filtrés
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`logs_select_${logType}`)
        .setPlaceholder(`Sélectionner un channel pour ${logType}`)
        .addOptions(matchedChannels);
      
      const selectRow = new ActionRowBuilder().addComponents(selectMenu);
      
      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('logs_back')
          .setLabel('← Retour à la config')
          .setEmoji('⬅️')
          .setStyle(ButtonStyle.Danger)
      );
      
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle(`⚙️・Configuration: ${logType.toUpperCase()}`)
        .setDescription(`${matchedChannels.length} channel(s) trouvé(s)`)
        .addFields({
          name: 'Recherche',
          value: searchQuery ? `\`${searchQuery}\`` : '(tous les channels)',
          inline: false
        })
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
        .setTimestamp();
      
      // Utiliser update() pour afficher le SelectMenu sur le même message
      await interaction.update({
        embeds: [embed],
        components: [selectRow, backButton]
      });
    } catch (error) {
      console.error('Logs search modal error:', error);
      await interaction.reply({
        content: '❌ Erreur lors de la recherche',
        flags: 64
      }).catch(() => {});
    }
  }

  // Gérer la sélection d'utilisateurs à débannir (fonctionnalité désactivée)
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_unban_user') {
    await interaction.reply({
      content: '🚫 La fonctionnalité de débannissement utilisateur est désactivée.',
      flags: 64
    }).catch(() => {});
  }

  // Gérer les sélections de menu (remove player)
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('remove_player_')) {
    try {
      const selectedPlayerId = interaction.values[0];
      const guildId = interaction.guildId;

      // Vérifier permission admin
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
          content: '❌ Vous devez être **administrateur** pour supprimer des joueurs !'
        });
      }

      // Supprimer le joueur par ID
      await deletePlayerById(parseInt(selectedPlayerId));

      // Récupérer la liste actuelle des joueurs restants
      const remainingPlayers = await getPlayersByGuild(guildId);

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('✅ **Joueur Supprimé**')
        .setDescription(`**Suppression confirmée !**\n\n**Joueurs restants:** ${remainingPlayers.length}`)
        .setTimestamp()
        .setFooter({ text: 'Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

      // Répondre à l'interaction
      if (remainingPlayers.length > 0) {
        embed.addFields({
          name: '📋 Joueurs restants',
          value: remainingPlayers.map(p => `• ${p.username}`).join('\n'),
          inline: false
        });
      }

      await interaction.reply({
        embeds: [embed]
      });

      console.log(`🗑️ Joueur sélectionné supprimé (ID: ${selectedPlayerId})`);
    } catch (error) {
      console.error('Error removing player via select menu:', error);
      await interaction.reply({
        content: '❌ Erreur lors de la suppression du joueur'
      });
    }
  }
});

async function main() {
  try {
    await initDatabase();
    await OrphanLogService.init();
    await BypassService.init();
    setSecurityDb(getDb());
    await cleanupDuplicatePlayers();
    
    // Initialiser les caches des joueurs sauvegardés
    await updatePlayersCache();
    await updateSaveCache();
    await updateInfoCache();
    
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ Bot startup error:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    // Détruire le client immédiatement (déconnecte du WebSocket)
    client.destroy();
    console.log('✓ Bot disconnected from Discord');
    
    // Fermer la base de données
    await closeDatabase();
    
    console.log('✓ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Shutdown error:', error);
    process.exit(1);
  }
});

// Gérer aussi les erreurs de connexion
client.on('error', (error) => {
  console.error('⚠️ Client error:', error);
});

client.on('disconnect', () => {
  console.log('⚠️ Bot disconnected from Discord');
});

main();
