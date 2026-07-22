import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { addOrUpdatePlayerByName, getSavedPlayerUrl, getAllSavedPlayersGlobal, getPlayersByGuild } from '../utils/database.js';
import { scrapePactifyProfile } from '../utils/scraper.js';

// Cache en mémoire pour l'autocomplete (ultra rapide)
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

// Fonction pour mettre à jour le cache
export async function updatePlayersCache() {
  try {
    savedPlayersCache = await getAllSavedPlayersGlobal();
  } catch (error) {
    console.error('Erreur mise à jour cache joueurs:', error);
  }
}

// Mettre à jour le cache toutes les 30 secondes
setInterval(updatePlayersCache, 30000);

export const data = new SlashCommandBuilder()
  .setName('addplayer')
  .setDescription('Ajoute un joueur sauvegardé à surveiller')
  .addStringOption(option =>
    option
      .setName('nom')
      .setDescription('Nom du joueur sauvegardé')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addUserOption(option =>
    option
      .setName('membre')
      .setDescription('Membre Discord à mentionner en cas d\'alerte')
      .setRequired(true)
  );

export async function execute(interaction) {
  // Must be used in a guild context
  if (!interaction.guildId) {
    return interaction.editReply({ content: '❌ Cette commande doit être utilisée dans un serveur Discord.' });
  }
  // Vérification de permission (sécurité supplémentaire)
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.editReply({
      content: '❌ Vous devez être **administrateur** pour utiliser cette commande !'
    });
  }

  const playerName = interaction.options.getString('nom');
  const member = interaction.options.getUser('membre');

  try {
    // Récupérer l'URL sauvegardée (case-insensitive search)
    const savedUrl = await getSavedPlayerUrl(playerName);

    if (!savedUrl) {
      return interaction.editReply({
        content: `❌ Le joueur **${playerName}** n'a pas été trouvé.\n\nUtilise d'abord \`/save <url> <nom>\` pour enregistrer ce joueur!`
      });
    }

    // Scraper le profil du joueur avec l'URL sauvegardée
    const scrapeResult = await scrapePactifyProfile(savedUrl);

    // Vérifier si le scraper a retourné null
    if (!scrapeResult || scrapeResult.error) {
      return interaction.editReply({
        content: '❌ Joueur introuvable ou Pactify n\'a pas répondu correctement.\n\nVérifiez que l\'URL du joueur est correcte et réessayez.'
      });
    }

    // Ajouter ou mettre à jour le joueur par nom (pas par discord_id)
    const pactifyPlayerName = scrapeResult.playerName;
    console.log(`[addplayer] Adding player: ${member.id} (${pactifyPlayerName}) - URL: ${savedUrl} - Faction: ${scrapeResult.playerFaction} - Inactive: ${scrapeResult.daysInactive}d`);
    
    const result = await addOrUpdatePlayerByName(
      pactifyPlayerName,
      savedUrl,
      scrapeResult.playerFaction || null,
      interaction.guildId,
      scrapeResult.daysInactive || 0,
      member.id
    );

    if (!result) {
      console.error(`[addplayer] Failed to add/update player ${pactifyPlayerName} - check DB logs above`);
      return interaction.editReply({
        content: '❌ Erreur lors de l\'ajout du joueur à la base de données.\n\nVérifiez les logs du bot pour plus de détails.'
      });
    }

    const playerImageUrl = scrapeResult.playerImageUrl || 'https://cdn-icons-png.flaticon.com/512/747/747376.png';

    const embed = new EmbedBuilder()
      .setColor(0x00d26a)
      .setTitle('✅ JOUEUR AJOUTÉ AVEC SUCCÈS ✅')
      .setDescription(`**${pactifyPlayerName}** est maintenant **sous surveillance** ! 🎯`)
      .setAuthor({
        name: member.username,
        iconURL: member.displayAvatarURL({ size: 256 })
      })
      .setThumbnail(playerImageUrl)
      .addFields(
        {
          name: '👤・Joueur Surveillé',
          value: `\`${pactifyPlayerName}\``,
          inline: true
        },
        {
          name: '🎮・Discord',
          value: `<@${member.id}>`,
          inline: true
        },
        {
          name: '⚡・Power',
          value: `\`${scrapeResult.playerPower || 'N/A'}\``,
          inline: true
        },
        {
          name: '🛡️・Faction',
          value: `\`${scrapeResult.playerFaction || 'N/A'}\``,
          inline: true
        },
        {
          name: '👑・Rôle',
          value: `\`${scrapeResult.playerRole || 'N/A'}\``,
          inline: true
        },
        {
          name: '⏱️・Temps de jeu',
          value: `\`${scrapeResult.playerGametime || 'N/A'}\``,
          inline: true
        },
        {
          name: '📢・Notifications',
          value: `Les alertes seront envoyées dans <#${interaction.channelId}>`,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: member.displayAvatarURL({ size: 256 }) });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur addplayer:', error);
    await interaction.editReply({
      content: '❌ Erreur lors de l\'ajout du joueur'
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
    console.error('Autocomplete error:', error);
    try {
      return await safeRespond(interaction, []);
    } catch (e) {
      // Silencieusement ignorer si impossible de répondre
    }
  }
}

