import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getPlayersByGuild } from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('listplayers')
  .setDescription('Liste tous les joueurs surveillés');

// Fonction helper pour créer une barre de progression
function createProgressBar(percentage, maxChars = 15) {
  const filled = Math.round((percentage / 100) * maxChars);
  const empty = maxChars - filled;
  if (percentage === 0) return '🟩'.repeat(maxChars);
  if (percentage >= 100) return '🟥'.repeat(maxChars);
  return '🟥'.repeat(filled) + '🟩'.repeat(empty);
}

export async function execute(interaction) {
  // Authorization handled centrally by GlobalCommandMiddleware
  
  try {
    const players = await getPlayersByGuild(interaction.guildId);
    
    if (players.length === 0) {
      return await interaction.editReply({
        content: '❌ Aucun joueur n\'est actuellement surveillé.\n\nUtilise `/addplayer` pour en ajouter un!'
      });
    }

    // Préparer les données
    const playersWithInactivity = players.map((player) => ({
      ...player,
      days_inactive: player.days_inactive || player.daysInactive || 0,
      status: player.status || player.playerStatus || 'unknown'
    }));

    const sortedPlayers = playersWithInactivity.sort((a, b) => (b.days_inactive || 0) - (a.days_inactive || 0));

    // Statistiques
    const onlinePlayers = sortedPlayers.filter(p => p.status === 'online' || p.playerStatus === 'online').length;
    const inactivePlayers = sortedPlayers.filter(p => p.status === 'inactive' || p.playerStatus === 'inactive').length;
    const avgInactivity = sortedPlayers.reduce((sum, p) => sum + (p.days_inactive || 0), 0) / sortedPlayers.length;

    // Déterminer couleur
    let embedColor = 0x2ecc71;
    if (onlinePlayers === 0 && inactivePlayers > 0) {
      embedColor = 0xe74c3c;
    } else if (onlinePlayers > 0 && inactivePlayers > 0) {
      embedColor = 0xf39c12;
    }

    // Créer la liste formatée
    let playersList = '';
    sortedPlayers.forEach((player, index) => {
      const displayName = player.playerName || player.username;
      const daysInactiveValue = player.days_inactive || player.daysInactive || 0;
      const days = Math.floor(daysInactiveValue);
      const hours = Math.round((daysInactiveValue % 1) * 24);
      
      // Log détaillé pour debug
      console.log(`[listplayers] ${displayName}: raw=${daysInactiveValue}, days=${days}, hours=${hours}`);
      
      let statusIcon = '❓';
      if (player.status === 'online' || player.playerStatus === 'online') {
        statusIcon = '🟢・';
      } else if (player.status === 'inactive' || player.playerStatus === 'inactive') {
        statusIcon = '🔴・';
      }

      let inactivityText = '';
      if ((player.status === 'online' || player.playerStatus === 'online') && daysInactiveValue < 0.5) {
        inactivityText = '✅・EN LIGNE';
      } else {
        inactivityText = `${days}j ${hours}h`;
      }

      // Barre de progression (sur 9 jours par défaut)
      const percentage = Math.min((daysInactiveValue / 9) * 100, 100);
      const bar = createProgressBar(percentage, 10);

      playersList += `${statusIcon} **${displayName}**: \`${inactivityText}\` ${bar}\n`;
    });

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('👥・JOUEURS SURVEILLES')
      .setDescription(`\n\n**📊・Statistiques:**\n🏆・Total: **${sortedPlayers.length}** joueur(s)\n🟢・En ligne: **${onlinePlayers}**   |   🔴・Inactif(s): **${inactivePlayers}**\n⏱️・Inactivité moyenne: **${avgInactivity.toFixed(1)}j**\n\n━━━━━━━━━━━━━━━━━━\n`)
      .addFields({
        name: '📋・__LISTE__',
        value: '_ _',
        inline: false
      })
      .addFields({
        name: '_ _',
        value: playersList || 'Aucun joueur',
        inline: false
      })
      .setTimestamp()
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur listplayers:', error);
    await interaction.editReply({
      content: '❌ Erreur lors de l\'affichage de la liste'
    });
  }
}

