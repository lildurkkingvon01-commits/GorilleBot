import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import OrphanLogService from '../services/orphanLogService.js';
import { getDb } from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('orphan')
  .setDescription('Gère les joueurs orphelins ou les tentatives d\'insertion sans guild')
  .addStringOption(opt =>
    opt
      .setName('action')
      .setDescription('Action à réaliser')
      .setRequired(true)
      .addChoices(
        { name: 'list', value: 'list' },
        { name: 'delete', value: 'delete' },
        { name: 'reassign', value: 'reassign' }
      )
  )
  .addStringOption(opt => opt.setName('target').setDescription('Pour reassign: id:NEWGUILD | pour delete: id'));

export async function execute(interaction) {
  const respond = async (options) => {
    if (interaction.deferred) return interaction.editReply(options);
    if (interaction.replied) return interaction.followUp(options);
    return interaction.reply(options);
  };

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return respond({ content: '❌ Administrateur requis', ephemeral: true });
  }

  const action = interaction.options.getString('action');
  const target = interaction.options.getString('target');

  if (action === 'list') {
    const rows = await OrphanLogService.list(100);
    const embed = new EmbedBuilder().setTitle('Tentatives d\'insertion sans guildId (récentes)');
    let desc = '';
    for (const r of rows) {
      desc += `• [${r.called_at}] ${r.source} — ${JSON.stringify(r.details)}\n`;
    }
    if (!desc) desc = 'Aucune tentative enregistrée.';
    embed.setDescription(desc.substring(0, 4000));
    return respond({ embeds: [embed], ephemeral: true });
  }

  if (action === 'delete') {
    if (!target) return respond({ content: 'Spécifie l\'id à supprimer dans target', ephemeral: true });
    const db = getDb();
    await db.none('DELETE FROM players WHERE id = $1', [Number(target)]);
    return respond({ content: `✅ Joueur id ${target} supprimé`, ephemeral: true });
  }

  if (action === 'reassign') {
    if (!target) return respond({ content: 'Spécifie la paire id:NEWGUILD dans target', ephemeral: true });
    const [id, newGuild] = target.split(':');
    if (!id || !newGuild) return respond({ content: 'Format attendu id:NEWGUILD', ephemeral: true });
    const db = getDb();
    await db.none('UPDATE players SET guild_id = $1 WHERE id = $2', [newGuild, Number(id)]);
    return respond({ content: `✅ Joueur id ${id} réaffecté à ${newGuild}`, ephemeral: true });
  }

  return respond({ content: 'Action non reconnue', ephemeral: true });
}
