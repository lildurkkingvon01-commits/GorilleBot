import { PermissionFlagsBits } from 'discord.js';
import { getPermissionsForCommand } from './database.js';

/**
 * Vérifie si un utilisateur a la permission d'utiliser une commande
 * Logique: Utilisateur autorisé > Rôle autorisé > Admin (par défaut)
 * @param {Interaction} interaction - L'interaction Discord
 * @param {string} commandName - Le nom de la commande
 * @returns {Promise<boolean>} - True si l'utilisateur a la permission
 */
export async function checkCommandPermission(interaction, commandName) {
  const guildId = interaction.guildId;
  const memberId = interaction.member.id;
  const member = interaction.member;

  // Si l'utilisateur est l'owner du serveur, il a toujours accès
  if (memberId === interaction.guild.ownerId) {
    return true;
  }

  // Récupérer les permissions (rôles + utilisateurs) pour cette commande
  const perms = await getPermissionsForCommand(guildId, commandName);

  // Si des permissions custom existent
  if (perms.users.length > 0 || perms.roles.length > 0) {
    // 1. Vérifier si c'est un utilisateur autorisé
    if (perms.users.includes(memberId)) {
      return true;
    }

    // 2. Vérifier si l'utilisateur a un rôle autorisé
    if (perms.roles.some(roleId => member.roles.cache.has(roleId))) {
      return true;
    }

    // Permissions custom existent mais l'utilisateur n'est pas dedans
    return false;
  }

  // Pas de permissions custom = par défaut Admin
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Template pour utiliser la vérification dans une commande
 * 
 * Usage dans une commande:
 * 
 * import { checkCommandPermission } from '../utils/checkPermissions.js';
 * 
 * export async function execute(interaction) {
 *   if (!await checkCommandPermission(interaction, 'addplayer')) {
 *     await interaction.reply({
 *       content: '❌ Tu n\'as pas la permission d\'utiliser cette commande!',
 *       ephemeral: true
 *     });
 *     return;
 *   }
 *   
 *   // Le reste du code...
 * }
 */
