import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import BypassService from '../services/bypassService.js';

export const data = new SlashCommandBuilder()
  .setName('bypass')
  .setDescription('Gérer la liste bypass (seul le créateur du bot)');

const OWNER_ID = process.env.OWNER_ID || process.env.OWNER_IDS?.split(',')[0] || '492627367114702849';

export async function execute(interaction) {
  const respond = async (options) => {
    try {
      if (interaction.deferred) return await interaction.editReply(options);
      if (interaction.replied) return await interaction.followUp(options);
      return await interaction.reply(options);
    } catch (err) {
      if (err && err.code === 'InteractionAlreadyReplied') {
        try { return await interaction.followUp(options); } catch (e) { return null; }
      }
      return null;
    }
  };

  // Only owner can open the bypass UI
  if (interaction.user.id !== OWNER_ID) {
    return respond({ content: '❌ Seul le créateur du bot peut utiliser cette commande.', ephemeral: true });
  }

  // Even if someone is bypassed, they cannot use /bypass (only owner)

  // Build main menu embed with Add / Remove / List buttons
  const embed = new EmbedBuilder()
    .setTitle('Gestion Bypass')
    .setDescription('Utilise les boutons ci-dessous pour **Add**, **Remove** ou **List** les utilisateurs bypass.\n\n• Add: ouvre un formulaire (mention ou id) + note (obligatoire)\n• Remove: ouvre un formulaire (mention ou id)\n• List: affiche la liste paginée')
    .setColor(0x5865F2);

  const addBtn = new ButtonBuilder().setCustomId('bypass_menu_add').setLabel('Add').setStyle(ButtonStyle.Success);
  const removeBtn = new ButtonBuilder().setCustomId('bypass_menu_remove').setLabel('Remove').setStyle(ButtonStyle.Danger);
  const listBtn = new ButtonBuilder().setCustomId('bypass_menu_list').setLabel('List').setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(addBtn, removeBtn, listBtn);

  return respond({ embeds: [embed], components: [row], ephemeral: true });
}
