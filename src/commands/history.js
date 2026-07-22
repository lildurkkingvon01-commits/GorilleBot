import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPlayerHistoryByName, getAllSavedPlayersGlobal } from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription('Affiche l\'historique d\'inactivité d\'un joueur surveillé')
  .addStringOption(option =>
    option
      .setName('joueur')
      .setDescription('Nom du joueur sauvegardé')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction) {
  const playerName = interaction.options.getString('joueur');

  try {
    // Chercher le joueur sauvegardé avec ses infos d'historique
    const savedPlayer = await getPlayerHistoryByName(playerName);

    if (!savedPlayer) {
      return interaction.editReply({
        content: `❌・Le joueur **${playerName}** n'a pas été trouvé dans les joueurs surveillés.`
      });
    }

    // Calculer l'ajout timestamp
    const addedDate = new Date(savedPlayer.addedAt * 1000);
    const now = new Date();
    const timeWatched = now - addedDate;
    const daysSaved = Math.floor(timeWatched / (1000 * 60 * 60 * 24));
    const hoursSaved = Math.floor((timeWatched % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    // Couleur et époque
    const colorByStatus = {
      'online': 0x00d26a,
      'inactive': 0xff1744,
      'unknown': 0xffa500
    };

    const statusEmoji = {
      'online': '🟢',
      'inactive': '🔴',
      'unknown': '🟠'
    };

    const powerNum = parseInt(savedPlayer.playerPower) || 0;
    const statusColor = colorByStatus[savedPlayer.playerStatus] || 0x3498db;
    const statusIcon = statusEmoji[savedPlayer.playerStatus] || '❓';

    const embed = new EmbedBuilder()
      .setColor(statusColor)
      .setAuthor({
        name: playerName,
        iconURL: savedPlayer.playerImageUrl || 'https://cdn-icons-png.flaticon.com/512/747/747376.png'
      })
      .setImage(savedPlayer.playerImageUrl || 'https://cdn-icons-png.flaticon.com/512/747/747376.png')
      .setTitle(`${statusIcon}・HISTORIQUE DE ${playerName}`)
      .addFields(
        {
          name: '👤・JOUEUR',
          value: `\`${savedPlayer.playerName || playerName}\``,
          inline: true
        },
        {
          name: '🛡️・FACTION',
          value: `\`${savedPlayer.playerFaction || 'N/A'}\``,
          inline: true
        },
        {
          name: '⚡・POWER',
          value: `\`${
            powerNum >= 1000000 
              ? (powerNum / 1000000).toFixed(1) + 'M' 
              : powerNum >= 1000 
                ? (powerNum / 1000).toFixed(1) + 'K' 
                : powerNum
          }\``,
          inline: true
        },
        {
          name: '📍・STATUT ACTUEL',
          value: `${statusIcon} \`${savedPlayer.playerStatus === 'online' ? 'EN LIGNE' : savedPlayer.playerStatus === 'inactive' ? 'INACTIF' : 'INCONNU'}\``,
          inline: true
        },
        {
          name: '⏱️・INACTIVITÉ',
          value: `\`${savedPlayer.daysInactive ? savedPlayer.daysInactive.toFixed(1) : '0'} jours\``,
          inline: true
        },
        {
          name: '🎯・RÔLE',
          value: `\`${savedPlayer.playerRole || 'N/A'}\``,
          inline: true
        },
        {
          name: '\n📊・SURVEILLANCE DEPUIS',
          value: `\`${daysSaved}j ${hoursSaved}h\``,
          inline: true
        },
        {
          name: '📅・DATE D\'AJOUT',
          value: `<t:${Math.floor(addedDate.getTime() / 1000)}:f>`,
          inline: true
        },
        {
          name: '🔄・DERNIER CHECK',
          value: savedPlayer.lastChecked 
            ? `<t:${savedPlayer.lastChecked}:R>`
            : '`Jamais`',
          inline: true
        }
      )
      .setDescription(
        `**Historique du joueur Pactify**\n\n` +
        `• **Enregistré**: ${addedDate.toLocaleDateString('fr-FR')}\n` +
        `• **Statut**: ${statusIcon} ${savedPlayer.playerStatus === 'online' ? 'Actuellement en ligne' : `Inactif depuis ${savedPlayer.daysInactive?.toFixed(1) || '?'} jours`}\n` +
        `• **Suivi**: Depuis ${daysSaved} jours`
      )
      .setTimestamp()
      .setFooter({
        text: '✨ Créé par LeBelge_e | Gorille™・BOTS | Historique Joueur',
        iconURL: interaction.user.displayAvatarURL({ size: 256 })
      });

    // Créer bouton pour voir profil
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('🔗 Voir Profil Pactify')
          .setURL(savedPlayer.playerUrl)
          .setStyle(ButtonStyle.Link)
      );

    await interaction.editReply({ 
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('❌・Erreur history:', error);
    await interaction.editReply({
      content: '❌・Erreur lors de la récupération de l\'historique du joueur'
    });
  }
}

function isExpiredInteractionError(error) {
  return error?.code === 10062 || error?.status === 404 || error?.message?.includes('Unknown interaction');
}

async function safeRespond(interaction, payload) {
  try {
    await interaction.respond(payload);
    return true;
  } catch (error) {
    if (isExpiredInteractionError(error)) {
      return false;
    }
    throw error;
  }
}

export async function autocomplete(interaction) {
  try {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name !== 'joueur') {
      return await safeRespond(interaction, []);
    }

    const value = (focusedOption.value || '').toLowerCase();
    const allPlayers = await getAllSavedPlayersGlobal();
    
    const choices = allPlayers
      .filter(p => p.playerName && p.playerName.toLowerCase().includes(value))
      .slice(0, 20)
      .map(p => ({
        name: p.playerName,
        value: p.playerName
      }));

    return await safeRespond(interaction, choices);
  } catch (error) {
    console.error('Autocomplete error history:', error);
    try {
      return await safeRespond(interaction, []);
    } catch (e) {
      // Ignorer silencieusement
    }
  }
}

