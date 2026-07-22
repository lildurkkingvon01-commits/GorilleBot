import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Retry utility with exponential backoff for network requests
 * Helps handle transient failures and rate limiting
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 500) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }
      
      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Retry attempt ${attempt}/${maxRetries} for Pactify request (waiting ${delay}ms)...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Make HTTP request with timeout protection
 */
async function pactifyRequest(url, config = {}, timeoutMs = 10000) {
  console.log(`[SCRAPER] Starting request to ${url} with ${timeoutMs}ms timeout`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`[SCRAPER] ⏰ TIMEOUT! Aborting request after ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);

  try {
    const defaultConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: Math.min(8000, timeoutMs - 1000),
      signal: controller.signal
    };
    
    const response = await retryWithBackoff(
      () => axios.get(url, { ...defaultConfig, ...config }),
      2,    // Max 2 retries (not 3 to stay under total timeout)
      500   // Base delay 500ms
    );
    
    clearTimeout(timeoutId);
    console.log(`[SCRAPER] ✅ Request successful: ${url}`);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.code === 'ECONNABORTED') {
      console.error(`[SCRAPER] ❌ Request ABORTED due to timeout: ${url}`);
      throw new Error(`Request timeout after ${timeoutMs}ms - Pactify server not responding`);
    }
    
    console.error(`[SCRAPER] ❌ Request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Chercher un joueur sur Pactify par son nom (en scrapant les pages /players)
 */
export async function searchPlayerOnPactify(playerName) {
  try {
    const lowerName = playerName.toLowerCase();
    const maxPages = 5; // Chercher sur les 5 premières pages
    
    for (let page = 1; page <= maxPages; page++) {
      try {
        const pageUrl = page === 1 ? 'https://www.pactify.fr/players' : `https://www.pactify.fr/players?page=${page}`;
        
        const response = await pactifyRequest(pageUrl);

        const $ = cheerio.load(response.data);
        
        // Chercher un lien contenant le nom du joueur (case-insensitive)
        let foundUrl = null;
        
        $('a').each((i, element) => {
          const linkText = $(element).text().trim();
          const href = $(element).attr('href');
          
          if (linkText.toLowerCase() === lowerName && href && href.includes('/player/')) {
            foundUrl = `https://www.pactify.fr${href}`;
            console.log(`🔍 Joueur trouvé page ${page}: "${playerName}" → ${foundUrl}`);
            return false; // break
          }
        });

        if (foundUrl) {
          return foundUrl;
        }
      } catch (pageError) {
        console.warn(`⚠️ Erreur scrape page ${page}:`, pageError.message);
        continue;
      }
    }

    // Silencieusement retourner null si non trouvé
    return null;
  } catch (error) {
    console.error(`❌ Erreur recherche joueur "${playerName}":`, error.message);
    return null;
  }
}

/**
 * Parse "il y a X jours et Y heures" en jours (décimal)
 */
function parseInactivityText(text) {
  if (!text) return null;

  const lowerText = text.toLowerCase();
  let totalHours = 0;

  // Chercher "X jour(s)" ou "un jour" (remplacer "un" par "1")
  const daysMatch = lowerText.match(/(\d+|un)\s*jours?/);
  if (daysMatch) {
    const dayValue = daysMatch[1] === 'un' ? 1 : parseInt(daysMatch[1]);
    totalHours += dayValue * 24;
  }

  // Chercher "X heure(s)" ou "une heure" (remplacer "une" par "1")
  const hoursMatch = lowerText.match(/(\d+|une)\s*heures?/);
  if (hoursMatch) {
    const hourValue = hoursMatch[1] === 'une' ? 1 : parseInt(hoursMatch[1]);
    totalHours += hourValue;
  }

  // Chercher "X minute(s)" ou "une minute" (remplacer "une" par "1")
  const minutesMatch = lowerText.match(/(\d+|une)\s*minutes?/);
  if (minutesMatch) {
    const minuteValue = minutesMatch[1] === 'une' ? 1 : parseInt(minutesMatch[1]);
    totalHours += minuteValue / 60;
  }

  console.log(`📐 Parse: "${text}" → ${totalHours}h = ${(totalHours / 24).toFixed(2)} jours`);
  return totalHours > 0 ? totalHours / 24 : 0;
}

/**
 * Scraper le profil Pactify et récupérer le statut, les jours d'inactivité, l'image et les stats
 */
export async function scrapePactifyProfile(url) {
  try {
    const response = await pactifyRequest(url);

    const $ = cheerio.load(response.data);
    let inactivityText = null;
    let daysInactive = 0;
    let playerStatus = 'inactive'; // Par défaut: inactif
    let playerImageUrl = null;
    
    // Stats du joueur
    let playerName = null;
    let playerPower = null;
    let playerFaction = null;
    let playerRole = null;
    let playerGrade = 'Guerrier'; // Par défaut: Guerrier
    let playerGametime = null;
    let playerInscriptionDate = null;

    // Récupérer le nom du joueur (depuis le titre de la page ou un h1)
    let pageTitle = $('h1').first().text().trim();
    if (pageTitle) {
      playerName = pageTitle;
      console.log(`👤 Nom du joueur (brut): ${playerName}`);
    }

    // Récupérer le grade du joueur (chercher parmi les grades connus)
    const allText = $.text();
    const grades = ['Démon', 'Dieu', 'Légende', 'Héros', 'Guerrier', 'Divinité'];
    for (const grade of grades) {
      if (allText.includes(grade) && pageTitle && pageTitle.includes(grade)) {
        playerGrade = grade;
        console.log(`👑 Grade du joueur: ${playerGrade}`);
        
        // Nettoyer le nom en retirant le grade
        playerName = playerName.replace(new RegExp(`^${grade}\\s+|\\s+${grade}$`), '').trim();
        // Log détaillé désactivé
        // console.log(`👤 Nom du joueur (nettoyé): ${playerName}`);
        break;
      }
    }

    // Récupérer l'image du profil (avatar Pactify)
    const avatarImg = $('img[alt*="avatar"]').first();
    if (avatarImg.length) {
      playerImageUrl = avatarImg.attr('src');
      // Log détaillé désactivé
      // console.log(`🖼️  Image du joueur trouvée: ${playerImageUrl}`);
    } else {
      console.warn(`⚠️  Impossible de trouver l'image du profil`);
    }

    // Chercher tous les .dl-item pour les stats et le statut
    const dlItems = $('.dl-item');
    
    dlItems.each((i, element) => {
      const titleElement = $(element).find('.dl-title');
      const valueElement = $(element).find('.dl-value');
      
      const titleText = titleElement.text().trim();
      const valueText = valueElement.text().trim();
      
      // Log détaillé désactivé - voir logs résumés ci-dessous
      // console.log(`🔍 dl-item: titre="${titleText}" valeur="${valueText}"`);
      
      // Chercher "Dernière connexion" pour le statut
      if (titleText.includes('Dernière connexion')) {
        if (valueText.toLowerCase().includes('en ligne')) {
          playerStatus = 'online';
          inactivityText = valueText;
        } else if (valueText.includes('il y a') || valueText.includes('ago')) {
          playerStatus = 'inactive';
          inactivityText = valueText;
          daysInactive = parseInactivityText(inactivityText);
          return false; // break
        }
      }
      
      // Récupérer Power
      if (titleText.includes('Power')) {
        playerPower = valueText;
      }
      
      // Récupérer Faction
      if (titleText.includes('Faction')) {
        playerFaction = valueText;
      }
      
      // Récupérer Rôle
      if (titleText.includes('Rôle')) {
        playerRole = valueText;
      }
      
      // Récupérer Temps de jeu
      if (titleText.includes('Temps de jeu')) {
        playerGametime = valueText;
      }

      // Récupérer Date d'inscription
      if (titleText.includes('Inscription') || titleText.includes('Date d\'inscription')) {
        playerInscriptionDate = valueText;
      }
    });

    if (inactivityText === null) {
      console.warn(`⚠ Impossible de trouver "Dernière connexion" pour ${url}`);
      return {
        success: false,
        daysInactive: 0,
        status: 'unknown',
        rawText: null,
        playerImageUrl: playerImageUrl,
        playerName,
        playerPower,
        playerFaction,
        playerRole,
        playerGrade,
        playerGametime,
        inscriptionDate: playerInscriptionDate,
        error: 'Statut introuvable'
      };
    }

    return {
      success: true,
      status: playerStatus,
      daysInactive: playerStatus === 'online' ? 0 : daysInactive,
      rawText: inactivityText,
      playerImageUrl: playerImageUrl,
      playerName,
      playerPower,
      playerFaction,
      playerRole,
      playerGrade,
      playerGametime,
      inscriptionDate: playerInscriptionDate,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    console.error(`❌ Erreur scraping pour ${url}:`, error.message);
    return {
      success: false,
      daysInactive: 0,
      status: 'unknown',
      rawText: null,
      playerImageUrl: null,
      playerName: null,
      playerPower: null,
      playerFaction: null,
      playerRole: null,
      playerGrade: 'Guerrier',
      playerGametime: null,
      inscriptionDate: null,
      error: error.message
    };
  }
}

/**
 * Format days (decimal) to readable string
 */
export function formatDays(days) {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours}h`;
  }
  return `${Math.floor(days)}d`;
}

/**
 * Chercher une faction sur Pactify par son nom (en scrapant les pages /factions)
 */
export async function searchFactionOnPactify(factionName) {
  try {
    const lowerName = factionName.toLowerCase();
    const maxPages = 5; // Chercher sur les 5 premières pages
    
    for (let page = 1; page <= maxPages; page++) {
      try {
        const pageUrl = page === 1 ? 'https://www.pactify.fr/factions' : `https://www.pactify.fr/factions?page=${page}`;
        
        const response = await pactifyRequest(pageUrl);

        const $ = cheerio.load(response.data);
        
        // Chercher un lien contenant le nom de la faction (case-insensitive)
        let foundUrl = null;
        
        $('a').each((i, element) => {
          const linkText = $(element).text().trim();
          const href = $(element).attr('href');
          
          if (linkText.toLowerCase() === lowerName && href && href.includes('/faction/')) {
            foundUrl = `https://www.pactify.fr${href}`;
            console.log(`🔍 Faction trouvée page ${page}: "${factionName}" → ${foundUrl}`);
            return false; // break
          }
        });

        if (foundUrl) {
          return foundUrl;
        }
      } catch (pageError) {
        console.warn(`⚠️ Erreur scrape page ${page}:`, pageError.message);
        continue;
      }
    }

    // Silencieusement retourner null si non trouvé
    return null;
  } catch (error) {
    console.error(`❌ Erreur recherche faction "${factionName}":`, error.message);
    return null;
  }
}

/**
 * Scraper le profil Pactify d'une faction et récupérer ses infos
 */
export async function scrapePactifyFaction(url) {
  const startTime = Date.now();
  console.time('[FSAVE] scrapePactifyFaction');
  console.log('[FSAVE] ========== START FACTION SCRAPE ==========');
  console.log('[FSAVE] URL received:', url);

  try {
    // Validate URL format
    if (!url.includes('pactify.fr/faction/')) {
      console.error('[FSAVE] ❌ Invalid URL format (not a faction URL)');
      return {
        success: false,
        factionName: null,
        error: 'Invalid faction URL format'
      };
    }
    console.log('[FSAVE] ✅ URL format valid');

    // Perform request with strict timeout
    console.log('[FSAVE] Fetching Pactify faction page...');
    const response = await pactifyRequest(url, {}, 10000);
    
    if (!response || !response.data) {
      console.error('[FSAVE] ❌ Empty response from Pactify');
      return {
        success: false,
        factionName: null,
        error: 'Pactify returned empty response'
      };
    }
    console.log('[FSAVE] ✅ Response received:', response.data.length, 'bytes');

    // Parse HTML
    console.log('[FSAVE] Parsing HTML...');
    const $ = cheerio.load(response.data);
    
    if (!$) {
      console.error('[FSAVE] ❌ Failed to parse HTML');
      return {
        success: false,
        factionName: null,
        error: 'Failed to parse HTML response'
      };
    }
    console.log('[FSAVE] ✅ HTML parsed successfully');
    
    // Stats de la faction
    let factionName = null;
    let factionPower = null;
    let factionMembers = null;
    let factionAllies = 0;
    let factionClaims = null;
    let factionImageUrl = null;
    let factionCreationDate = null;

    // Récupérer le nom de la faction (depuis le titre de la page ou un h1)
    console.log('[FSAVE] Extracting faction name...');
    const h1Element = $('h1').first();
    let pageTitle = h1Element.text().trim();
    let factionEmoji = null;
    
    if (pageTitle || h1Element.length > 0) {
      // L'emoji est probablement dans une img ou span, pas dans le texte
      // Chercher une img avec alt contenant un emoji
      const imgElement = h1Element.find('img').first();
      if (imgElement.length > 0) {
        const alt = imgElement.attr('alt');
        if (alt) {
          const altRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
          const altEmojis = alt.match(altRegex);
          if (altEmojis && altEmojis.length > 0) {
            factionEmoji = altEmojis[0];
          }
        }
      }
      
      // Chercher aussi un span avec classe emoji
      if (!factionEmoji) {
        const spans = h1Element.find('span');
        for (let i = 0; i < spans.length; i++) {
          const spanText = $(spans[i]).text().trim();
          const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
          const spanEmojis = spanText.match(emojiRegex);
          if (spanEmojis && spanEmojis.length > 0) {
            factionEmoji = spanEmojis[0];
            break;
          }
        }
      }
      
      // Nettoyer le nom (retirer les espaces superflus)
      factionName = pageTitle.trim();
      console.log('[FSAVE] ✅ Faction name extracted:', factionName);
    } else {
      console.warn('[FSAVE] ⚠️  No h1 element found for faction name');
    }

    // Récupérer l'image du profil (avatar Pactify)
    console.log('[FSAVE] Searching for faction image...');
    const avatarImg = $('img[alt*="avatar"], img[alt*="logo"]').first();
    if (avatarImg.length) {
      factionImageUrl = avatarImg.attr('src');
      console.log('[FSAVE] ✅ Faction image found:', factionImageUrl);
    } else {
      console.warn('[FSAVE] ⚠️  No faction image found');
    }

    // Chercher tous les .dl-item pour les stats
    console.log('[FSAVE] Extracting faction stats...');
    const dlItems = $('.dl-item');
    console.log('[FSAVE] Found', dlItems.length, 'stat items');
    
    dlItems.each((i, element) => {
      const titleElement = $(element).find('.dl-title');
      const valueElement = $(element).find('.dl-value');
      
      const titleText = titleElement.text().trim();
      const valueText = valueElement.text().trim();
      
      console.log(`[FSAVE] Stat ${i}: "${titleText}" = "${valueText}"`);
      
      // Récupérer Power
      if (titleText.includes('Power')) {
        factionPower = valueText;
        console.log('[FSAVE] ✅ Power found:', factionPower);
      }
      
      // Récupérer Membres
      if (titleText.includes('Membres') || titleText.includes('Members')) {
        factionMembers = valueText;
        console.log('[FSAVE] ✅ Members found:', factionMembers);
      }
      
      // Récupérer Claims
      if (titleText.includes('Claims') || titleText.includes('Revendications')) {
        factionClaims = valueText;
        console.log('[FSAVE] ✅ Claims found:', factionClaims);
      }
      
      // Récupérer Date de création
      if (titleText.includes('Création') || titleText.includes('Date de création')) {
        factionCreationDate = valueText;
        console.log('[FSAVE] ✅ Creation date found:', factionCreationDate);
      }
    });

    // Extraire les noms des alliés depuis la section "Alliés"
    console.log('[FSAVE] Extracting allies...');
    const alliesList = [];
    const alliesTitleElement = Array.from($('.dl-title')).find(el => $(el).text().includes('Alliés'));
    
    if (alliesTitleElement) {
      const alliesValueElement = $(alliesTitleElement).closest('.dl-item').find('.dl-value');
      
      // Pour chaque lien de faction alliée
      const links = alliesValueElement.find('a[href*="/faction/"]');
      console.log('[FSAVE] Found', links.length, 'ally links');
      
      links.each((i, element) => {
        const fullText = $(element).text().trim();
        
        // Retirer les emojis du texte
        const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
        const cleanedName = fullText.replace(emojiRegex, '').trim().replace(/[",]/g, '').trim();
        
        if (cleanedName && !alliesList.includes(cleanedName)) {
          alliesList.push(cleanedName);
          console.log('[FSAVE] ✅ Ally added:', cleanedName);
        }
      });
    } else {
      console.log('[FSAVE] ℹ️  No allies section found');
    }
    
    const factionAlliesList = alliesList.join(', ') || '';
    console.log('[FSAVE] ✅ Total allies:', alliesList.length);

    const duration = Date.now() - startTime;
    console.log('[FSAVE] ========== SUCCESS (', duration, 'ms) ==========');
    console.timeEnd('[FSAVE] scrapePactifyFaction');

    return {
      success: true,
      factionName: factionName || 'Unknown',
      factionEmoji: factionEmoji || null,
      factionPower: factionPower || 'N/A',
      factionMembers: factionMembers || '0',
      factionClaims: factionClaims || '0',
      factionAlliesList: factionAlliesList,
      factionImageUrl: factionImageUrl || null,
      factionCreationDate: factionCreationDate || 'N/A',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[FSAVE] ❌ ========== ERROR (', duration, 'ms) ==========');
    console.error('[FSAVE] Error type:', error.code || error.name);
    console.error('[FSAVE] Error message:', error.message);
    console.error('[FSAVE] Full error:', error);
    console.timeEnd('[FSAVE] scrapePactifyFaction');

    return {
      success: false,
      factionName: null,
      factionPower: null,
      factionMembers: null,
      factionClaims: null,
      factionAllies: 0,
      factionImageUrl: null,
      factionCreationDate: null,
      error: error.message || 'Unknown scraping error'
    };
  }
}
