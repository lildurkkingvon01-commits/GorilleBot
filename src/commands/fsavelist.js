import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getAllSavedFactions } from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('fsavelist')
  .setDescription('Affiche la liste de toutes les factions sauvegardées');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const factions = await getAllSavedFactions();

    if (!factions || factions.length === 0) {
      return interaction.editReply({
        content: '❌・Aucune faction sauvegardée pour le moment!'
      });
    }

    // Paginer les factions (20 par page, 5 colonnes max)
    const itemsPerPage = 20;
    const totalPages = Math.ceil(factions.length / itemsPerPage);
    let currentPage = 0;

    const generateEmbed = (page) => {
      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const pageFactions = factions.slice(start, end);

      // Formater les factions en colonnes (5 colonnes max, 4 par colonne)
      const columns = [];
      for (let i = 0; i < pageFactions.length; i += 4) {
        const col = pageFactions.slice(i, i + 4);
        columns.push(col);
      }

      let description = '';
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const col = columns[colIdx];
        for (let rowIdx = 0; rowIdx < col.length; rowIdx++) {
          const faction = col[rowIdx];
          const number = start + colIdx * 4 + rowIdx + 1;
          description += `\`${number}.\` [${faction.factionName}](${faction.factionUrl})\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xff6b35)
        .setTitle('🏰・LISTE DES FACTIONS SAUVEGARDÉES')
        .setDescription(description || 'Aucune faction')
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ✨ Créé par LeBelge_e | Gorille™・BOTS | ${factions.length} faction(s)` })
        .setTimestamp();

      return embed;
    };

    const embed = generateEmbed(currentPage);

    // Créer les boutons de pagination
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('fsave_list_prev')
          .setLabel('◀️ Précédent')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('fsave_list_next')
          .setLabel('Suivant ▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === totalPages - 1)
      );

    const reply = await interaction.editReply({
      embeds: [embed],
      components: totalPages > 1 ? [buttons] : []
    });

    if (totalPages <= 1) return; // Pas besoin de collecteur si une seule page

    // Collector pour les boutons
    const collector = reply.createMessageComponentCollector({
      time: 5 * 60 * 1000 // 5 minutes
    });

    collector.on('collect', async (buttonInteraction) => {
      // Vérifier que c'est l'utilisateur qui a lancé la commande
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          content: '❌・Tu ne peux pas utiliser ces boutons!',
          ephemeral: true
        });
      }

      if (buttonInteraction.customId === 'fsave_list_prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (buttonInteraction.customId === 'fsave_list_next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      const newEmbed = generateEmbed(currentPage);
      const newButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('fsave_list_prev')
            .setLabel('◀️ Précédent')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId('fsave_list_next')
            .setLabel('Suivant ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages - 1)
        );

      await buttonInteraction.update({
        embeds: [newEmbed],
        components: [newButtons]
      });
    });

    collector.on('end', () => {
      const disabledButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('fsave_list_prev')
            .setLabel('◀️ Précédent')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('fsave_list_next')
            .setLabel('Suivant ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        );

      reply.edit({ components: [disabledButtons] }).catch(() => {});
    });

  } catch (error) {
    console.error('Erreur fsavelist:', error);
    await interaction.editReply({
      content: `❌・Erreur: ${error.message}`,
      ephemeral: true
    });
  }
}

