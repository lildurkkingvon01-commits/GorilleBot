import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuildConfig as getFileGuildConfig, updateGuildThreshold } from '../utils/guildConfig.js';
import { getGuildConfig as getDbGuildConfig, updateGuildConfig } from '../utils/database.js';

// Parser pour convertir "1d", "5h", "1d 12h" en heures
function parseTimeToHours(timeStr) {
  const trimmed = timeStr.trim().toLowerCase();
  let totalHours = 0;
  
  // Regex pour trouver les patterns comme "1d" ou "12h"
  const matches = trimmed.match(/(\d+)\s*([dh])/g);
  
  if (!matches) {
    throw new Error('Format invalide. Utilisez "1d", "12h", "1d 12h", etc.');
  }
  
  for (const match of matches) {
    const num = parseInt(match.match(/\d+/)[0]);
    const unit = match.match(/[dh]/)[0];
    
    if (unit === 'd') {
      totalHours += num * 24;
    } else if (unit === 'h') {
      totalHours += num;
    }
  }
  
  if (totalHours < 1) {
    throw new Error('Le seuil doit être d\'au moins 1 heure');
  }
  
  if (totalHours > 30 * 24) {
    throw new Error('Le seuil ne peut pas dépasser 30 jours (720 heures)');
  }
  
  return totalHours;
}

// Convertir les heures en format lisible
function formatHours(hours) {
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (days > 0 && remainingHours > 0) {
    return `${days}j ${remainingHours}h`;
  } else if (days > 0) {
    return `${days} jour${days > 1 ? 's' : ''}`;
  } else {
    return `${hours} heure${hours > 1 ? 's' : ''}`;
  }
}

export const data = new SlashCommandBuilder()
  .setName('seuil')
  .setDescription('Configure le seuil d\'inactivité pour ce serveur')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Définir le seuil d\'inactivité')
      .addStringOption(option =>
        option
          .setName('temps')
          .setDescription('Format: "1d", "12h", "1d 12h", "3d", etc.')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('Voir le seuil actuel')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('check')
      .setDescription('Vérifier immédiatement tous les joueurs et envoyer des alertes si le seuil est dépassé')
  );

export async function execute(interaction) {
  // Authorization handled centrally by GlobalCommandMiddleware

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'set') {
    try {
      const tempsStr = interaction.options.getString('temps');
      const guildId = interaction.guildId;
      
      // Parser le format "1d", "5h", "1d 12h"
      let heures;
      try {
        heures = parseTimeToHours(tempsStr);
      } catch (parseErr) {
        return await interaction.editReply({
          content: `❌・${parseErr.message}`
        });
      }
      
      // Mettre à jour le seuil pour CE SERVEUR (en heures)
      await updateGuildThreshold(guildId, heures);
      await updateGuildConfig(guildId, { inactivity_threshold: heures });

      const formatted = formatHours(heures);
      
      const embed = new EmbedBuilder()
        .setColor(0x00d26a)
        .setAuthor({
          name: `${interaction.user.username} - Seuil`,
          iconURL: interaction.user.displayAvatarURL({ size: 256 })
        })
        .setTitle('✅・SEUIL MIS À JOUR・✅')
        .setDescription(`Le seuil d'inactivité a été **configuré avec succès** pour **${interaction.guild.name}** 🎯`)
        .addFields(
          {
            name: '⏱️・__Nouveau Seuil__',
            value: `\`${formatted} avant alerte\``,
            inline: true
          },
          {
            name: '📍・__Serveur__',
            value: `\`${interaction.guild.name}\``,
            inline: true
          },
          {
            name: '💡・__Détails__',
            value: `*À partir de maintenant, une alerte sera envoyée si un joueur est inactif pendant* **${formatted}** *ou plus sur* **ce serveur uniquement**.\n\n*Ce paramètre s'applique à tous les joueurs surveillés sur ce serveur.*`,
            inline: false
          },
          {
            name: '🔗・__Commandes utiles__',
            value: `\`/seuil view\` - *Voir le seuil actuel*\n\`/listplayers\` - *Voir la liste des joueurs*\n\`/myconfig view\` - *Voir toute la configuration*`,
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

      await interaction.editReply({ embeds: [embed] });
      console.log(`⚙️・Seuil du serveur ${interaction.guild.name} mis à jour: ${formatted} (${heures}h)`);
    } catch (error) {
      console.error('Erreur seuil set:', error);
      await interaction.editReply({
        content: '❌・Erreur lors de la mise à jour du seuil'
      });
    }
  } else if (subcommand === 'check') {
    try {
      const guildId = interaction.guildId;
      const fileConfig = getFileGuildConfig(guildId);
      const dbConfig = await getDbGuildConfig(guildId);
      const config = {
        ...fileConfig,
        ...dbConfig,
        alertChannelId: dbConfig.alert_channel_id || fileConfig.alertChannelId,
        inactivityThreshold: dbConfig.inactivity_threshold || fileConfig.inactivityThreshold
      };
      const alertChannelId = config?.alertChannelId;

      if (!alertChannelId) {
        return await interaction.editReply({
          content: '❌・Aucun channel d\'alerte n\'est configuré pour ce serveur. Utilisez `/config` pour définir un channel d\'alerte, puis réessayez.'
        });
      }

      await interaction.editReply({
        content: '⏳ Vérification démarrée en tâche de fond. Je reviens vers vous dès que possible.'
      });

      const { runManualInactivityCheck } = await import('../cron/checkInactivity.js');
      runManualInactivityCheck(guildId)
        .then(async (result) => {
          try {
            const seuilHours = config?.inactivityThreshold || 9;
            const seuilDisplay = (() => {
              if (seuilHours >= 24) {
                const days = Math.floor(seuilHours / 24);
                const hours = seuilHours % 24;
                return hours > 0 ? `${days}j ${hours}h` : `${days}j`;
              }
              return `${seuilHours}h`;
            })();

            const alertMessage = result.success
              ? result.alertsTriggered > 0
                ? `✅ Vérification terminée pour **${result.playersChecked}** joueur(s). **${result.alertsTriggered}** alerte(s) ont été envoyée(s) dans <#${alertChannelId}>.`
                : `✅ Vérification terminée pour **${result.playersChecked}** joueur(s). Aucun joueur n\'a dépassé le seuil de **${seuilDisplay}**.`
              : '❌・Aucun joueur n\'est actuellement surveillé sur ce serveur.';

            await interaction.followUp({
              content: alertMessage,
              ephemeral: true
            });
          } catch (followUpError) {
            console.error('Erreur suivi seuil check:', followUpError);
          }
        })
        .catch((backgroundError) => {
          console.error('Erreur asynchrone seuil check:', backgroundError);
        });

      return;
    } catch (error) {
      console.error('Erreur seuil check:', error);
      return await interaction.editReply({
        content: '❌・Erreur lors de la vérification du seuil. Veuillez réessayer plus tard.'
      });
    }
  } else if (subcommand === 'view') {
    try {
      const fileConfig = getFileGuildConfig(interaction.guildId);
      const dbConfig = await getDbGuildConfig(interaction.guildId);
      const config = {
        ...fileConfig,
        ...dbConfig,
        inactivityThreshold: dbConfig.inactivity_threshold || fileConfig.inactivityThreshold
      };
      const seuilHours = config?.inactivityThreshold || 9;
      
      const seuilDisplay = (() => {
        if (seuilHours >= 24) {
          const days = Math.floor(seuilHours / 24);
          const hours = seuilHours % 24;
          return hours > 0 ? `${days}j ${hours}h` : `${days}j`;
        }
        return `${seuilHours}h`;
      })();

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setAuthor({
          name: `${interaction.user.username} - Seuil`,
          iconURL: interaction.user.displayAvatarURL({ size: 256 })
        })
        .setTitle('⏱️・SEUIL D\'INACTIVITÉ・⏱️')
        .setDescription(`Voici le seuil d'inactivité configuré pour **${interaction.guild.name}** 🎯`)
        .addFields(
          {
            name: '⏱️・__Seuil Actuel__',
            value: `\`${seuilDisplay}\``,
            inline: true
          },
          {
            name: '📍・__Serveur__',
            value: `\`${interaction.guild.name}\``,
            inline: true
          },
          {
            name: '💡・__Signification__',
            value: `Un joueur recevra une **alerte 🔴** s'il est inactif pendant **${seuilDisplay}** ou plus.`,
            inline: false
          },
          {
            name: '🔧・__Modifier__',
            value: `\`/seuil set temps:<1d|5h|1d12h>\``,
            inline: true
          },
          {
            name: '📋・__Voir les joueurs__',
            value: `\`/listplayers\``,
            inline: true
          }
        )
        .setTimestamp()
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur seuil view:', error);
      await interaction.editReply({
        content: '❌・Erreur lors de la lecture du seuil'
      });
    }
  }
}

