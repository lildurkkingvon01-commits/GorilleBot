import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, MessageFlags } from 'discord.js';
import { getSavedPlayerByName, getAllSavedPlayersGlobal, addPlayer, updateSavedPlayer } from '../utils/database.js';
import { scrapePactifyProfile, searchPlayerOnPactify } from '../utils/scraper.js';

// Cache en mémoire pour l'autocomplete
let savedPlayersCache = [];

// Couleurs par grade
const gradeColors = {
  'Démon': 0x7B3FF2,      // Mauve
  'Dieu': 0x00BCD4,        // Bleu ciel
  'Légende': 0x90EE90,     // Vert clair
  'Héros': 0x1E3A8A,       // Bleu foncé
  'Guerrier': 0x808080,    // Gris
  'Divinité': 0xFFD700     // Jaune
};

function getColorByGrade(grade) {
  return gradeColors[grade] || 0x3498db;
}

export async function updateInfoCache() {
  try {
    savedPlayersCache = await getAllSavedPlayersGlobal();
  } catch (error) {
    console.error('Erreur mise à jour cache info:', error);
  }
}

// Mettre à jour le cache toutes les 30 secondes
setInterval(updateInfoCache, 30000);

export const data = new SlashCommandBuilder()
  .setName('info')
  .setDescription('Affiche les informations d\'un joueur Pactify sauvegardé')
  .addStringOption(option =>
    option
      .setName('nom')
      .setDescription('Nom du joueur sauvegardé')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction) {
  const playerName = interaction.options.getString('nom');

  try {
    // Chercher le joueur sauvegardé
    let savedPlayer = await getSavedPlayerByName(playerName);
    let playerUrl = savedPlayer?.playerUrl;

    // Si pas sauvegardé, chercher sur Pactify
    if (!playerUrl) {
      await interaction.editReply({
        content: `🔍・Recherche de **${playerName}** sur Pactify...`
      });
      
      playerUrl = await searchPlayerOnPactify(playerName);
      
      if (!playerUrl) {
        return interaction.editReply({
          content: `❌・Le joueur **${playerName}** n'a pas été trouvé sur Pactify.\n\nVérifie l'orthographe du pseudo !`
        });
      }
    }

    // Scraper les infos fraîches en temps réel
    const scrapeResult = await scrapePactifyProfile(playerUrl);
    
    // Mettre à jour la DB avec les nouvelles données si c'est un joueur sauvegardé
    if (savedPlayer && scrapeResult.playerPower) {
      try {
        await updateSavedPlayer(
          playerName,
          scrapeResult.playerPower,
          scrapeResult.playerFaction,
          scrapeResult.playerRole,
          scrapeResult.playerGrade
        );
      } catch (updateErr) {
        console.warn(`⚠️ Erreur mise à jour DB pour ${playerName}:`, updateErr);
      }
    }
    
    const grade = scrapeResult.playerGrade || 'Guerrier';
    const color = getColorByGrade(grade);
    const power = scrapeResult.playerPower || 'N/A';
    const faction = scrapeResult.playerFaction || 'N/A';
    const role = scrapeResult.playerRole || 'N/A';
    const gametime = scrapeResult.playerGametime || 'N/A';
    const inscriptionDate = scrapeResult.inscriptionDate || 'N/A';
    const status = scrapeResult.status === 'online' ? '🟢 En ligne' : '🔴 Inactif';
    const daysInactive = scrapeResult.daysInactive?.toFixed(2) || 'N/A';
    const imageUrl = scrapeResult.playerImageUrl || 'https://cdn-icons-png.flaticon.com/512/747/747376.png';

    // Créer les boutons
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('🔗 Voir Profil')
          .setURL(playerUrl)
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setCustomId(`info_addplayer_${interaction.user.id}_${playerName}`)
          .setLabel('➕・Ajouter à Surveillance')
          .setStyle(ButtonStyle.Secondary)
      );

    // EMBED COMPLET avec TOUS les informations
    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${playerName} - Grade: ${grade}`,
        iconURL: imageUrl
      })
      .setThumbnail(imageUrl)
      .addFields(
        {
          name: '👑・Grade',
          value: `\`${grade}\``,
          inline: true
        },
        {
          name: '⚡・Power',
          value: `\`${power}\``,
          inline: true
        },
        {
          name: '📊・Statut',
          value: status,
          inline: true
        },
        {
          name: '🛡️・Faction',
          value: `\`${faction}\``,
          inline: true
        },
        {
          name: '🎭・Rôle',
          value: `\`${role}\``,
          inline: true
        },
        {
          name: '⏱️・Temps de Jeu',
          value: `\`${gametime}\``,
          inline: true
        },
        {
          name: '📅・Date d\'Inscription',
          value: `\`${inscriptionDate}\``,
          inline: true
        },
        {
          name: '⏳・Inactivité',
          value: scrapeResult.status === 'online' ? '✅ En ligne maintenant' : `\`${daysInactive} jour(s)\``,
          inline: true
        },
        {
          name: '🔗・Profil',
          value: `[Cliquer ici pour voir le profil](${playerUrl})`,
          inline: false
        }
      )
      .setFooter({ 
        text: 'Gorille™・BOTS | Profil Joueur - Données en temps réel',
        iconURL: interaction.user.displayAvatarURL({ size: 256 })
      })
      .setTimestamp();

    const message = await interaction.editReply({ 
      embeds: [embed],
      components: [buttons]
    });

    // Gérer les interactions des boutons
    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 5 * 60 * 1000 // 5 minutes
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId.includes('info_addplayer')) {
        const userSelect = new UserSelectMenuBuilder()
          .setCustomId(`info_member_select_${interaction.user.id}_${playerName}_${playerUrl}`)
          .setPlaceholder('Sélectionne un membre...')
          .setMaxValues(1);

        const selectRow = new ActionRowBuilder().addComponents(userSelect);
        
        const selectMessage = await buttonInteraction.reply({
          content: '📋・Sélectionne le membre pour lequel ajouter ce joueur:',
          components: [selectRow],
          flags: MessageFlags.Ephemeral,
          fetchReply: true
        });

        // Créer un collector spécifique sur cette réponse
        const selectCollector = selectMessage.createMessageComponentCollector({
          filter: (i) => i.isUserSelectMenu() && i.customId.includes('info_member_select'),
          time: 5 * 60 * 1000
        });

        selectCollector.on('collect', async (selectInteraction) => {
          try {
            const memberId = selectInteraction.values[0];
                // Ensure we have a guild context
                if (!interaction.guildId) {
                  return await selectInteraction.reply({ content: '❌ Impossible d\'ajouter: commande utilisable seulement dans un serveur.', flags: MessageFlags.Ephemeral });
                }

                const member = await interaction.guild.members.fetch(memberId);

                await addPlayer(
                  memberId,
                  member.user.username,
                  null,
                  interaction.guildId
                );

            await selectInteraction.reply({
              content: `✅・**${playerName}** a été ajouté à la surveillance pour ${member.user.username}!`,
              flags: MessageFlags.Ephemeral
            });
          } catch (error) {
            console.error('❌・Erreur ajout joueur:', error);
            await selectInteraction.reply({
              content: `❌・Erreur lors de l'ajout: ${error.message}`,
              flags: MessageFlags.Ephemeral
            });
          }
        });
      }
    });
  } catch (error) {
    console.error('❌・Erreur info:', error);
    await interaction.editReply({
      content: '❌・Erreur lors de la récupération des informations du joueur'
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
  try {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name !== 'nom') {
      return await safeRespond(interaction, []);
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
          name: display.substring(0, 100),
          value: p.playerName
        };
      });

    return await safeRespond(interaction, choices);
  } catch (error) {
    console.error('Autocomplete error info:', error);
    try {
      return await safeRespond(interaction, []);
    } catch (e) {
      // Ignorer silencieusement
    }
  }
}

