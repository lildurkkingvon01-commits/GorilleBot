import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { saveSavedPlayerUrl, getSavedPlayerUrl, getSavedPlayerByUrl } from '../utils/database.js';
import { scrapePactifyProfile } from '../utils/scraper.js';
import { updatePlayersCache } from './addplayer.js';

export const data = new SlashCommandBuilder()
  .setName('save')
  .setDescription('Sauvegarde une URL Pactify avec un nom (optionnel)')
  .addStringOption(option =>
    option
      .setName('url')
      .setDescription('URL Pactify du joueur')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('nom')
      .setDescription('Nom pour identifier ce joueur (optionnel - auto-détecté si vide)')
      .setRequired(false)
  );

export async function execute(interaction) {
  // Authorization handled centrally by GlobalCommandMiddleware

  const url = interaction.options.getString('url');
  let nom = interaction.options.getString('nom');

  // Vérifier que c'est une URL Pactify
  if (!url.includes('pactify') && !url.startsWith('http')) {
    return interaction.editReply({
      content: '❌・L\'URL fournie n\'est pas valide'
    });
  }

  try {
    // Scraper le profil pour récupérer les infos du joueur
    const scrapeResult = await scrapePactifyProfile(url);
    
    // Utiliser le nom fourni OU le nom extrait du scraper
    if (!nom) {
      nom = scrapeResult.playerName;
      if (!nom) {
        return interaction.editReply({
          content: '❌・Impossible d\'extraire le nom du profil. Veuillez le spécifier avec l\'option `/save nom:`'
        });
      }
    }

    // Vérifier que le nom n'existe pas déjà
    try {
      const existingPlayer = await getSavedPlayerUrl(nom);
      if (existingPlayer) {
        return interaction.editReply({
          content: `❌・Le nom **${nom}** existe déjà dans les joueurs sauvegardés!\n\nUtilise un autre nom ou supprime d'abord ce joueur avec \`/deletesave\`.`
        });
      }
    } catch (error) {
      // Le joueur n'existe pas (c'est normal)
    }

    // Vérifier que l'URL n'existe pas déjà
    try {
      const existingUrl = await getSavedPlayerByUrl(url);
      if (existingUrl) {
        return interaction.editReply({
          content: `❌・Cette **URL est déjà enregistrée** sous le nom **${existingUrl}**!\n\nNote: Chaque URL ne peut être sauvegardée qu'une fois.`
        });
      }
    } catch (error) {
      // L'URL n'existe pas (c'est normal)
    }
    
    const playerPower = scrapeResult.playerPower || 'N/A';
    const playerFaction = scrapeResult.playerFaction || 'N/A';
    const playerRole = scrapeResult.playerRole || 'N/A';
    const playerGrade = scrapeResult.playerGrade || 'Guerrier';
    const playerImageUrl = scrapeResult.playerImageUrl || null;

    // Sauvegarder dans la base de données (playerName, playerUrl, guildId, savedBy)
    await saveSavedPlayerUrl(nom, url, interaction.guildId, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x00d26a)
      .setTitle('✅・__URL SAUVEGARDÉE__')
      .setDescription(`**${nom}** est maintenant sauvegardé!`)
      .setThumbnail(playerImageUrl)
      .addFields(
        {
          name: '📝・Nom',
          value: `\`${nom}\``,
          inline: true
        },
        {
          name: '👑・Grade',
          value: `\`${playerGrade}\``,
          inline: true
        },
        {
          name: '⚡・Power',
          value: `\`${playerPower}\``,
          inline: true
        },
        {
          name: '🛡️・Faction',
          value: `\`${playerFaction}\``,
          inline: true
        },
        {
          name: '🎭・Rôle',
          value: `\`${playerRole}\``,
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
    console.log(`✅・URL sauvegardée: ${nom} → ${url}`);

    // Mettre à jour le cache immédiatement
    await updatePlayersCache();

  } catch (error) {
    console.error('Erreur save:', error);
    
    // Vérifier si c'est une erreur de doublon
    if (error.message.includes('UNIQUE constraint failed')) {
      return interaction.editReply({
        content: `❌・**${nom}** est déjà utilisé. Utilise un autre nom!`
      });
    }

    await interaction.editReply({
      content: '❌・Erreur lors de la sauvegarde'
    });
  }
}

