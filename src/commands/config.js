import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import { setGuildConfig, setGuildDMAlert } from '../utils/guildConfig.js';
import { getPlayersByGuild, getCheckFrequency } from '../utils/database.js';
import { updateGuildMonitorMessage } from '../cron/checkInactivity.js';
import { createSuccessPreset, addSection, createField } from '../utils/embedPresets.js';

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
  // Vérification de permission (sécurité supplémentaire)
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
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

    // Vérifier qu'on a au moins un channel configuré
    if (!channel && !statusChannel) {
      return interaction.editReply({
        content: '❌ Tu dois choisir un channel d\'alerte ou un channel de statut !'
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
      monitorChannelId: statusChannel ? statusChannel.id : undefined
    });

    // Actualiser immédiatement le message de statut si un channel est défini
    if (statusChannel) {
      try {
        const players = await getPlayersByGuild(interaction.guildId);
        const playerCount = Array.isArray(players) ? players.length : 0;
        const frequency = await getCheckFrequency(interaction.guildId);
        await updateGuildMonitorMessage(interaction.guildId, frequency, 0, playerCount);
      } catch (err) {
        console.warn(`⚠️ Impossible d'initialiser le message de statut pour ${interaction.guildId}:`, err.message);
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

    const embed = createSuccessPreset(interaction.client, {
      title: '✅ Configuration Mise à Jour',
      description: `**${interaction.guild.name}** a été configuré avec succès! 🎯`,
      fields: [
        { name: '━━━━━ 📢 ALERTES 📢 ━━━━━', value: ' ', inline: false },
        { name: '📢・Channel d\'alerte', value: alertChannelDisplay, inline: true },
        { name: '📍・Channel de statut', value: statusChannelDisplay, inline: true },
        { name: '📨・Alertes DM', value: dmStatus, inline: true },
        { name: '🛡️・Serveur', value: `${interaction.guild.name}`, inline: true },
        { name: '━━━━━ 📝 DÉTAILS 📝 ━━━━━', value: ' ', inline: false },
        { name: '✅・Résumé', value: `${alertChannelDisplay !== '`Aucun`' ? `Les alertes d'inactivité seront envoyées dans ${alertChannelDisplay}\n` : ''}${statusChannelDisplay !== '`Aucun`' ? `Le message de statut sera affiché dans ${statusChannelDisplay}\n` : ''}${dmOption_value ? `Notifications DM des joueurs: ${dmStatus}` : 'Notifications DM: pas modifiées'}`, inline: false },
        { name: '🔗・Commandes Utiles', value: `\`/myconfig view\` - Voir toute la config\n\`/seuil set\` - Modifier le seuil d'inactivité\n\`/addplayer\` - Ajouter un joueur`, inline: false }
      ]
    });

    await interaction.editReply({ embeds: [embed] });
    console.log(`✅ Configuration sauvegardée pour le serveur ${interaction.guild.name} (${interaction.guildId})`);
  } catch (error) {
    console.error('Erreur config:', error);
    await interaction.editReply({
      content: '❌ Erreur lors de la configuration'
    });
  }
}

