import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { saveSavedFactionUrl, getSavedFactionUrl, getSavedFactionByUrl, deleteSavedFactionUrl, getAllSavedFactions, getSavedFactionByName } from '../utils/database.js';
import { scrapePactifyFaction } from '../utils/scraper.js';

export const data = new SlashCommandBuilder()
  .setName('f')
  .setDescription('Gère et affiche les infos des factions sauvegardées')
  .addSubcommand(subcommand =>
    subcommand
      .setName('info')
      .setDescription('Affiche les infos complètes d\'une faction')
      .addStringOption(option =>
        option
          .setName('nom')
          .setDescription('Nom de la faction')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('save')
      .setDescription('Sauvegarde une URL Pactify de faction avec un nom (optionnel)')
      .addStringOption(option =>
        option
          .setName('url')
          .setDescription('URL Pactify de la faction')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('nom')
          .setDescription('Nom pour identifier cette faction (optionnel - auto-détecté si vide)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Supprime une faction de la liste des sauvegardées (Owner only)')
      .addStringOption(option =>
        option
          .setName('nom')
          .setDescription('Nom de la faction à supprimer')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Affiche la liste de toutes les factions sauvegardées')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'info') {
    await handleFactionInfo(interaction);
  } else if (subcommand === 'save') {
    await handleFactionSave(interaction);
  } else if (subcommand === 'delete') {
    await handleFactionDelete(interaction);
  } else if (subcommand === 'list') {
    await handleFactionList(interaction);
  }
}

async function handleFactionInfo(interaction) {
  const factionName = interaction.options.getString('nom');

  try {
    // Récupérer l'URL de la faction sauvegardée
    const savedFaction = await getSavedFactionByName(factionName);

    if (!savedFaction) {
      return interaction.editReply({
        content: `❌・Faction **${factionName}** non trouvée dans les sauvegardées`
      });
    }

    // Scraper les infos fraîches en temps réel
    const freshData = await scrapePactifyFaction(savedFaction.factionUrl);

    if (!freshData.success) {
      console.warn(`⚠️ Scraping échoué pour ${factionName}, utilisation cache`);
    } else {
      // Mettre à jour la DB avec les nouvelles données
      const { updateSavedFaction } = await import('../utils/database.js');
      await updateSavedFaction(
        factionName,
        freshData.factionPower,
        freshData.factionMembers,
        freshData.factionAlliesList,
        freshData.factionClaims,
        freshData.factionCreationDate,
        freshData.factionEmoji,
        freshData.factionImageUrl
      );
    }

    // Utiliser les données fraîches si disponibles, sinon données sauvegardées
    const factionData = freshData.success ? {
      factionName: freshData.factionName || savedFaction.factionName,
      factionEmoji: freshData.factionEmoji || savedFaction.factionEmoji,
      factionUrl: savedFaction.factionUrl,
      factionImageUrl: freshData.factionImageUrl || savedFaction.factionImageUrl,
      factionPower: freshData.factionPower,
      factionMembers: freshData.factionMembers,
      factionAlliesList: freshData.factionAlliesList,
      factionClaims: freshData.factionClaims,
      factionCreationDate: freshData.factionCreationDate
    } : savedFaction;

    // Formater les membres de manière lisible
    const members = factionData.factionMembers.split(', ');
    const membersListFormatted = members.length > 0 
      ? `> ${members.map(m => m.replace(/_/g, '\\_')).join('\n> ')}`
      : 'Aucun membre';

    // Formater les alliés de manière lisible
    const allies = factionData.factionAlliesList ? factionData.factionAlliesList.split(', ') : [];
    const alliesListFormatted = allies.length > 0 
      ? `> ${allies.map(a => a.replace(/_/g, '\\_')).join('\n> ')}`
      : 'Aucun allié';

    // Créer l'embed avec les infos de la faction
    const factionsEmbed = new EmbedBuilder()
      .setColor(0xff6b35) // Couleur orange pour les factions
      .setAuthor({
        name: `${factionData.factionEmoji ? factionData.factionEmoji + '・' : ''}${factionData.factionName}`,
        iconURL: factionData.factionImageUrl || undefined
      })
      .setDescription('Informations complètes de la faction')
      .setImage(factionData.factionImageUrl)
      .addFields(
        {
          name: '⚡・Power',
          value: `\`${factionData.factionPower}\``,
          inline: true
        },
        {
          name: '📍・Claims',
          value: `\`${factionData.factionClaims}\``,
          inline: true
        },
        {
          name: '📅・Date de création',
          value: `\`${factionData.factionCreationDate}\``,
          inline: true
        },
        {
          name: `👥・Membres (${members.length})`,
          value: membersListFormatted,
          inline: true
        },
        {
          name: `🤝・Alliés (${allies.length})`,
          value: alliesListFormatted,
          inline: true
        },
        {
          name: '\u200b',
          value: '\u200b',
          inline: true
        }
      )
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS | Factions', iconURL: interaction.user.displayAvatarURL({ size: 256 }) })
      .setTimestamp();

    // Créer les boutons interactifs
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('🔗 Voir Profil')
          .setURL(factionData.factionUrl),
        new ButtonBuilder()
          .setCustomId(`faction_members_${factionName}`)
          .setLabel('👥 Voir Membres')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true) // À implémenter si besoin
      );

    await interaction.editReply({
      embeds: [factionsEmbed],
      components: [row]
    });

  } catch (error) {
    console.error('Erreur f info:', error);
    await interaction.editReply({
      content: `❌・Erreur: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleFactionSave(interaction) {
  // Vérification de permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.editReply({
      content: '❌・Vous devez être **administrateur** pour utiliser cette commande !'
    });
  }

  const url = interaction.options.getString('url');
  let nom = interaction.options.getString('nom');

  // Vérifier que c'est une URL Pactify
  if (!url.includes('pactify') && !url.startsWith('http')) {
    return interaction.editReply({
      content: '❌・L\'URL fournie n\'est pas valide'
    });
  }

  // Vérifier que c'est une URL de faction
  if (!url.includes('/faction/')) {
    return interaction.editReply({
      content: '❌・L\'URL fournie n\'est pas une URL de faction!\n\nVérifiez qu\'elle contient `/faction/`'
    });
  }

  try {
    // Scraper le profil de la faction pour récupérer les infos
    const scrapeResult = await scrapePactifyFaction(url);
    
    if (!scrapeResult.success && scrapeResult.error) {
      return interaction.editReply({
        content: `❌・Erreur lors du scraping: ${scrapeResult.error}`
      });
    }

    // Utiliser le nom fourni OU le nom extrait du scraper
    if (!nom) {
      nom = scrapeResult.factionName;
      if (!nom) {
        return interaction.editReply({
          content: '❌・Impossible d\'extraire le nom de la faction. Veuillez le spécifier avec l\'option `/f save nom:`'
        });
      }
    }

    // Vérifier que le nom n'existe pas déjà
    try {
      const existingFaction = await getSavedFactionUrl(nom);
      if (existingFaction) {
        return interaction.editReply({
          content: `❌・Le nom **${nom}** existe déjà dans les factions sauvegardées!\n\nUtilise un autre nom ou supprime d'abord cette faction avec \`/f delete\`.`
        });
      }
    } catch (error) {
      // La faction n'existe pas (c'est normal)
    }

    // Vérifier que l'URL n'existe pas déjà
    try {
      const existingUrl = await getSavedFactionByUrl(url);
      if (existingUrl) {
        return interaction.editReply({
          content: `❌・Cette **URL est déjà enregistrée** sous le nom **${existingUrl.factionName}**!\n\nNote: Chaque URL ne peut être sauvegardée qu'une fois.`
        });
      }
    } catch (error) {
      // L'URL n'existe pas (c'est normal)
    }
    
    const factionPower = scrapeResult.factionPower || 'N/A';
    const factionMembers = scrapeResult.factionMembers || '0';
    const factionClaims = scrapeResult.factionClaims || '0';
    const factionAlliesList = scrapeResult.factionAlliesList || '';
    const factionAlliesCount = factionAlliesList ? factionAlliesList.split(', ').length : 0;
    const factionEmoji = scrapeResult.factionEmoji || null;
    const factionImageUrl = scrapeResult.factionImageUrl || null;
    const factionCreationDate = scrapeResult.factionCreationDate || 'N/A';

    // Sauvegarder dans la base de données
    await saveSavedFactionUrl(nom, url, factionPower, factionMembers, factionClaims, factionAlliesList, factionEmoji, factionImageUrl, factionCreationDate, interaction.guildId, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x00d26a)
      .setTitle('✅・__FACTION SAUVEGARDÉE__')
      .setDescription(`**${nom}** est maintenant sauvegardée!`)
      .setThumbnail(factionImageUrl)
      .addFields(
        {
          name: '🏰・Nom',
          value: `\`${nom}\``,
          inline: true
        },
        {
          name: '⚡・Power',
          value: `\`${factionPower}\``,
          inline: true
        },
        {
          name: '👥・Membres',
          value: `\`${factionMembers}\``,
          inline: true
        },
        {
          name: '📍・Claims',
          value: `\`${factionClaims}\``,
          inline: true
        },
        {
          name: '🤝・Alliés',
          value: `\`${factionAlliesCount}\``,
          inline: true
        },
        {
          name: '📅・Création',
          value: `\`${factionCreationDate}\``,
          inline: true
        },
        {
          name: '🔗・Profil',
          value: `[Accéder au profil](${url})`,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

    await interaction.editReply({ embeds: [embed] });
    console.log(`✅・Faction sauvegardée: ${nom} → ${url}`);

  } catch (error) {
    console.error('Erreur f save:', error);
    
    // Vérifier si c'est une erreur de doublon
    if (error.message.includes('UNIQUE constraint failed')) {
      return interaction.editReply({
        content: `❌・**${nom}** est déjà utilisé. Utilise un autre nom!`
      });
    }

    await interaction.editReply({
      content: `❌・Erreur lors de la sauvegarde: ${error.message}`
    });
  }
}

async function handleFactionDelete(interaction) {

  // Vérification: seulement le propriétaire du bot
  if (interaction.user.id !== '492627367114702849') {
    return interaction.editReply({
      content: '❌・Seul le propriétaire du bot peut supprimer des factions!'
    });
  }

  const factionName = interaction.options.getString('nom');

  try {
    await deleteSavedFactionUrl(factionName);
    
    await interaction.editReply({
      content: `✅・La faction **${factionName}** a été supprimée de la liste!`
    });

    console.log(`🗑️・Faction supprimée: ${factionName}`);

  } catch (error) {
    console.error('Erreur f delete:', error);
    await interaction.editReply({
      content: `❌・Erreur: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleFactionList(interaction) {

  try {
    const factions = await getAllSavedFactions();

    if (!factions || factions.length === 0) {
      return interaction.editReply({
        content: '❌・Aucune faction sauvegardée pour le moment!'
      });
    }

    // Paginer les factions (20 par page, 5 colonnes max)
    const itemsPerPage = 20;
    const totalPages = Math.ceil(factions.length / itemsPerPage);
    let currentPage = 0;

    const generateEmbed = (page) => {
      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const pageFactions = factions.slice(start, end);

      // Formater les factions en colonnes (5 colonnes max, 4 par colonne)
      const columns = [];
      for (let i = 0; i < pageFactions.length; i += 4) {
        const col = pageFactions.slice(i, i + 4);
        columns.push(col);
      }

      let description = '';
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const col = columns[colIdx];
        for (let rowIdx = 0; rowIdx < col.length; rowIdx++) {
          const faction = col[rowIdx];
          const number = start + colIdx * 4 + rowIdx + 1;
          description += `\`${number}.\` [${faction.factionName}](${faction.factionUrl})\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xff6b35)
        .setTitle('🏰・LISTE DES FACTIONS SAUVEGARDÉES')
        .setDescription(description || 'Aucune faction')
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ✨ Créé par LeBelge_e | Gorille™・BOTS | ${factions.length} faction(s)` })
        .setTimestamp();

      return embed;
    };

    const embed = generateEmbed(currentPage);

    // Créer les boutons de pagination
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('f_list_prev')
          .setLabel('◀️ Précédent')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('f_list_next')
          .setLabel('Suivant ▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === totalPages - 1)
      );

    const reply = await interaction.editReply({
      embeds: [embed],
      components: totalPages > 1 ? [buttons] : []
    });

    if (totalPages <= 1) return; // Pas besoin de collecteur si une seule page

    // Collector pour les boutons
    const collector = reply.createMessageComponentCollector({
      time: 5 * 60 * 1000 // 5 minutes
    });

    collector.on('collect', async (buttonInteraction) => {
      // Vérifier que c'est l'utilisateur qui a lancé la commande
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          content: '❌・Tu ne peux pas utiliser ces boutons!',
          ephemeral: true
        });
      }

      if (buttonInteraction.customId === 'f_list_prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (buttonInteraction.customId === 'f_list_next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      const newEmbed = generateEmbed(currentPage);
      const newButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('f_list_prev')
            .setLabel('◀️ Précédent')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId('f_list_next')
            .setLabel('Suivant ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages - 1)
        );

      await buttonInteraction.update({
        embeds: [newEmbed],
        components: [newButtons]
      });
    });

    collector.on('end', async () => {
      const finalEmbed = generateEmbed(currentPage);
      const disabledButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('f_list_prev')
            .setLabel('◀️ Précédent')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('f_list_next')
            .setLabel('Suivant ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        );

      await reply.edit({
        embeds: [finalEmbed],
        components: totalPages > 1 ? [disabledButtons] : []
      });
    });

  } catch (error) {
    console.error('Erreur f list:', error);
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
  if (interaction.commandName !== 'f') return;

  const focusedValue = interaction.options.getFocused();

  try {
    const factions = await getAllSavedFactions();
    
    const filtered = factions
      .filter(f => f.factionName.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25)
      .map(f => ({ name: f.factionName, value: f.factionName }));

    await safeRespond(interaction, filtered);
  } catch (error) {
    console.error('Erreur autocomplete f:', error);
    await safeRespond(interaction, []);
  }
}
