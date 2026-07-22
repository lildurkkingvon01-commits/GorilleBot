import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { deleteSavedFactionUrl, getAllSavedFactions } from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('fdeletesave')
  .setDescription('Supprime une faction de la liste des sauvegardées (Owner only)')
  .addStringOption(option =>
    option
      .setName('nom')
      .setDescription('Nom de la faction à supprimer')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  // Vérification: seulement le propriétaire du bot
  if (interaction.user.id !== '492627367114702849') {
    return interaction.editReply({
      content: '❌・Seul le propriétaire du bot peut supprimer des factions!'
    });
  }

  const factionName = interaction.options.getString('nom');

  try {
    await deleteSavedFactionUrl(factionName);
    
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🗑️・__FACTION SUPPRIMÉE__')
      .setDescription(`**${factionName}** a été **supprimée** de la liste des factions sauvegardées.`)
      .addFields({
        name: '📋・Information',
        value: 'Cette faction n\'est plus disponible pour les nouveaux ajouts.',
        inline: false
      })
      .setTimestamp()
      .setFooter({
        text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
        iconURL: interaction.user.displayAvatarURL({ size: 256 })
      });

    await interaction.editReply({ embeds: [embed] });
    console.log(`🗑️・Faction supprimée: ${factionName}`);

  } catch (error) {
    console.error('Erreur fdeletesave:', error);
    await interaction.editReply({
      content: `❌・Erreur: ${error.message}`,
      ephemeral: true
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
  if (interaction.commandName !== 'fdeletesave') return;

  const focusedValue = interaction.options.getFocused();

  try {
    const factions = await getAllSavedFactions();
    
    const filtered = factions
      .filter(f => f.factionName.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25)
      .map(f => ({ name: f.factionName, value: f.factionName }));

    await safeRespond(interaction, filtered);
  } catch (error) {
    console.error('Erreur autocomplete fdeletesave:', error);
    await safeRespond(interaction, []);
  }
}

