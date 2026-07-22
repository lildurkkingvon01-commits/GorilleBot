import { EmbedBuilder } from 'discord.js';

/**
 * PRESETS D'EMBEDS PROFESSIONNELS POUR GORILLE™ BOTS
 */

/**
 * Preset SUCCESS - Confirmation d'action réussie
 */
export function createSuccessPreset(client, options = {}) {
  const {
    title = 'Succès',
    description = 'L\'action a été complétée avec succès!',
    fields = [],
    addThumbnail = true
  } = options;

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71) // Vert
    .setAuthor({
      name: '✅ GORILLE™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTitle(title)
    .setDescription(description);

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (addThumbnail) {
    embed.setThumbnail(client?.user?.displayAvatarURL({ size: 256 }));
  }

  embed
    .setFooter({
      text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTimestamp();

  return embed;
}

/**
 * Preset ERROR - Erreur ou problème
 */
export function createErrorPreset(client, options = {}) {
  const {
    title = 'Erreur',
    description = 'Une erreur est survenue',
    fields = [],
    addThumbnail = true
  } = options;

  const embed = new EmbedBuilder()
    .setColor(0xFF6B6B) // Rouge
    .setAuthor({
      name: '❌ GORILLE™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTitle(title)
    .setDescription(description);

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (addThumbnail) {
    embed.setThumbnail(client?.user?.displayAvatarURL({ size: 256 }));
  }

  embed
    .setFooter({
      text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTimestamp();

  return embed;
}

/**
 * Preset WARNING - Attention/Avertissement
 */
export function createWarningPreset(client, options = {}) {
  const {
    title = 'Attention',
    description = 'Une action importante est en cours',
    fields = [],
    addThumbnail = true
  } = options;

  const embed = new EmbedBuilder()
    .setColor(0xFFA500) // Orange
    .setAuthor({
      name: '⚠️ GORILLE™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTitle(title)
    .setDescription(description);

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (addThumbnail) {
    embed.setThumbnail(client?.user?.displayAvatarURL({ size: 256 }));
  }

  embed
    .setFooter({
      text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTimestamp();

  return embed;
}

/**
 * Preset INFO - Information générale
 */
export function createInfoPreset(client, options = {}) {
  const {
    title = 'Information',
    description = 'Voici l\'information demandée',
    fields = [],
    addThumbnail = true
  } = options;

  const embed = new EmbedBuilder()
    .setColor(0x3498DB) // Bleu
    .setAuthor({
      name: 'ℹ️ GORILLE™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTitle(title)
    .setDescription(description);

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (addThumbnail) {
    embed.setThumbnail(client?.user?.displayAvatarURL({ size: 256 }));
  }

  embed
    .setFooter({
      text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTimestamp();

  return embed;
}

/**
 * Preset LOG EVENT - Événement/Action loggée
 */
export function createEventPreset(client, options = {}) {
  const {
    eventType = 'action',
    emoji = '📝',
    title = 'Événement',
    description = 'Un événement a eu lieu',
    user = null,
    action = null,
    details = [],
    addThumbnail = true
  } = options;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2) // Bleu Discord
    .setAuthor({
      name: `${emoji} GORILLE™・BOTS`,
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTitle(title)
    .setDescription(description);

  if (user) {
    embed.addFields({
      name: '━━━━━ 👤 UTILISATEUR 👤 ━━━━━',
      value: ' ',
      inline: false
    });
    if (typeof user === 'object') {
      Object.entries(user).forEach(([key, value]) => {
        embed.addFields({
          name: `${key}:`,
          value: value,
          inline: true
        });
      });
    }
  }

  if (action) {
    embed.addFields({
      name: '━━━━━ 🔄 ACTION 🔄 ━━━━━',
      value: ' ',
      inline: false
    });
    if (typeof action === 'object') {
      Object.entries(action).forEach(([key, value]) => {
        embed.addFields({
          name: `${key}:`,
          value: value,
          inline: true
        });
      });
    }
  }

  if (details.length > 0) {
    details.forEach(detail => {
      embed.addFields(detail);
    });
  }

  if (addThumbnail) {
    embed.setThumbnail(client?.user?.displayAvatarURL({ size: 256 }));
  }

  embed
    .setFooter({
      text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTimestamp();

  return embed;
}

/**
 * Preset STATUS - État du système
 */
export function createStatusPreset(client, options = {}) {
  const {
    title = 'Statut du Système',
    systemStatus = [],
    statistics = [],
    features = [],
    addThumbnail = true
  } = options;

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71) // Vert
    .setAuthor({
      name: '🟢 GORILLE™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTitle(title)
    .setDescription('État complet du système');

  if (systemStatus.length > 0) {
    embed.addFields({
      name: '━━━━━ 🟢 STATUT SYSTÈME 🟢 ━━━━━',
      value: ' ',
      inline: false
    });
    embed.addFields(systemStatus);
  }

  if (statistics.length > 0) {
    embed.addFields({
      name: '━━━━━ 📊 STATISTIQUES 📊 ━━━━━',
      value: ' ',
      inline: false
    });
    embed.addFields(statistics);
  }

  if (features.length > 0) {
    embed.addFields({
      name: '━━━━━ 🚀 FONCTIONNALITÉS 🚀 ━━━━━',
      value: ' ',
      inline: false
    });
    embed.addFields(features);
  }

  if (addThumbnail) {
    embed.setThumbnail(client?.user?.displayAvatarURL({ size: 256 }));
  }

  embed
    .setFooter({
      text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTimestamp();

  return embed;
}

/**
 * Preset CARD - Fiche d'informations
 */
export function createCardPreset(client, options = {}) {
  const {
    title = 'Fiche d\'Information',
    icon = '🎴',
    imageUrl = null,
    mainInfo = [],
    sections = [],
    addThumbnail = true
  } = options;

  const embed = new EmbedBuilder()
    .setColor(0xD4AF37) // Or
    .setAuthor({
      name: `${icon} GORILLE™・BOTS`,
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTitle(title);

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  if (mainInfo.length > 0) {
    embed.addFields(mainInfo);
  }

  sections.forEach(section => {
    if (section.title) {
      embed.addFields({
        name: `━━━━━ ${section.title} ━━━━━`,
        value: ' ',
        inline: false
      });
    }
    if (section.fields) {
      embed.addFields(section.fields);
    }
  });

  if (addThumbnail) {
    embed.setThumbnail(client?.user?.displayAvatarURL({ size: 256 }));
  }

  embed
    .setFooter({
      text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTimestamp();

  return embed;
}

/**
 * Preset TIMELINE - Historique chronologique
 */
export function createTimelinePreset(client, options = {}) {
  const {
    title = 'Historique',
    events = [], // Format: { time, emoji, title, description }
    addThumbnail = true
  } = options;

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6) // Violet
    .setAuthor({
      name: '📅 GORILLE™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTitle(title);

  events.forEach(event => {
    const { time = '', emoji = '●', title = '', description = '' } = event;
    const eventText = `**${time}** ${emoji} ${title}\n${description}`;
    embed.addFields({
      name: ' ',
      value: eventText,
      inline: false
    });
  });

  if (addThumbnail) {
    embed.setThumbnail(client?.user?.displayAvatarURL({ size: 256 }));
  }

  embed
    .setFooter({
      text: '✨ Créé par LeBelge_e | Gorille™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    })
    .setTimestamp();

  return embed;
}

/**
 * Preset CUSTOM - Embed personnalisé avec logo automatique
 */
export function createCustomPreset(client, options = {}) {
  const {
    color = 0x2ECC71,
    title = 'Titre',
    description = 'Description',
    author = null,
    image = null,
    thumbnail = true,
    fields = [],
    footer = null
  } = options;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description);

  if (author) {
    embed.setAuthor({
      name: author.name || '🤖 GORILLE™・BOTS',
      iconURL: author.iconURL || client?.user?.displayAvatarURL({ size: 256 })
    });
  } else {
    embed.setAuthor({
      name: '🤖 GORILLE™・BOTS',
      iconURL: client?.user?.displayAvatarURL({ size: 256 })
    });
  }

  if (image) {
    embed.setImage(image);
  }

  if (thumbnail) {
    embed.setThumbnail(client?.user?.displayAvatarURL({ size: 256 }));
  }

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  embed.setFooter({
    text: footer || '✨ Créé par LeBelge_e | Gorille™・BOTS',
    iconURL: client?.user?.displayAvatarURL({ size: 256 })
  });

  embed.setTimestamp();

  return embed;
}

/**
 * Helper: Ajouter une section séparatrice
 */
export function addSection(fields, title, emoji = '━') {
  fields.push({
    name: `${emoji}━━━━━ ${title} ${emoji}━━━━━`,
    value: ' ',
    inline: false
  });
  return fields;
}

/**
 * Helper: Créer un champ simple
 */
export function createField(name, value, inline = true) {
  return { name, value, inline };
}

/**
 * Couleurs prédéfinies
 */
export const colors = {
  green: 0x2ECC71,      // Succès, principal
  blue: 0x3498DB,       // Info, commandes
  red: 0xFF6B6B,        // Erreur, attention
  gold: 0xD4AF37,       // Configuration
  orange: 0xFFA500,     // Warning, loading
  purple: 0x9B59B6,     // Broadcast, spécial
  discord: 0x5865F2,    // Discord blue
  gray: 0x95A5A6        // Secondaire
};
