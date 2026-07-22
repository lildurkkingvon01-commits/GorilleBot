import { EmbedBuilder } from 'discord.js';

/**
 * Crée un embed standardisé avec le logo et le style du bot
 * @param {Discord.Client} client - Le client Discord
 * @param {string} title - Titre de l'embed
 * @param {string} description - Description de l'embed
 * @param {number} color - Couleur (par défaut vert)
 * @param {boolean} addThumbnail - Ajouter la thumbnail du bot
 * @returns {EmbedBuilder} L'embed formaté
 */
export function createBotEmbed(client, title, description, color = 0x2ECC71, addThumbnail = true) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: '🤖 GORILLE™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTimestamp();

  if (addThumbnail) {
    embed.setThumbnail(client?.user?.displayAvatarURL({ size: 256 }));
  }

  return embed;
}

/**
 * Crée un embed de statut avec le logo du bot
 * @param {Discord.Client} client - Le client Discord
 * @param {string} statusType - Type de statut ('success', 'error', 'warning', 'info')
 * @param {string} title - Titre de l'embed
 * @param {string} message - Message de statut
 * @returns {EmbedBuilder} L'embed de statut formaté
 */
export function createStatusEmbed(client, statusType, title, message) {
  const statusConfig = {
    success: { color: 0x2ECC71, icon: '✅' },
    error: { color: 0xFF6B6B, icon: '❌' },
    warning: { color: 0xFFA500, icon: '⚠️' },
    info: { color: 0x3498DB, icon: 'ℹ️' }
  };

  const config = statusConfig[statusType] || statusConfig.info;

  return new EmbedBuilder()
    .setColor(config.color)
    .setAuthor({
      name: `${config.icon} ${title}`,
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setDescription(message)
    .setThumbnail(client?.user?.displayAvatarURL({ size: 256 }))
    .setFooter({
      text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTimestamp();
}

/**
 * Ajoute une section de séparation à un embed
 * @param {EmbedBuilder} embed - L'embed à modifier
 * @param {string} sectionTitle - Titre de la section
 * @param {string} emoji - Emoji pour la section
 * @returns {EmbedBuilder} L'embed modifié
 */
export function addSection(embed, sectionTitle, emoji = '━') {
  embed.addFields({
    name: `${emoji}━━━━━ ${sectionTitle} ${emoji}━━━━━`,
    value: ' ',
    inline: false
  });
  return embed;
}

/**
 * Coleurs prédéfinies du bot
 */
export const colors = {
  green: 0x2ECC71,    // Succès, principal
  blue: 0x3498DB,     // Info, commandes
  red: 0xFF6B6B,      // Erreur, attention
  gold: 0xD4AF37,     // Configuration
  orange: 0xFFA500,   // Warning, loading
  purple: 0x9B59B6,   // Broadcast, spécial
  gray: 0x95A5A6      // Secondaire
};
