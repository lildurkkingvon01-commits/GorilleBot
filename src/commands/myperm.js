import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPermissionsForCommand } from '../utils/database.js';

const ALL_COMMANDS = [
  'addplayer', 'removeplayer', 'listplayers', 'config', 'myconfig', 'seuil', 'frequency',
  'save', 'deletesave', 'savelist', 'fsave', 'fdeletesave', 'fsavelist',
  'info', 'history', 'f', 'serverstatus', 'dm', 'help', 'perms', 'myperm'
];

export const data = new SlashCommandBuilder()
  .setName('myperm')
  .setDescription('Voir les permissions de chaque commande');

export async function execute(interaction) {
  // Seul le créateur du serveur peut utiliser cette commande
  if (interaction.member.id !== interaction.guild.ownerId) {
    await interaction.editReply({
      content: '❌・Seul le créateur du serveur peut voir les permissions!',
      flags: 64
    });
    return;
  }

  const guildId = interaction.guildId;
  const guild = interaction.guild;

  // Créer les listes de commandes
  const adminCommands = [];
  const customCommands = [];

  for (const commandName of ALL_COMMANDS) {
    const perms = await getPermissionsForCommand(guildId, commandName);

    if (perms.users.length === 0 && perms.roles.length === 0) {
      // Aucune permission custom = par défaut Admin
      adminCommands.push(commandName);
    } else {
      // Custom permissions
      const items = [];
      
      // Ajouter les rôles
      for (const roleId of perms.roles) {
        items.push(`<@&${roleId}>`);
      }
      
      // Ajouter les utilisateurs
      for (const userId of perms.users) {
        items.push(`<@${userId}>`);
      }
      
      customCommands.push({
        name: commandName,
        perms: items.join(', ')
      });
    }
  }

  // Créer les embeds
  const embeds = [];

  // Embed principal: Toutes les commandes
  const mainEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🔐・GESTION DES PERMISSIONS')
    .setDescription(`> 📊 **${adminCommands.length + customCommands.length} commandes** configurées sur **${guild.name}**`)
    .setThumbnail(guild.iconURL({ size: 256 }));

  // Ajouter les commandes Admin
  if (adminCommands.length > 0) {
    mainEmbed.addFields({
      name: `👑・Par Défaut (Admin) • ${adminCommands.length}`,
      value: adminCommands.map(cmd => `┃ \`/${cmd}\` - 👑 Admin`).join('\n'),
      inline: false
    });
  }

  // Ajouter les commandes Custom
  if (customCommands.length > 0) {
    mainEmbed.addFields({
      name: `🔒・Personnalisées • ${customCommands.length}`,
      value: customCommands.map(cmd => `┃ \`/${cmd.name}\` → ${cmd.perms}`).join('\n'),
      inline: false
    });
  }

  mainEmbed.setFooter({ text: '✨・Créé par LeBelge_e | Gorille™・BOTS' });
  mainEmbed.setTimestamp();

  embeds.push(mainEmbed);

  const msg = await interaction.editReply({ embeds: embeds });
  
  // Supprimer le message après 30 secondes
  setTimeout(() => {
    msg.delete().catch(() => {});
  }, 30000);
}

