import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getAllSavedPlayers } from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('savelist')
  .setDescription('Affiche la liste de tous les joueurs enregistrés');

const PLAYERS_PER_PAGE = 20; // Plus de joueurs par page

function createEmbed(players, currentPage, totalPages, userId) {
  const startIdx = currentPage * PLAYERS_PER_PAGE;
  const endIdx = Math.min(startIdx + PLAYERS_PER_PAGE, players.length);
  const pagePlayersCount = endIdx - startIdx;
  
  // Diviser les joueurs en colonnes (5 par colonne)
  const playersOnPage = players.slice(startIdx, endIdx);
  const fields = [];
  
  // Créer 4 colonnes max par page
  const columnsCount = Math.min(4, Math.ceil(pagePlayersCount / 5));
  const playersPerColumn = Math.ceil(playersOnPage.length / columnsCount);
  
  for (let col = 0; col < columnsCount; col++) {
    const columnStart = col * playersPerColumn;
    const columnEnd = Math.min(columnStart + playersPerColumn, playersOnPage.length);
    const columnPlayers = playersOnPage.slice(columnStart, columnEnd);
    
    let columnText = '';
    columnPlayers.forEach((player, idx) => {
      const globalIndex = startIdx + columnStart + idx + 1;
      
      columnText += `${globalIndex}. [${player.playerName}](${player.playerUrl})\n`;
    });
    
    fields.push({
      name: `▸ Colonne ${col + 1}`,
      value: columnText || 'Vide',
      inline: true
    });
  }
  
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('📋・__LISTE DES JOUEURS ENREGISTRÉS__')
    .setDescription(`**${players.length}** joueur(s) au total`)
    .addFields(...fields)
    .setFooter({ 
      text: `Page ${currentPage + 1}/${totalPages} | ✨ Créé par LeBelge_e | Gorille™・BOTS`, 
      iconURL: userId 
    });
  
  return embed;
}

export async function execute(interaction) {
  // Vérification de permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.followUp({
      content: '❌・Vous devez être **administrateur** pour utiliser cette commande !'
    });
  }

  try {
    // Récupérer les données
    const savedPlayers = await getAllSavedPlayers();

    if (savedPlayers.length === 0) {
      return interaction.editReply({
        content: '❌・Aucun joueur n\'est actuellement enregistré.\n\nUtilise `/save <url> <nom>` pour en ajouter!'
      });
    }

    const totalPages = Math.ceil(savedPlayers.length / PLAYERS_PER_PAGE);
    let currentPage = 0;

    // Créer l'embed initial
    const embed = createEmbed(savedPlayers, currentPage, totalPages, interaction.user.displayAvatarURL({ size: 256 }));

    // Créer les boutons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`savelist_prev_${interaction.user.id}`)
          .setLabel('◀️ Précédent')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`savelist_next_${interaction.user.id}`)
          .setLabel('Suivant ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === totalPages - 1)
      );

    const message = await interaction.editReply({ 
      embeds: [embed],
      components: totalPages > 1 ? [row] : []
    });

    if (totalPages <= 1) return;

    // Gérer les interactions de boutons
    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 5 * 60 * 1000 // 5 minutes
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId.includes('prev')) {
        currentPage = Math.max(0, currentPage - 1);
      } else if (buttonInteraction.customId.includes('next')) {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      const newEmbed = createEmbed(savedPlayers, currentPage, totalPages, interaction.user.displayAvatarURL({ size: 256 }));
      const newRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`savelist_prev_${interaction.user.id}`)
            .setLabel('◀️ Précédent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId(`savelist_next_${interaction.user.id}`)
            .setLabel('Suivant ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages - 1)
        );

      await buttonInteraction.update({
        embeds: [newEmbed],
        components: [newRow]
      });
    });

    collector.on('end', () => {
      // Désactiver les boutons après 5 minutes
      const disabledRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`savelist_prev_${interaction.user.id}`)
            .setLabel('◀️ Précédent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`savelist_next_${interaction.user.id}`)
            .setLabel('Suivant ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      
      message.edit({ components: [disabledRow] }).catch(() => {});
    });

  } catch (error) {
    console.error('Erreur savelist:', error);
    await interaction.editReply({
      content: '❌・Erreur lors de la récupération de la liste'
    });
  }
}

