import cron from 'node-cron';
import { getPlayers, getPlayersByGuild, updatePlayerCheckTime, updateAlertSentTime, getLastAlertTime, updatePlayerStatus, updateLastReconnectionAlert, getLastReconnectionAlertTime, getCheckFrequency, getAllLastCheckTimes, updateLastCheckTime, getBroadcastChannel, getGuildConfig as getDbGuildConfig, updateGuildConfig, getConfiguredMonitorGuildIdsFromDb } from '../utils/database.js';
import { getGuildConfig as getFileGuildConfig, getConfiguredMonitorGuildIds } from '../utils/guildConfig.js';
import { scrapePactifyProfile, formatDays } from '../utils/scraper.js';
import { formatInactivityTime, createProgressBar, getColorByStatus, getStatusEmoji } from '../utils/embedFormatter.js';
import { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Helper to merge file + DB guild config
async function getGuildConfig(guildId) {
  const fileConfig = getFileGuildConfig(guildId) || {};
  const dbConfig = await getDbGuildConfig(guildId) || {};
  return {
    ...fileConfig,
    ...dbConfig,
    monitorChannelId: dbConfig.monitor_channel_id || fileConfig.monitorChannelId,
    monitorMessageId: dbConfig.monitor_message_id || fileConfig.monitorMessageId,
    summaryChannelId: dbConfig.summary_channel_id || fileConfig.summaryChannelId,
    alertChannelId: dbConfig.alert_channel_id || fileConfig.alertChannelId,
    inactivityThreshold: dbConfig.inactivity_threshold || fileConfig.inactivityThreshold
  };
}

let client;
let cronJobsEnabled = false; // CRITICAL: Disable CRON during startup phase
const guildLastCheckTime = {}; // Track last check time per guild
const monitorMessageStates = {}; // Track last rendered state to avoid redundant message edits

function normalizePlayerData(player) {
  return {
    ...player,
    userId: player.userId || player.discordId,
    playerName: player.playerName || player.username || player.discordId || 'unknown',
    playerFaction: player.playerFaction || player.faction || null,
    playerImageUrl: player.playerImageUrl || player.image_url || null,
    playerRole: player.playerRole || player.role || null
  };
}

function buildMonitorState({ playerCount, frequency, nextCheckLabel, thresholdDisplay, alertChannelId, monitorChannelId, summaryChannelId }) {
  return {
    playerCount,
    frequency,
    nextCheckLabel,
    thresholdDisplay,
    alertChannelId,
    monitorChannelId,
    summaryChannelId
  };
}

function shouldUpdateMonitorMessage(guildId, newState) {
  const prev = monitorMessageStates[guildId];
  if (!prev) return true;
  return (
    prev.playerCount !== newState.playerCount ||
    prev.frequency !== newState.frequency ||
    prev.nextCheckLabel !== newState.nextCheckLabel ||
    prev.thresholdDisplay !== newState.thresholdDisplay ||
    prev.alertChannelId !== newState.alertChannelId ||
    prev.monitorChannelId !== newState.monitorChannelId ||
    prev.summaryChannelId !== newState.summaryChannelId
  );
}

export async function initCronJobs(discordClient) {
  client = discordClient;
  cronJobsEnabled = true;

  // Charger les last_check_time depuis la base de données
  try {
    const lastCheckTimes = await getAllLastCheckTimes();
    Object.assign(guildLastCheckTime, lastCheckTimes);
    
    // Restaurer les timers pour TOUS les guilds (même sans players valides)
    for (const guildId of Object.keys(lastCheckTimes)) {
      try {
        const frequency = await getCheckFrequency(guildId);
        const lastCheck = guildLastCheckTime[guildId] || 0;
        const now = Date.now();
        const minutesElapsed = (now - lastCheck) / (1000 * 60);
        const nextCheckIn = Math.max(0, frequency - minutesElapsed);
        
        // Restaurer le timer visuel
        await updateGuildMonitorMessage(guildId, frequency, nextCheckIn, 0);
        if (nextCheckIn > 0) {
          // Timer visuel restauré sans log de debug
        }
      } catch (err) {
        // Silent fail if guild not accessible
      }
    }
  } catch (err) {
    console.warn('[CRON] ⚠️ Impossible de charger les last check times:', err.message);
  }

  // S'exécute chaque minute pour vérifier si une vérification est nécessaire
  const monitorCronJob = cron.schedule('* * * * *', async () => {
    try {
      await checkInactivityIfNeeded();
    } catch (error) {
      console.error('[CRON] Error in checkInactivityIfNeeded:', error.stack || error);
    }
  });
}

async function checkInactivityIfNeeded() {
  try {
    const players = await getPlayers();
    const playersByGuild = {};
    let orphanCount = 0;

    for (const player of players) {
      if (!player.guildId) {
        orphanCount++;
        continue;
      }
      if (!playersByGuild[player.guildId]) {
        playersByGuild[player.guildId] = [];
      }
      playersByGuild[player.guildId].push(player);
    }

    if (orphanCount > 0 && cronJobsEnabled && Object.keys(playersByGuild).length > 0) {
      console.warn(`⚠️ ${orphanCount} joueur(s) sans guildId ignoré(s)`);
    }

    const fileConfiguredGuildIds = getConfiguredMonitorGuildIds();
    const dbConfiguredGuildIds = await getConfiguredMonitorGuildIdsFromDb();
    const configuredGuildIds = Array.from(new Set([...fileConfiguredGuildIds, ...dbConfiguredGuildIds]));
    const guildIdsToUpdate = new Set([...Object.keys(playersByGuild), ...configuredGuildIds]);

    if (guildIdsToUpdate.size === 0) {
      return;
    }

    for (const guildId of guildIdsToUpdate) {
      try {
        const frequency = await getCheckFrequency(guildId);
        const lastCheck = guildLastCheckTime[guildId] || 0;
        const now = Date.now();
        const minutesElapsed = (now - lastCheck) / (1000 * 60);
        const nextCheckIn = Math.max(0, frequency - minutesElapsed);
        const playerCount = playersByGuild[guildId]?.length || 0;
        const guildConfig = await getGuildConfig(guildId);
        const thresholdHours = guildConfig?.inactivityThreshold || parseInt(process.env.INACTIVITY_THRESHOLD) || 9;

        await updateGuildMonitorMessage(guildId, frequency, nextCheckIn, playerCount);

        if (minutesElapsed >= frequency) {
          guildLastCheckTime[guildId] = now;

          try {
            await updateLastCheckTime(guildId, now);
          } catch (dbErr) {
            console.warn(`⚠️ Impossible de sauvegarder le last check time pour ${guildId}:`, dbErr.message);
          }

          const result = await runInactivityCheckForGuild(guildId);

          try {
            await sendVerificationSummary(guildId, result);
          } catch (err) {
            console.error(`[MONITOR][${guildId}] erreur envoi summary`, err.stack || err);
          }

          try {
            await updateGuildMonitorMessage(guildId, frequency, 0, playerCount);
          } catch (err) {
            console.error(`[MONITOR][${guildId}] erreur update message après vérification`, err.stack || err);
          }
        }
      } catch (error) {
        console.error(`❌ Erreur vérification pour serveur ${guildId}:`, error.stack || error);
      }
    }
  } catch (err) {
    if (!err.message?.includes('buffering timed out')) {
      console.error('[CRON] Unexpected error:', err.stack || err);
    }
  }
}

export async function runInactivityCheckForGuild(guildId) {
  const players = await getPlayersByGuild(guildId);
  if (!players || players.length === 0) {
    return { success: false, playersChecked: 0, alertsTriggered: 0 };
  }

  const alertsTriggered = await checkInactivityForGuild(players.map(normalizePlayerData));
  return { success: true, playersChecked: players.length, alertsTriggered: alertsTriggered || 0 };
}

async function sendVerificationSummary(guildId, { playersChecked = 0, alertsTriggered = 0 } = {}) {
  try {
    if (!client) return;
    const guildConfig = await getGuildConfig(guildId);
    const summaryChannelId = guildConfig?.summaryChannelId;
    if (!summaryChannelId) return;

    const guildObj = client.guilds.cache.get(guildId);
    if (!guildObj) return;

    const channel = await guildObj.channels.fetch(summaryChannelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const summaryEmbed = new EmbedBuilder()
      .setTitle('✅ Vérification effectuée')
      .setDescription(`\`${playersChecked} joueur(s)\` vérifiés\n\`${alertsTriggered} alerte(s)\` envoyées`)
      .setTimestamp();

    await channel.send({ embeds: [summaryEmbed] }).catch(() => null);
  } catch (error) {
    console.error(`[SUMMARY][${guildId}] impossible d'envoyer le résumé de vérification:`, error.stack || error);
  }
}

export async function runManualInactivityCheck(guildId) {
  const result = await runInactivityCheckForGuild(guildId);
  await sendVerificationSummary(guildId, result).catch(() => null);
  return result;
}

export async function updateGuildMonitorMessage(guildId, frequency, nextCheckIn, playerCount) {
  try {
    const dbGuildConfig = await getDbGuildConfig(guildId);
    const fileGuildConfig = getFileGuildConfig(guildId);
    const monitorChannelId = dbGuildConfig?.monitor_channel_id || fileGuildConfig?.monitorChannelId;
    const monitorMessageId = dbGuildConfig?.monitor_message_id || fileGuildConfig?.monitorMessageId;
    const alertChannelId = dbGuildConfig?.alert_channel_id || fileGuildConfig?.alertChannelId;
    const guildConfig = {
      ...fileGuildConfig,
      ...dbGuildConfig,
      monitorChannelId,
      monitorMessageId,
      alertChannelId
    };

    // Trace call for troubleshooting without accessing possibly-null objects
    console.log(`[MONITOR-DBG] updateGuildMonitorMessage start guild=${guildId} monitorChannelId=${monitorChannelId} monitorMessageId=${monitorMessageId}`);

    if (!monitorChannelId) {
      return;
    }

    const guildPlayers = await getPlayersByGuild(guildId);
    const dbPlayerCount = Array.isArray(guildPlayers) ? guildPlayers.length : 0;
    const passedPlayerCount = playerCount;

    const effectivePlayerCount = dbPlayerCount;

    const guild = client.guilds.cache.get(guildId);
    const guildInCache = !!guild;
    console.log(`[MONITOR-DBG] guildInCache=${guildInCache} for guild=${guildId}`);
    if (!guild) {
      console.log(`[MONITOR-DBG] guild not present in client cache for guild=${guildId}`);
      return;
    }

    const channel = await guild.channels.fetch(monitorChannelId).catch((err) => {
      console.error(`Erreur fetch monitor channel pour guild ${guildId}:`, err.stack || err);
      return null;
    });
    if (!channel) {
      console.log(`[MONITOR-DBG] channel.fetch returned null for guild=${guildId} channelId=${monitorChannelId}`);
    } else {
      console.log(`[MONITOR-DBG] channel fetched for guild=${guildId} channelId=${channel.id} type=${channel.type}`);
    }
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.warn(`⚠️ Channel de statut introuvable ou invalide pour guild ${guildId}: ${monitorChannelId}`);
      return;
    }

    const thresholdHours = guildConfig?.inactivityThreshold || parseInt(process.env.INACTIVITY_THRESHOLD) || 9;
    const thresholdDays = thresholdHours / 24;
    const thresholdDisplay = (() => {
      if (thresholdHours >= 24) {
        const days = Math.floor(thresholdHours / 24);
        const hours = thresholdHours % 24;
        return hours > 0 ? `${days}j ${hours}h` : `${days}j`;
      }
      return `${thresholdHours}h`;
    })();

    const freqSeconds = Math.max(1, Math.floor((frequency || 1) * 60));
    const lastCheck = guildLastCheckTime[guildId] || 0;
    const now = Date.now();
    const secondsElapsed = lastCheck ? Math.max(0, Math.floor((now - lastCheck) / 1000)) : 0;
    let secondsRemaining = Math.max(0, freqSeconds - secondsElapsed);

    // If caller provided nextCheckIn (in minutes) and we don't have lastCheck, use that as fallback
    if ((!lastCheck || lastCheck === 0) && typeof nextCheckIn === 'number' && nextCheckIn > 0) {
      secondsRemaining = Math.max(0, Math.floor(nextCheckIn * 60));
    }

    // Avoid immediately triggering a full check when nextCheckIn is 0 and there's no last check yet
    if ((!lastCheck || lastCheck === 0) && (nextCheckIn === undefined || nextCheckIn === null || nextCheckIn === 0)) {
      secondsRemaining = freqSeconds;
    }

    const minutesRemaining = Math.max(0, Math.ceil(secondsRemaining / 60));
    const nextCheckLabel = minutesRemaining === 0 ? 'Maintenant' : `${minutesRemaining}m`;
    const guildName = guild.name || guildId;

    const prevState = monitorMessageStates[guildId];
    const newState = buildMonitorState({
      playerCount: effectivePlayerCount,
      frequency,
      nextCheckLabel,
      thresholdDisplay,
      alertChannelId: guildConfig.alertChannelId,
      monitorChannelId
    });


    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('⏱️ Statut de surveillance des joueurs')
      .setDescription(`Suivi automatique des joueurs inactifs pour **${guildName}**`)
      .addFields(
        { name: '📊 Joueurs surveillés', value: `
\`${effectivePlayerCount} joueur(s)\``, inline: true },
        { name: '⏱️ Seuil', value: `\`${thresholdDisplay}\``, inline: true },
        { name: '🔁 Fréquence', value: `\`${frequency} minutes\``, inline: true },
        { name: '⌛ Prochaine vérif', value: `\`${nextCheckLabel}\``, inline: true },
        { name: '📢 Channel d\'alerte', value: guildConfig.alertChannelId ? `<#${guildConfig.alertChannelId}>` : '`Aucun`', inline: true },
        { name: '📰 Channel de statut', value: `<#${monitorChannelId}>`, inline: true }
      )
      .setTimestamp();

    let message = null;
    if (guildConfig.monitorMessageId) {
      console.log(`[MONITOR-DBG] monitorMessageId present (${guildConfig.monitorMessageId}) for guild=${guildId}, attempting fetch`);
      try {
        message = await channel.messages.fetch(guildConfig.monitorMessageId);
        console.log(`[MONITOR-DBG] fetched monitor message id=${guildConfig.monitorMessageId} for guild=${guildId}`);
      } catch (fetchErr) {
        console.error(`Erreur fetch monitor message pour guild ${guildId} id=${guildConfig.monitorMessageId}`, { message: fetchErr.message, code: fetchErr.code, httpStatus: fetchErr?.status, name: fetchErr.name });

        const errMsg = String(fetchErr?.message || '').toLowerCase();
        const isUnknown = errMsg.includes('unknown message') || fetchErr?.code === 10008 || fetchErr?.status === 404;
        const isMissingAccess = errMsg.includes('missing access') || fetchErr?.code === 50013 || fetchErr?.status === 403;

        if (isMissingAccess) {
          console.warn(`⚠️ Accès refusé au message de statut pour guild ${guildId}; création d'un nouveau message désactivée.`);
          return;
        }

        if (!isUnknown) {
          console.warn(`⚠️ Erreur inattendue fetch monitor message pour guild ${guildId}; création annulée pour éviter duplication.`);
          return;
        }

        message = null;
        console.log(`[MONITOR-DBG] monitor message treated as unknown for guild=${guildId}; will attempt create`);
      }
    }

    if (message) {
      console.log(`[MONITOR-DBG] monitor message exists id=${message.id} for guild=${guildId}`);
      if (shouldUpdateMonitorMessage(guildId, newState)) {
        try {
          console.log(`[MONITOR-DBG] editing monitor message id=${message.id} for guild=${guildId}`);
          await message.edit({ embeds: [embed] });
          monitorMessageStates[guildId] = newState;
          console.log(`[MONITOR-DBG] edited monitor message id=${message.id} for guild=${guildId}`);
        } catch (editError) {
          console.error(`[MONITOR-DBG] message.edit failed for guild ${guildId} id=${message.id}:`, editError.stack || editError);
        }
      } else {
        console.log(`[MONITOR-DBG] shouldUpdateMonitorMessage returned false for guild=${guildId}; no edit performed`);
      }
    } else {
      try {
        console.log(`[MONITOR-DBG] creating monitor message in channel ${monitorChannelId} for guild=${guildId}`);
        message = await channel.send({ embeds: [embed] });
        console.log(`[MONITOR-DBG] created monitor message id=${message.id} for guild=${guildId}`);
        await updateGuildConfig(guildId, { monitor_channel_id: monitorChannelId, monitor_message_id: message.id, alert_channel_id: guildConfig.alertChannelId || undefined });
        monitorMessageStates[guildId] = newState;
      } catch (createError) {
        console.error(`[MONITOR-DBG] failed to create monitor message for guild ${guildId}:`, createError.stack || createError);
      }
    }
  } catch (error) {
    console.error(`❌ Erreur lors de la mise à jour du message de statut pour ${guildId}:`, error.message);
  }
}

async function checkInactivityForGuild(guildPlayers) {
  if (guildPlayers.length === 0) {
    return;
  }

  // Récupérer le seuil du serveur une fois au début (en heures, convertir en jours)
  const guildId = guildPlayers[0].guildId;
  const guildConfig = await getGuildConfig(guildId);
  const thresholdHours = guildConfig?.inactivityThreshold || parseInt(process.env.INACTIVITY_THRESHOLD) || 9;
  const thresholdDays = thresholdHours / 24;
  
  let alertsTriggered = 0;

  for (const player of guildPlayers) {
    try {
      // Log détaillé désactivé - voir résumé à la fin
      
      // 1. Scraper le profil
      const scrapResult = await scrapePactifyProfile(player.url);

      if (!scrapResult.success) {
        console.warn(`❌ Impossible de scraper ${player.playerName}: ${scrapResult.error}`);
        continue;
      }

      const currentStatus = scrapResult.status;
      const daysInactive = scrapResult.daysInactive;
      const previousStatus = player.playerStatus || 'inactive';
      
      // Log détaillé désactivé
      await updatePlayerCheckTime(player.id, daysInactive);

      // 🟢 DÉTECTION RECONNEXION: Si passe de "inactive" à "online"
      if (previousStatus === 'inactive' && currentStatus === 'online') {
        // Envoyer alerte de reconnexion (toujours envoyer pour notifier le retour)
        const reconnectionSent = await sendReconnectionAlert(player, daysInactive, thresholdDays);
        if (reconnectionSent) {
          alertsTriggered++;
        }
      }

      // Mettre à jour le statut du joueur
      await updatePlayerStatus(player.id, currentStatus);

      // Log détaillé désactivé

      // 2. Vérifier si >= seuil (seulement si inactif ET il n'a pas juste revenu en ligne)
      if (currentStatus === 'inactive' && daysInactive >= thresholdDays) {
        const lastCheckTime = await getLastAlertTime(player.id, 'inactive');
        const now = Math.floor(Date.now() / 1000);
        
        if (!lastCheckTime || (now - lastCheckTime) >= 21600) {
          const inactivitySent = await sendInactivityAlert(player, daysInactive, thresholdDays);
          if (inactivitySent) {
            alertsTriggered++;
          }
        }
      }
      
      if (currentStatus === 'inactive') {
        const lastAlertTime = await getLastAlertTime(player.id, 'inactive');
        if (lastAlertTime) {
          const hoursSinceAlert = (Math.floor(Date.now() / 1000) - lastAlertTime) / 3600;
          if (hoursSinceAlert >= 24 && daysInactive >= thresholdDays) {
            const reminderSent = await sendReminderAlert(player, daysInactive, thresholdDays);
            if (reminderSent) {
              alertsTriggered++;
            }
          }
        }
      }

      // 3. Vérifier rappel 24h (seulement si inactif)
    } catch (error) {
      console.error(`❌ Erreur cron pour ${player.playerName || player.username || player.discordId}:`, error);
    }
  }

  // Afficher un résumé concis
  return alertsTriggered;
}

async function sendReconnectionAlert(player, daysInactive, threshold) {
  const inactivityTime = formatInactivityTime(daysInactive);
  
  const lastReconnectionAlert = await getLastReconnectionAlertTime(player.id);
  const now = Math.floor(Date.now() / 1000);

  if (lastReconnectionAlert && now - lastReconnectionAlert < 86400) {
    const remaining = 86400 - (now - lastReconnectionAlert);
    return false;
  }

  try {
    const guildConfig = await getGuildConfig(player.guildId);
    const channelId = guildConfig?.alertChannelId;
    if (!channelId) {
      console.warn(`⚠️ Pas de channel d'alerte configuré pour le serveur ${player.guildId}. Ignorer l'alerte de reconnexion pour ${player.playerName}.`);
      return false;
    }

    const channel = await client.channels.fetch(channelId).catch((err) => {
      console.error(`❌ Erreur récupération channel ${channelId} pour guild ${player.guildId}:`, {
        code: err?.code,
        name: err?.name,
        message: err?.message,
        stack: err?.stack
      });
      return null;
    });
    if (!channel) {
      console.warn(`⚠️ Channel ${channelId} introuvable. Configure le serveur avec /config`);
      return false;
    }
    if (!channel.isTextBased()) {
      console.warn(`⚠️ Channel ${channelId} n'est pas un channel texte valide pour la reconnexion`);
      return false;
    }

    // Créer la progression bar
    const progressBar = createProgressBar(daysInactive, threshold);
    
    // Récupérer l'utilisateur Discord pour son avatar
    const user = await client.users.fetch(player.userId).catch(() => null);
    
    // Utiliser l'image du profil Pactify s'il existe, sinon avatar Discord
    const thumbnailUrl = player.playerImageUrl || user?.displayAvatarURL({ size: 256 }) || 'https://cdn-icons-png.flaticon.com/512/747/747376.png';
    
    // Barre visuelle améliorée (vert pour reconnexion)
    const percentage = Math.min((daysInactive / threshold) * 100, 100);
    const barFilled = Math.round(percentage / 5);
    const barEmpty = 20 - barFilled;
    const visualBar = '🟩'.repeat(barFilled) + '⬜'.repeat(barEmpty);

    const embed = new EmbedBuilder()
      .setColor(0x00d26a)
      .setTitle('✅ RECONNEXION DÉTECTÉE')
      .setDescription(`**${player.playerName}** est revenu en ligne après **${inactivityTime}** d'absence`)
      .setThumbnail(thumbnailUrl)
      .addFields(
        // ═══ INFOS JOUEUR ═══
        {
          name: '👤 JOUEUR',
          value: `\`${player.playerName}\``,
          inline: true
        },
        {
          name: '🎮 FACTION',
          value: player.playerFaction ? `\`${player.playerFaction}\`` : '`N/A`',
          inline: true
        },
        {
          name: '⏰ DURÉE D\'ABSENCE',
          value: `**${inactivityTime}**`,
          inline: true
        },
        // ═══ STATS ═══
        {
          name: '\u200b',
          value: '**━━━━ STATISTIQUES ━━━━**',
          inline: false
        },
        {
          name: '📈 PROGRESSION DE L\'ABSENCE',
          value: `${visualBar}\n\`${Math.round(percentage)}%\` — ${inactivityTime} / ${formatInactivityTime(threshold)}`,
          inline: false
        },
        // ═══ BIENVENUE ═══
        {
          name: '\u200b',
          value: '**━━━━ BIENVENUE ━━━━**',
          inline: false
        },
        {
          name: '🎉 RETOUR',
          value: `Joueur revenu après **${inactivityTime}** d'inactivité. Bienvenue!`,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: `Gorille™・BOTS | Retour • Seuil: ${formatInactivityTime(threshold)}`, iconURL: user?.displayAvatarURL({ size: 256 }) || 'https://discord.com/assets/default_user_avatar.png' });

    // Boutons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Voir le profil Pactify')
          .setStyle(ButtonStyle.Link)
          .setURL(player.url),
        new ButtonBuilder()
          .setLabel('Voir le profil Discord')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/users/${player.userId}`)
      );

    await channel.send({ content: `<@${player.userId}>`, embeds: [embed], components: [row] });

    // Créer un embed de bienvenue amélioré pour le DM et le channel
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x00d26a)
      .setTitle('✅ BIENVENUE DE RETOUR')
      .setDescription(`Nous sommes heureux de te voir de retour sur le serveur Pactify! 🎉`)
      .setThumbnail(thumbnailUrl)
      .addFields(
        {
          name: '👤 JOUEUR',
          value: `\`${player.playerName}\``,
          inline: true
        },
        {
          name: '🎮 FACTION',
          value: player.playerFaction ? `\`${player.playerFaction}\`` : '`N/A`',
          inline: true
        },
        {
          name: '⏰ DURÉE D\'ABSENCE',
          value: `**${inactivityTime}**`,
          inline: true
        },
        {
          name: '\u200b',
          value: '**━━━━ STATISTIQUES ━━━━**',
          inline: false
        },
        {
          name: '📈 PROGRESSION',
          value: `${visualBar}\n\`${Math.round(percentage)}%\` — ${inactivityTime} / ${formatInactivityTime(threshold)}`,
          inline: false
        },
        {
          name: '\u200b',
          value: '**━━━━ MESSAGE ━━━━**',
          inline: false
        },
        {
          name: '📢 BONNE CONTINUATION',
          value: `Nous avons hâte de te revoir en action! Continua ta progression! 💪`,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: `Gorille™・BOTS | Retour • Seuil: ${formatInactivityTime(threshold)}`, iconURL: user?.displayAvatarURL({ size: 256 }) || 'https://discord.com/assets/default_user_avatar.png' });

    // Envoyer l'embed de bienvenue dans le channel d'alerte
    await channel.send({ embeds: [welcomeEmbed] });

    // Envoyer aussi un message dans le channel de broadcast configuré (si présent)
    try {
      const broadcastChannelId = await getBroadcastChannel(player.guildId);
      if (broadcastChannelId) {
        const guild = client.guilds.cache.get(player.guildId);
        const broadcastChannel = guild?.channels.cache.get(broadcastChannelId) || null;
        if (broadcastChannel && broadcastChannel.isTextBased()) {
          // Envoyer le même embed (sans mention) dans le channel broadcast
          await broadcastChannel.send({ embeds: [welcomeEmbed] }).catch(() => null);
        }
      }
    } catch (bcErr) {
      console.warn(`⚠️ Erreur envoi broadcast reconnexion: ${bcErr?.message || bcErr}`);
    }

    // DM si activé
    if (guildConfig?.alertsViaDM) {
      try {
        const userToNotify = await client.users.fetch(player.userId);
        if (userToNotify) {
          await userToNotify.send({ embeds: [welcomeEmbed] });
        }
      } catch (dmError) {
        console.warn(`⚠️ Impossible d'envoyer un DM à ${player.playerName}: ${dmError.message}`);
      }
    }

    await updateLastReconnectionAlert(player.id);
    return true;
  } catch (error) {
    console.error(`❌ Erreur alerte reconnexion:`, {
      message: error?.message,
      stack: error?.stack
    });
    return false;
  }
}

async function sendInactivityAlert(player, daysInactive, threshold) {
  const inactivityTime = formatInactivityTime(daysInactive);

  const lastAlert = await getLastAlertTime(player.id, 'inactive');
  const now = Math.floor(Date.now() / 1000);

  // Éviter les alertes doublons (minimum 1h entre)
  if (lastAlert && now - lastAlert < 3600) {
    const remaining = 3600 - (now - lastAlert);
    return false;
  }

  try {
    const guildConfig = await getGuildConfig(player.guildId);
    const channelId = guildConfig?.alertChannelId;

    if (!channelId) {
      console.warn(`⚠️ Pas de channel d'alerte configuré pour le serveur ${player.guildId}. Ignorer l'alerte d'inactivité pour ${player.playerName}.`);
      return false;
    }

    const channel = await client.channels.fetch(channelId).catch((err) => {
      console.error('[ALERT] send failed', {
        'Discord code': err?.code,
        'HTTP status': err?.httpStatus || err?.status || 'unknown',
        'Discord message': err?.message,
        stack: err?.stack
      });
      return null;
    });

    if (!channel) {
      console.warn(`❌ Channel ${channelId} introuvable. Configure le serveur avec /config`);
      return false;
    }

    if (!channel.isTextBased()) {
      console.warn(`❌ Le channel ${channelId} n'est pas un channel texte valide pour ${player.playerName}`);
      return false;
    }

    // Créer la progression bar
    const progressBar = createProgressBar(daysInactive, threshold);

    // Récupérer l'utilisateur Discord pour son avatar
    const user = await client.users.fetch(player.userId).catch(() => null);

    // Utiliser l'image du profil Pactify s'il existe, sinon avatar Discord
    const thumbnailUrl = player.playerImageUrl || user?.displayAvatarURL({ size: 256 }) || 'https://cdn-icons-png.flaticon.com/512/747/747376.png';

    // Barre visuelle améliorée
    const percentage = Math.min((daysInactive / threshold) * 100, 100);
    const barFilled = Math.round(percentage / 5);
    const barEmpty = 20 - barFilled;
    const visualBar = '🟥'.repeat(barFilled) + '⬜'.repeat(barEmpty);
    
    // Couleur progressive selon le degré d'inactivité
    let alertColor = 0xff1744; // Rouge vif par défaut
    if (daysInactive >= threshold * 1.5) alertColor = 0xff0000; // Rouge plus foncé si vraiment inactif
    if (daysInactive >= threshold * 2) alertColor = 0x8b0000; // Marron foncé si très inactif

    const embed = new EmbedBuilder()
      .setColor(alertColor)
      .setTitle('🚨 ALERTE D\'INACTIVITÉ 🚨')
      .setDescription(`**${player.playerName}** a dépassé le seuil d'inactivité de **${formatInactivityTime(threshold)}**`)
      .setThumbnail(thumbnailUrl)
      .addFields(
        // ═══ INFOS JOUEUR ═══
        {
          name: '👤・JOUEUR',
          value: `\`${player.playerName}\``,
          inline: true
        },
        {
          name: '🎮・FACTION',
          value: player.playerFaction ? `\`${player.playerFaction}\`` : '`N/A`',
          inline: true
        },
        {
          name: '👑・RÔLE',
          value: player.playerRole ? `\`${player.playerRole}\`` : '`N/A`',
          inline: true
        },
        // ═══ STATUT D'INACTIVITÉ ═══
        {
          name: '\u200b',
          value: '**━━━━ STATUT D\'INACTIVITÉ ━━━━**',
          inline: false
        },
        {
          name: '⏱️・INACTIF DEPUIS',
          value: `**${inactivityTime}**`,
          inline: true
        },
        {
          name: '📊・SEUIL',
          value: `**${formatInactivityTime(threshold)}**`,
          inline: true
        },
        {
          name: '⚠️・DÉPASSEMENT',
          value: `**+${formatInactivityTime(daysInactive - threshold)}**`,
          inline: true
        },
        // ═══ PROGRESSION ═══
        {
          name: '\u200b',
          value: '**━━━━ PROGRESSION ━━━━**',
          inline: false
        },
        {
          name: '📈・PROGRESSION DE L\'INACTIVITÉ',
          value: `${visualBar}\n\`${Math.round(percentage)}%\` — ${inactivityTime} / ${formatInactivityTime(threshold)}`,
          inline: false
        },
        // ═══ ACTION REQUISE ═══
        {
          name: '\u200b',
          value: '**━━━━ ACTION REQUISE ━━━━**',
          inline: false
        },
        {
          name: '⚠️・NOTIFICATION',
          value: `Le joueur doit **se reconnecter au serveur Pactify** dès que possible.\n> Manquant depuis: **${inactivityTime}**`,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: `Gorille™・BOTS | Alerte Inactivité • Seuil: ${formatInactivityTime(threshold)}`, iconURL: user?.displayAvatarURL({ size: 256 }) || 'https://discord.com/assets/default_user_avatar.png' });

    const mention = `<@${player.userId}>`;
    
    // Boutons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Voir le profil Pactify')
          .setStyle(ButtonStyle.Link)
          .setURL(player.url),
        new ButtonBuilder()
          .setLabel('Voir le profil Discord')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/users/${player.userId}`)
      );

    const sentMessage = await channel.send({ content: mention, embeds: [embed], components: [row] }).catch((err) => {
      console.error('❌ Envoi d\'alerte d\'inactivité échoué', {
        'Discord code': err?.code,
        'HTTP status': err?.httpStatus || err?.status || 'unknown',
        'Discord message': err?.message,
        stack: err?.stack
      });
      return null;
    });

    if (!sentMessage) {
      console.warn(`❌ Envoi d'alerte échoué pour ${player.playerName} dans ${channelId}`);
      return false;
    }

    // Envoyer un DM si activé
    if (guildConfig?.alertsViaDM) {
      try {
        const userToNotify = await client.users.fetch(player.userId);
        if (userToNotify) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🔴 ALERTE D\'INACTIVITÉ')
            .setDescription('Tu as dépassé le seuil d\'inactivité sur ce serveur Pactify. Reconnecte-toi dès que possible pour éviter les conséquences.')
            .addFields(
              {
                name: '🔗 Compte',
                value: `\`${player.playerName}\``,
                inline: true
              },
              {
                name: '⏱️ Inactif depuis',
                value: `**${inactivityTime}**`,
                inline: true
              },
              {
                name: '📊 Seuil',
                value: `**${formatInactivityTime(threshold)}**`,
                inline: true
              },
              {
                name: '⚠️ Dépassement',
                value: `**+${formatInactivityTime(daysInactive - threshold)}**`,
                inline: true
              },
              {
                name: '📌 Action requise',
                value: 'Reconnecte-toi au serveur Pactify pour revenir dans la partie.',
                inline: false
              }
            )
            .setTimestamp()
            .setFooter({ text: 'Gorille™・BOTS | Alerte d\'inactivité', iconURL: user?.displayAvatarURL({ size: 256 }) || 'https://discord.com/assets/default_user_avatar.png' });

          await userToNotify.send({ embeds: [dmEmbed] });
        }
      } catch (dmError) {
        console.warn(`⚠️ Impossible d'envoyer un DM à ${player.playerName}: ${dmError.message}`);
      }
    }

    await updateAlertSentTime(player.id, 'inactive');
    return true;
  } catch (error) {
    console.error(`❌ Erreur envoi alerte pour ${player.playerName}:`, {
      message: error?.message,
      stack: error?.stack
    });
    return false;
  }
}


async function sendReminderAlert(player, daysInactive, threshold) {
  const inactivityTime = formatInactivityTime(daysInactive);
  
  const lastReminder = await getLastAlertTime(player.id, 'reminder');
  const now = Math.floor(Date.now() / 1000);

  // Éviter les rappels doublons (minimum 24h entre)
  if (lastReminder && now - lastReminder < 86400) {
    return false;
  }

  try {
    const guildConfig = await getGuildConfig(player.guildId);
    const channelId = guildConfig?.alertChannelId;
    if (!channelId) {
      console.warn(`⚠️ Pas de channel d'alerte configuré pour le serveur ${player.guildId}. Ignorer le rappel pour ${player.playerName}.`);
      return false;
    }

    const channel = await client.channels.fetch(channelId).catch((err) => {
      console.error('❌ Envoi échoué lors de la récupération du channel de rappel', {
        'Discord code': err?.code,
        'HTTP status': err?.httpStatus || err?.status || 'unknown',
        'Discord message': err?.message,
        stack: err?.stack
      });
      return null;
    });

    if (!channel) {
      console.warn(`❌ Channel ${channelId} introuvable pour rappel de ${player.playerName}.`);
      return false;
    }
    if (!channel.isTextBased()) {
      console.warn(`❌ Le channel ${channelId} n'est pas un channel texte valide pour rappel.`);
      return false;
    }

    // Créer la progression bar
    const progressBar = createProgressBar(daysInactive, threshold);

    // Récupérer l'utilisateur Discord pour son avatar
    const user = await client.users.fetch(player.userId).catch(() => null);

    // Utiliser l'image du profil Pactify s'il existe, sinon avatar Discord
    const thumbnailUrl = player.playerImageUrl || user?.displayAvatarURL({ size: 256 }) || 'https://cdn-icons-png.flaticon.com/512/747/747376.png';

    // Barre visuelle améliorée (orange pour rappel)
    const percentage = Math.min((daysInactive / threshold) * 100, 100);
    const barFilled = Math.round(percentage / 5);
    const barEmpty = 20 - barFilled;
    const visualBar = '🟧'.repeat(barFilled) + '⬜'.repeat(barEmpty);

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('⏰ RAPPEL D\'INACTIVITÉ - 24H ÉCOULÉES')
      .setDescription(`**${player.playerName}** est toujours inactif depuis **${inactivityTime}**`)
      .setThumbnail(thumbnailUrl)
      .addFields(
        // ═══ INFOS JOUEUR ═══
        {
          name: '👤 JOUEUR',
          value: `\`${player.playerName}\``,
          inline: true
        },
        {
          name: '🎮 FACTION',
          value: player.playerFaction ? `\`${player.playerFaction}\`` : '`N/A`',
          inline: true
        },
        {
          name: '⏰ DEPUIS',
          value: `**${inactivityTime}**`,
          inline: true
        },
        // ═══ STATUS ═══
        {
          name: '\u200b',
          value: '**━━━━ STATUT D\'INACTIVITÉ ━━━━**',
          inline: false
        },
        {
          name: '📊 SEUIL',
          value: `**${formatInactivityTime(threshold)}**`,
          inline: true
        },
        {
          name: '⚠️ DÉPASSEMENT',
          value: `**+${formatInactivityTime(daysInactive - threshold)}**`,
          inline: true
        },
        // ═══ PROGRESSION ═══
        {
          name: '\u200b',
          value: '**━━━━ PROGRESSION ━━━━**',
          inline: false
        },
        {
          name: '📈 PROGRESSION DE L\'INACTIVITÉ',
          value: `${visualBar}\n\`${Math.round(percentage)}%\` — ${inactivityTime} / ${formatInactivityTime(threshold)}`,
          inline: false
        },
        // ═══ ACTION ═══
        {
          name: '\u200b',
          value: '**━━━━ ACTION REQUISE ━━━━**',
          inline: false
        },
        {
          name: '📢 RAPPEL',
          value: `Le joueur est **toujours absent** après **${inactivityTime}**.\n> Veuillez vous reconnecter dès que possible!`,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Gorille™・BOTS | Rappel Inactivité', iconURL: user?.displayAvatarURL({ size: 256 }) || 'https://discord.com/assets/default_user_avatar.png' });

    const mention = `<@${player.userId}>`;
    
    // Boutons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Voir le profil Pactify')
          .setStyle(ButtonStyle.Link)
          .setURL(player.url),
        new ButtonBuilder()
          .setLabel('Voir le profil Discord')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/users/${player.userId}`)
      );

    const sentMessage = await channel.send({ content: mention, embeds: [embed], components: [row] }).catch((err) => {
      console.error('❌ Envoi du rappel d\'inactivité échoué', {
        'Discord code': err?.code,
        'HTTP status': err?.httpStatus || err?.status || 'unknown',
        'Discord message': err?.message,
        stack: err?.stack
      });
      return null;
    });

    if (!sentMessage) {
      console.warn(`❌ Envoi du rappel échoué pour ${player.playerName} dans ${channelId}`);
      return false;
    }

    // Envoyer un DM si activé
    if (guildConfig?.alertsViaDM) {
      try {
        const userToNotify = await client.users.fetch(player.userId);
        if (userToNotify) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('🟠 RAPPEL D\'INACTIVITÉ')
            .setDescription('Ton inactivité est toujours active sur ce serveur Pactify. Pense à te reconnecter dès que possible.')
            .addFields(
              {
                name: '🔗 Compte',
                value: `\`${player.playerName}\``,
                inline: true
              },
              {
                name: '⏱️ Inactif depuis',
                value: `**${inactivityTime}**`,
                inline: true
              },
              {
                name: '📊 Seuil',
                value: `**${formatInactivityTime(threshold)}**`,
                inline: true
              },
              {
                name: '⚠️ Dépassement',
                value: `**+${formatInactivityTime(daysInactive - threshold)}**`,
                inline: true
              },
              {
                name: '📌 Recommandation',
                value: 'Reconnecte-toi sur Pactify pour rétablir ton activité et éviter les pénalités.',
                inline: false
              }
            )
            .setTimestamp()
            .setFooter({ text: 'Gorille™・BOTS | Rappel d\'inactivité', iconURL: user?.displayAvatarURL({ size: 256 }) || 'https://discord.com/assets/default_user_avatar.png' });

          await userToNotify.send({ embeds: [dmEmbed] });
        }
      } catch (dmError) {
        console.warn(`⚠️ Impossible d'envoyer un DM à ${player.playerName}: ${dmError.message}`);
      }
    }

    await updateAlertSentTime(player.id, 'reminder');
    return true;
  } catch (error) {
    console.error(`❌ Erreur envoi rappel pour ${player.playerName}:`, {
      message: error?.message,
      stack: error?.stack
    });
    return false;
  }
}
