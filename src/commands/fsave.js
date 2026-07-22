import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { saveSavedFactionUrl, getSavedFactionUrl, getSavedFactionByUrl } from '../utils/database.js';
import { scrapePactifyFaction } from '../utils/scraper.js';

export const data = new SlashCommandBuilder()
  .setName('fsave')
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
  );

export async function execute(interaction) {
  console.log('[FSAVE] ===============================================');
  console.log('[FSAVE] COMMAND STARTED by', interaction.user.tag);
  const commandStartTime = Date.now();

  let isDeferred = false;
  let isReplied = false;

  try {
    // ========== STEP 1: Defer Reply ==========
    console.log('[FSAVE] Step 1: Deferring reply...');
    try {
      await interaction.deferReply();
      isDeferred = true;
      console.log('[FSAVE] ✅ Reply deferred successfully');
    } catch (deferError) {
      console.error('[FSAVE] ❌ Failed to defer reply:', deferError.code, deferError.message);
      // Try to reply without deferring
      try {
        await interaction.reply({
          content: '❌ Erreur lors du traitement de la commande (defer failed)',
          ephemeral: true
        });
        isReplied = true;
      } catch (replyError) {
        console.error('[FSAVE] ❌ Failed to reply:', replyError.message);
      }
      return;
    }

    // ========== STEP 2: Permission Check ==========
    console.log('[FSAVE] Step 2: Checking permissions...');
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      console.log('[FSAVE] ❌ User is not admin');
      await interaction.editReply({
        content: '❌・Vous devez être **administrateur** pour utiliser cette commande !'
      });
      isReplied = true;
      return;
    }
    console.log('[FSAVE] ✅ User is admin');

    // ========== STEP 3: Get Input Parameters ==========
    console.log('[FSAVE] Step 3: Reading parameters...');
    const url = interaction.options.getString('url');
    let nom = interaction.options.getString('nom');
    
    console.log('[FSAVE] URL received:', url);
    console.log('[FSAVE] Custom name provided:', nom || '(none - will auto-detect)');

    // ========== STEP 4: Validate URL Format ==========
    console.log('[FSAVE] Step 4: Validating URL format...');
    if (!url) {
      console.error('[FSAVE] ❌ URL is empty');
      await interaction.editReply({
        content: '❌・L\'URL est vide. Veuillez fournir une URL valide.'
      });
      isReplied = true;
      return;
    }

    // Strict URL validation
    const isPactifyUrl = url.includes('pactify.fr') || url.includes('pactify.com');
    const isValidUrl = url.startsWith('http://') || url.startsWith('https://');
    
    if (!isPactifyUrl || !isValidUrl) {
      console.error('[FSAVE] ❌ URL is not a valid Pactify URL');
      await interaction.editReply({
        content: '❌・L\'URL fournie n\'est pas une URL Pactify valide.\n\nExemple: `https://www.pactify.fr/faction/3yE98u`'
      });
      isReplied = true;
      return;
    }
    console.log('[FSAVE] ✅ URL is valid Pactify URL');

    // Verify it's a faction URL
    if (!url.includes('/faction/')) {
      console.error('[FSAVE] ❌ URL is not a faction URL');
      await interaction.editReply({
        content: '❌・L\'URL fournie n\'est pas une URL de faction!\n\nVérifiez qu\'elle contient `/faction/`\n\nExemple: `https://www.pactify.fr/faction/3yE98u`'
      });
      isReplied = true;
      return;
    }
    console.log('[FSAVE] ✅ URL is a faction URL');

    // ========== STEP 5: Scrape Faction Data ==========
    console.log('[FSAVE] Step 5: Scraping faction data from Pactify...');
    console.log('[FSAVE] (This may take up to 10 seconds)');
    
    const scrapeResult = await scrapePactifyFaction(url);
    console.log('[FSAVE] Scrape result:', scrapeResult);
    
    if (!scrapeResult.success) {
      console.error('[FSAVE] ❌ Scraping failed:', scrapeResult.error);
      const errorMsg = scrapeResult.error || 'Erreur inconnue lors du scraping';
      await interaction.editReply({
        content: `❌・Erreur lors du scraping:\n\`\`\`${errorMsg}\`\`\``
      });
      isReplied = true;
      return;
    }
    console.log('[FSAVE] ✅ Scraping successful');
    console.log('[FSAVE] Faction name:', scrapeResult.factionName);

    // ========== STEP 6: Determine Faction Name ==========
    console.log('[FSAVE] Step 6: Determining faction name...');
    if (!nom) {
      nom = scrapeResult.factionName;
      console.log('[FSAVE] Using scraped name:', nom);
      
      if (!nom || nom === 'Unknown') {
        console.error('[FSAVE] ❌ Could not extract faction name');
        await interaction.editReply({
          content: '❌・Impossible d\'extraire le nom de la faction.\n\nVeuillez spécifier le nom avec l\'option `/fsave nom: NomDeLaFaction`'
        });
        isReplied = true;
        return;
      }
    } else {
      console.log('[FSAVE] Using provided name:', nom);
    }
    console.log('[FSAVE] ✅ Faction name confirmed:', nom);

    // ========== STEP 7: Check Name Doesn't Exist ==========
    console.log('[FSAVE] Step 7: Checking if name already exists...');
    try {
      const existingFaction = await getSavedFactionUrl(nom);
      if (existingFaction) {
        console.error('[FSAVE] ❌ Name already exists:', nom);
        await interaction.editReply({
          content: `❌・Le nom **${nom}** existe déjà dans les factions sauvegardées!\n\nUtilise un autre nom ou supprime d'abord cette faction avec \`/fdeletesave\`.`
        });
        isReplied = true;
        return;
      }
      console.log('[FSAVE] ✅ Name is unique');
    } catch (error) {
      console.log('[FSAVE] ℹ️  Name check returned no existing entry (normal)');
    }

    // ========== STEP 8: Check URL Doesn't Exist ==========
    console.log('[FSAVE] Step 8: Checking if URL already exists...');
    try {
      const existingUrl = await getSavedFactionByUrl(url);
      if (existingUrl) {
        console.error('[FSAVE] ❌ URL already exists under name:', existingUrl);
        await interaction.editReply({
          content: `❌・Cette **URL est déjà enregistrée** sous le nom **${existingUrl}**!\n\nNote: Chaque URL ne peut être sauvegardée qu'une fois.`
        });
        isReplied = true;
        return;
      }
      console.log('[FSAVE] ✅ URL is unique');
    } catch (error) {
      console.log('[FSAVE] ℹ️  URL check returned no existing entry (normal)');
    }

    // ========== STEP 9: Extract Faction Stats ==========
    console.log('[FSAVE] Step 9: Extracting faction stats...');
    const factionPower = scrapeResult.factionPower || 'N/A';
    const factionMembers = scrapeResult.factionMembers || '0';
    const factionClaims = scrapeResult.factionClaims || '0';
    const factionAlliesList = scrapeResult.factionAlliesList || '';
    const factionAlliesCount = factionAlliesList ? factionAlliesList.split(', ').filter(x => x).length : 0;
    const factionEmoji = scrapeResult.factionEmoji || null;
    const factionImageUrl = scrapeResult.factionImageUrl || null;
    const factionCreationDate = scrapeResult.factionCreationDate || 'N/A';
    
    console.log('[FSAVE] Stats extracted:');
    console.log('  - Power:', factionPower);
    console.log('  - Members:', factionMembers);
    console.log('  - Claims:', factionClaims);
    console.log('  - Allies:', factionAlliesCount);
    console.log('  - Created:', factionCreationDate);

    // ========== STEP 10: Save to Database ==========
    console.log('[FSAVE] Step 10: Saving to database...');
    await saveSavedFactionUrl(nom, url, factionPower, factionMembers, factionClaims, factionAlliesList, factionEmoji, factionImageUrl, factionCreationDate);
    console.log('[FSAVE] ✅ Saved to database successfully');

    // ========== STEP 11: Send Success Response ==========
    console.log('[FSAVE] Step 11: Sending success response...');
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
    isReplied = true;
    
    const totalDuration = Date.now() - commandStartTime;
    console.log(`[FSAVE] ✅ COMMAND SUCCESS in ${totalDuration}ms`);
    console.log(`[FSAVE] Faction: ${nom} → ${url}`);
    console.log('[FSAVE] ===============================================');

  } catch (error) {
    const totalDuration = Date.now() - commandStartTime;
    console.error(`[FSAVE] ❌ COMMAND ERROR (${totalDuration}ms)`);
    console.error('[FSAVE] Error name:', error.name);
    console.error('[FSAVE] Error message:', error.message);
    console.error('[FSAVE] Error code:', error.code);
    console.error('[FSAVE] Full error:', error);
    console.log('[FSAVE] ===============================================');

    // Determine error type
    let errorMessage = `❌・Erreur lors de la sauvegarde:\n\`\`\`${error.message}\`\`\``;
    
    if (error.message.includes('UNIQUE constraint failed')) {
      errorMessage = `❌・**${nom || 'Faction'}** est déjà utilisée. Utilise un autre nom!`;
    } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
      errorMessage = '❌・Pactify ne répond pas (timeout). Réessaye dans quelques secondes.';
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      errorMessage = '❌・Impossible de se connecter à Pactify. Vérifiez votre connexion.';
    }

    // Send error response
    try {
      if (isDeferred || isReplied) {
        await interaction.editReply({
          content: errorMessage
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error('[FSAVE] Failed to send error response:', replyError.message);
      // Last resort: try followUp
      try {
        await interaction.followUp({
          content: errorMessage,
          ephemeral: true
        });
      } catch (followUpError) {
        console.error('[FSAVE] Failed to send followUp:', followUpError.message);
      }
    }
  }
}

