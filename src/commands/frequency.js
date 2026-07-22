import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { updateCheckFrequency, getCheckFrequency, getPlayersByGuild } from '../utils/database.js';
import { updateGuildMonitorMessage } from '../cron/checkInactivity.js';

export const data = new SlashCommandBuilder()
  .setName('frequency')
  .setDescription('Configure la fréquence de vérification d\'inactivité')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Définir la fréquence de vérification (en minutes)')
      .addIntegerOption(option =>
        option
          .setName('minutes')
          .setDescription('Fréquence en minutes (min 1, max 1440)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1440)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('Afficher la fréquence actuelle de vérification')
  );

export async function execute(interaction) {
  // Vérification de permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.editReply({
      content: '❌・Vous devez être **administrateur** pour utiliser cette commande !'
    });
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'set') {
    try {
      const minutes = interaction.options.getInteger('minutes');
      
      await updateCheckFrequency(interaction.guildId, minutes);

      // Mettre à jour le message de statut en arrière-plan (sans bloquer la commande)
      (async () => {
        try {
          const players = await getPlayersByGuild(interaction.guildId);
          const playerCount = Array.isArray(players) ? players.length : 0;
          await updateGuildMonitorMessage(interaction.guildId, minutes, 0, playerCount);
        } catch (refreshError) {
          console.warn('⚠️ Impossible de mettre à jour le message de statut après /frequency set:', refreshError?.message || refreshError);
        }
      })();

      const embed = new EmbedBuilder()
        .setColor(0x32a852)
        .setAuthor({
          name: `${interaction.user.username} - Configuration`,
          iconURL: interaction.user.displayAvatarURL({ size: 256 })
        })
        .setTitle('⏱️・FRÉQUENCE DE VÉRIFICATION ・⏱️')
        .addFields({
          name: '✅・Mise à jour réussie',
          value: `La vérification d'inactivité s'effectuera maintenant **tous les ${minutes} minutes** sur ce serveur.\n\n_Note: La prochaine vérification aura lieu dans ${minutes} minutes maximum._`,
          inline: false
        })
        .setTimestamp()
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur frequency set:', error);
      await interaction.editReply({
        content: '❌・Erreur lors de la mise à jour de la fréquence'
      });
    }
  } else if (subcommand === 'view') {
    try {
      const frequency = await getCheckFrequency(interaction.guildId);

      let description = '';
      if (frequency < 60) {
        description = `Vérification toutes les __**${frequency} minutes**__ !`;
      } else if (frequency === 60) {
        description = `Vérification tous les **1 heure**`;
      } else {
        const hours = Math.floor(frequency / 60);
        const mins = frequency % 60;
        description = `Vérification **${hours}h${mins > 0 ? ` ${mins}min` : ''}**`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setAuthor({
          name: `${interaction.user.username} - Configuration`,
          iconURL: interaction.user.displayAvatarURL({ size: 256 })
        })
        .setTitle('⏱️・FRÉQUENCE DE VÉRIFICATION・⏱️')
        .setDescription(description)
        .addFields({
          name: '📋・__Détails__',
          value: `⏰・Fréquence: \`${frequency} minutes\`\n🎯・Serveur: \`${interaction.guild.name}\``,
          inline: false
        })
        .addFields({
          name: '💡・Pour modifier',
          value: `Utilise \`/frequency set <minutes>\``,
          inline: false
        })
        .setTimestamp()
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur frequency view:', error);
      await interaction.editReply({
        content: '❌ Erreur lors de la récupération de la fréquence'
      });
    }
  }
}

