import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import { setGuildConfig, setGuildDMAlert } from '../utils/guildConfig.js';
import { getPlayersByGuild, getCheckFrequency, updateGuildConfig } from '../utils/database.js';
import { updateGuildMonitorMessage } from '../cron/checkInactivity.js';
import { createSuccessPreset, addSection, createField } from '../utils/embedPresets.js';
import GlobalCommandMiddleware from '../middleware/globalMiddleware.js';

function isBotOwner(userId) {
  return GlobalCommandMiddleware.OWNER_IDS.includes(userId);
}

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configure le channel d\'alerte pour ce serveur')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Le channel où envoyer les alertes d\'inactivité (dropdown)')
      .setRequired(false)
  )
  .addChannelOption(option =>
    option
      .setName('statuschannel')
      .setDescription('Le channel où afficher le message d\'état et le temps avant le prochain check')
      .setRequired(false)
  )
  .addChannelOption(option =>
    option
      .setName('summarychannel')
      .setDescription('Le channel où envoyer le résumé des vérifications automatiques')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('channelid')
      .setDescription('ID du channel si tu le trouves pas dans le dropdown')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('dm')
      .setDescription('Envoyer aussi les alertes en DM aux joueurs ?')
      .setRequired(false)
      .addChoices(
        { name: 'Activer (on)', value: 'on' },
        { name: 'Désactiver (off)', value: 'off' }
      )
  );

export async function execute(interaction) {
  console.log('[CONFIG] execute()');
  let _config_subcommand = undefined;
  try {
    _config_subcommand = interaction.options.getSubcommand();
    console.log('[CONFIG] subcommand =', _config_subcommand);
  } catch (e) {
    console.log('[CONFIG] getSubcommand() threw:', e && e.message ? e.message : e);
  }

  // Vérification de permission (sécurité supplémentaire)
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !isBotOwner(interaction.user.id)) {
    return interaction.editReply({
      content: '❌ Vous devez être **administrateur** pour utiliser cette commande !'
    });
  }

  try {
    let channel = null;
    const channelId = interaction.options.getString('channelid');

    // Essayer de récupérer depuis le dropdown d'abord (avec false pour pas d'erreur si absent)
    if (interaction.options.getChannel) {
      try {
        channel = interaction.options.getChannel('channel', false);
      } catch (e) {
        // Rien à faire, channel reste null
      }
    }

    // Si pas de dropdown, essayer l'ID manuel pour le channel d'alerte
    if (!channel && channelId) {
      try {
        channel = await interaction.guild.channels.fetch(channelId);
      } catch (error) {
        return interaction.editReply({
          content: `❌ Je n'arrive pas à trouver le channel avec l'ID: \`${channelId}\`\n\nVérifie que l'ID est correct et que le bot a accès à ce channel.`
        });
      }
    }

    const statusChannel = interaction.options.getChannel('statuschannel', false);
    const summaryChannel = interaction.options.getChannel('summarychannel', false);

    // Vérifier qu'on a au moins un channel configuré
    if (!channel && !statusChannel && !summaryChannel) {
      return interaction.editReply({
        content: '❌ Tu dois choisir un channel d\'alerte, de statut ou de résumé !'
      });
    }

    // Vérifier que les channels sont des canaux texte
    if (channel && channel.type !== ChannelType.GuildText) {
      return interaction.editReply({
        content: '❌ Le channel d\'alerte n\'est pas un canal texte! Sélectionne un canal #text.'
      });
    }

    if (statusChannel && statusChannel.type !== ChannelType.GuildText) {
      return interaction.editReply({
        content: '❌ Le channel de statut n\'est pas un canal texte! Sélectionne un canal #text.'
      });
    }
    if (summaryChannel && summaryChannel.type !== ChannelType.GuildText) {
      return interaction.editReply({
        content: '❌ Le channel de résumé n\'est pas un canal texte! Sélectionne un canal #text.'
      });
    }

    // Vérifier que le bot a les permissions
    if (channel && !channel.permissionsFor(interaction.guild.members.me).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])) {
      return interaction.editReply({
        content: `❌ Je n'ai pas les permissions pour envoyer des messages dans <#${channel.id}>!\n\nDonne-moi les permissions: \`Voir le salon\` et \`Envoyer des messages\``
      });
    }

    if (statusChannel && !statusChannel.permissionsFor(interaction.guild.members.me).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])) {
      return interaction.editReply({
        content: `❌ Je n'ai pas les permissions pour envoyer des messages dans <#${statusChannel.id}>!\n\nDonne-moi les permissions: \`Voir le salon\` et \`Envoyer des messages\``
      });
    }

    // Sauvegarder la configuration du serveur
    const alertChannelId = channel ? channel.id : undefined;
    const savedConfig = await setGuildConfig(interaction.guildId, alertChannelId, {
      monitorChannelId: statusChannel ? statusChannel.id : undefined,
      summaryChannelId: summaryChannel ? summaryChannel.id : undefined
    });

    try {
      await updateGuildConfig(interaction.guildId, {
        alert_channel_id: alertChannelId,
        monitor_channel_id: statusChannel ? statusChannel.id : undefined,
        summary_channel_id: summaryChannel ? summaryChannel.id : undefined
      });
    } catch (err) {
      console.warn(`[CONFIG] Impossible de synchroniser la config du serveur ${interaction.guildId} en base:`, err.message || err);
    }

    // Actualiser immédiatement le message de statut si un channel est défini
    if (statusChannel) {
      console.log('[STATUS] STEP 1 - entered statuschannel block');
      console.log('[STATUS] STEP 2 - deferred/replied state', { deferred: interaction.deferred, replied: interaction.replied });
      if (!interaction.deferred && !interaction.replied) {
        console.log('[STATUS] STEP 2a - calling interaction.deferReply()');
        await interaction.deferReply();
        console.log('[STATUS] STEP 2b - interaction.deferReply() completed');
      } else {
        console.log('[STATUS] STEP 2a - no deferReply needed');
      }
      console.log('[CONFIG] entered statuschannel');
      try {
        const players = await getPlayersByGuild(interaction.guildId);
        const playerCount = Array.isArray(players) ? players.length : 0;
        console.log('[STATUS] STEP 3 - config values computed', { playerCount, statusChannelId: statusChannel.id, monitorChannelId: statusChannel.id });
        const frequency = await getCheckFrequency(interaction.guildId);
        console.log('[STATUS] STEP 4 - before updateGuildMonitorMessage', { frequency });
        await updateGuildMonitorMessage(interaction.guildId, frequency, 0, playerCount);
        console.log('[STATUS] STEP 4b - after updateGuildMonitorMessage');
      } catch (err) {
        console.error('[CONFIG][STATUSCHANNEL]', err);
      }
    }

    // Gérer l'option DM si fournie
    const dmOption = interaction.options.getString('dm');
    if (dmOption) {
      const dmEnabled = dmOption === 'on';
      await setGuildDMAlert(interaction.guildId, dmEnabled);
    }

    const dmOption_value = interaction.options.getString('dm');
    const dmStatus = !dmOption_value ? '(inchangé)' : dmOption_value === 'on' ? '✅ Activé' : '❌ Désactivé';
    const alertChannelDisplay = channel ? `<#${channel.id}>` : (savedConfig.alertChannelId ? `<#${savedConfig.alertChannelId}>` : '`Aucun`');
    const statusChannelDisplay = statusChannel ? `<#${statusChannel.id}>` : (savedConfig.monitorChannelId ? `<#${savedConfig.monitorChannelId}>` : '`Aucun`');
    const summaryChannelDisplay = summaryChannel ? `<#${summaryChannel.id}>` : (savedConfig.summaryChannelId ? `<#${savedConfig.summaryChannelId}>` : '`Aucun`');

    const embed = createSuccessPreset(interaction.client, {
      title: '✅ Configuration Mise à Jour',
      description: `**${interaction.guild.name}** a été configuré avec succès! 🎯`,
      fields: [
        { name: '━━━━━ 📢 ALERTES 📢 ━━━━━', value: ' ', inline: false },
        { name: '📢・Channel d\'alerte', value: alertChannelDisplay, inline: true },
        { name: '📍・Channel de statut', value: statusChannelDisplay, inline: true },
        { name: '�・Channel de résumé', value: summaryChannelDisplay, inline: true },
        { name: '�📨・Alertes DM', value: dmStatus, inline: true },
        { name: '🛡️・Serveur', value: `${interaction.guild.name}`, inline: true },
        { name: '━━━━━ 📝 DÉTAILS 📝 ━━━━━', value: ' ', inline: false },
        { name: '✅・Résumé', value: `${alertChannelDisplay !== '`Aucun`' ? `Les alertes d'inactivité seront envoyées dans ${alertChannelDisplay}\n` : ''}${statusChannelDisplay !== '`Aucun`' ? `Le message de statut sera affiché dans ${statusChannelDisplay}\n` : ''}${dmOption_value ? `Notifications DM des joueurs: ${dmStatus}` : 'Notifications DM: pas modifiées'}`, inline: false },
        { name: '🔗・Commandes Utiles', value: `\`/myconfig view\` - Voir toute la config\n\`/seuil set\` - Modifier le seuil d'inactivité\n\`/addplayer\` - Ajouter un joueur`, inline: false }
      ]
    });

    await interaction.editReply({ embeds: [embed] });
    console.log('[STATUS] STEP 5 - editReply completed');
    console.log(`✅ Configuration sauvegardée pour le serveur ${interaction.guild.name} (${interaction.guildId})`);
  } catch (error) {
    console.error('Erreur config:', error);
    console.log('[STATUS] STEP ERROR - caught exception in config execute', { name: error.name, message: error.message, stack: error.stack });
    await interaction.editReply({
      content: '❌ Erreur lors de la configuration'
    });
  }
}

