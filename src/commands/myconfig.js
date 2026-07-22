import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuildConfig, deleteGuildConfig } from '../utils/guildConfig.js';
import { getCheckFrequency } from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('myconfig')
  .setDescription('Voir la configuration du serveur')
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('Affiche la configuration actuelle')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reset')
      .setDescription('Réinitialise la configuration')
  );

export async function execute(interaction) {
  // Vérification de permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.editReply({
      content: '❌・Vous devez être **administrateur** pour utiliser cette commande !'
    });
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'view') {
    try {
      const config = getGuildConfig(interaction.guildId);
      const frequency = await getCheckFrequency(interaction.guildId);
      
      console.log(`📋・[${interaction.guildId}] Config demandée:`, config);

      if (!config) {
        return await interaction.editReply({
          content: '⚠️・Aucune configuration définie pour ce serveur. Utilise `/config` pour en créer une.'
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setAuthor({
          name: `${interaction.user.username} - Configuration`,
          iconURL: interaction.user.displayAvatarURL({ size: 256 })
        })
        .setTitle('📊・CONFIGURATION ACTUELLE・📊')
        .setDescription(`*Voici les paramètres de* **${interaction.guild.name}** 🎯`)
        .addFields(
          {
            name: '📢・__Channel d\'alerte__',
            value: `<#${config.alertChannelId}>`,
            inline: true
          },
          {
            name: '📨・__Alertes DM__',
            value: config.alertsViaDM ? '\`✅・Activé\`' : '\`❌・Désactivé\`',
            inline: true
          },
          {
            name: '⏱️・__Seuil d\'inactivité__',
            value: `\`${(() => {
              const h = config.inactivityThreshold || 9;
              if (h >= 24) {
                const d = Math.floor(h / 24);
                const hh = h % 24;
                return hh > 0 ? `${d}j ${hh}h` : `${d}j`;
              }
              return `${h}h`;
            })()}\``,
            inline: true
          },
          {
            name: '�・__Channel de statut__',
            value: config.monitorChannelId ? `<#${config.monitorChannelId}>` : '`Aucun`',
            inline: true
          },
          {
            name: '�🕐・__Fréquence de vérification__',
            value: `\`${frequency} minutes\``,
            inline: true
          },
          {
            name: '📅・__Dernière mise à jour__',
            value: `<t:${Math.floor(config.updatedAt / 1000)}:f>`,
            inline: true
          },
          {
            name: '🖇️・__ID du serveur__',
            value: `\`${config.guildId}\``,
            inline: true
          },
          {
            name: '\n🔗・__Commandes utiles__',
            value: `\`/config\` - *Modifier la configuration*\n\`/seuil set\` - *Changer le seuil*\n\`/frequency set\` - *Fréquence*\n\`/addplayer\` - *Ajouter un joueur*`,
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur myconfig view:', error);
      await interaction.editReply({
        content: '❌ Erreur lors de la lecture de la configuration'
      });
    }
  } else if (subcommand === 'reset') {
    try {
      // DELETE HAPPENS AFTER deferReply, no timeout risk
      await deleteGuildConfig(interaction.guildId);

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🔄 **Configuration Réinitialisée** 🔄')
        .setDescription('\nLa configuration de ce serveur a été supprimée.\nUtilise `/config` pour en créer une nouvelle.\n')
        .setTimestamp()
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

      await interaction.editReply({ embeds: [embed] });
      console.log(`🔄・Configuration réinitialisée pour ${interaction.guild.name}`);
    } catch (error) {
      console.error('Erreur myconfig reset:', error);
      await interaction.editReply({
        content: '❌ Erreur lors de la réinitialisation'
      });
    }
  }
}

