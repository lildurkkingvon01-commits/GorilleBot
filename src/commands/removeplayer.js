import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import { getPlayersByGuild, deletePlayerById } from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('removeplayer')
  .setDescription('Affiche les joueurs du serveur et supprime celui sélectionné');

export async function execute(interaction) {
  // Authorization handled centrally by GlobalCommandMiddleware

  try {
    // Récupérer UNIQUEMENT les joueurs de ce serveur
    const players = await getPlayersByGuild(interaction.guildId);

    if (players.length === 0) {
      return interaction.editReply({
        content: '❌・Aucun joueur à supprimer sur ce serveur. Utilise `/addplayer` pour en ajouter.'
      });
    }

    // Créer le menu de sélection avec les joueurs
    const options = players.map(player => {
      const displayName = player.playerName || player.username;
      return {
        label: displayName.substring(0, 100),
        value: player.id.toString(),
        description: `Supprimer ${displayName}`.substring(0, 100)
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`remove_player_${interaction.guildId}`)
      .setPlaceholder('Sélectionne un joueur à supprimer')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // Embed principal
    const mainEmbed = new EmbedBuilder()
      .setColor(0xffa500)
      .setAuthor({
        name: `${interaction.user.username} - Supprimer un joueur`,
        iconURL: interaction.user.displayAvatarURL({ size: 256 })
      })
      .setTitle('🗑️・SUPPRIMER UN JOUEUR・🗑️')
      .setDescription(`**${players.length} joueur(s)** - Sélectionne un joueur à supprimer`)
      .setTimestamp()
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

    const allEmbeds = [mainEmbed];
    
    await interaction.editReply({ embeds: allEmbeds, components: [row] });
  } catch (error) {
    console.error('Erreur removeplayer:', error);
    await interaction.editReply({
      content: '❌・Erreur lors de la récupération des joueurs'
    });
  }
}

