import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { deleteSavedPlayerUrl, getAllSavedPlayersGlobal } from '../utils/database.js';
import { updatePlayersCache } from './addplayer.js';

// Cache en mémoire pour l'autocomplete
let savedPlayersCache = [];

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

export async function updateSaveCache() {
  try {
    savedPlayersCache = await getAllSavedPlayersGlobal();
  } catch (error) {
    console.error('Erreur mise à jour cache saves:', error);
  }
}

// Mettre à jour le cache toutes les 30 secondes
setInterval(updateSaveCache, 30000);

export const data = new SlashCommandBuilder()
  .setName('deletesave')
  .setDescription('Supprime un joueur sauvegardé')
  .addStringOption(option =>
    option
      .setName('nom')
      .setDescription('Nom du joueur sauvegardé à supprimer')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction) {
  // Vérification: seul le propriétaire du bot peut supprimer
  if (interaction.user.id !== '492627367114702849') {
    return interaction.editReply({
      content: '❌ Seul le propriétaire du bot peut supprimer des joueurs sauvegardés!'
    });
  }

  const nom = interaction.options.getString('nom');

  try {
    // Supprimer le joueur sauvegardé
    await deleteSavedPlayerUrl(nom);

    // Mettre à jour les caches
    await updateSaveCache();
    await updatePlayersCache();

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🗑️・__JOUEUR SUPPRIMÉ__')
      .setDescription(`**${nom}** a été **supprimé** de la liste des joueurs sauvegardés.`)
      .addFields({
        name: '📋・Information',
        value: 'Ce joueur n\'est plus disponible pour les nouveaux ajouts sur les serveurs.',
        inline: false
      })
      .setTimestamp()
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

    await interaction.editReply({ embeds: [embed] });
    console.log(`🗑️  Joueur sauvegardé supprimé: ${nom}`);

  } catch (error) {
    console.error('Erreur deletesave:', error);
    await interaction.editReply({
      content: '❌ Erreur lors de la suppression'
    });
  }
}

export async function autocomplete(interaction) {
  try {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name !== 'nom') {
      return await interaction.respond([]);
    }

    // Filtrer par valeur saisie
    const value = (focusedOption.value || '').toLowerCase();
    const choices = savedPlayersCache
      .filter(p => p.playerName && p.playerName.toLowerCase().includes(value))
      .slice(0, 20)
      .map(p => {
        // Créer un affichage beau dans le name directement
        let display = p.playerName;
        
        if (p.playerPower) display += ` ⚡ ${p.playerPower}`;
        if (p.playerFaction) display += ` 🛡️ ${p.playerFaction}`;
        if (p.playerRole) display += ` 👑 ${p.playerRole}`;

        return {
          name: display.substring(0, 100), // Discord limite à 100 caractères
          value: p.playerName
        };
      });

    return await safeRespond(interaction, choices);
  } catch (error) {
    console.error('Autocomplete error deletesave:', error);
    try {
      return await safeRespond(interaction, []);
    } catch (e) {
      // Silencieusement ignorer
    }
  }
}

