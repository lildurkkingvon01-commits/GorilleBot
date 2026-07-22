/**
 * Auto-Moderation Manager - Phase 4.2
 * Détection flood/spam/mentions excessives/liens interdits/mots-clés
 */

import db from './postgres.js';

const violationCache = new Map(); // {guildId:userId: [messageTimestamps]}
const messageContentCache = new Map(); // {guildId:userId: [recent messages]}

// Expressions régulières pour détection
const DISCORD_INVITE_PATTERN = /(https?:\/\/)?(discord\.gg|discordapp\.com|discord\.com)\/[A-Za-z0-9-_]+/gi;
const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;
const REPEATED_CHARS_PATTERN = /(.)\1{4,}/g;

/**
 * Load automod config for guild
 */
export async function getAutomodConfig(guildId) {
  try {
    const configs = await db.any(
      'SELECT setting_key, setting_value FROM automod_config WHERE guild_id = $1',
      [guildId]
    );
    
    const result = {};
    configs.forEach(c => {
      result[c.setting_key] = c.setting_value;
    });
    
    return result;
  } catch (error) {
    console.error('[AutomodManager] Error loading config:', error);
    return {};
  }
}

/**
 * Set automod setting
 */
export async function setAutomodSetting(guildId, key, value) {
  try {
    await db.none(
      `INSERT INTO automod_config (guild_id, setting_key, setting_value, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (guild_id, setting_key)
       DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
      [guildId, key, value]
    );
    
    return true;
  } catch (error) {
    console.error('[AutomodManager] Error setting config:', error);
    return false;
  }
}

/**
 * Check for flood (too many messages in short time)
 */
export async function checkFlood(guildId, userId, config = {}) {
  try {
    const floodLimit = parseInt(config.flood_messages || '10');
    const floodWindow = parseInt(config.flood_window || '5000'); // 5 seconds
    const floodEnabled = config.flood_enabled !== 'false';
    
    if (!floodEnabled) return { isViolation: false };
    
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    
    if (!violationCache.has(key)) {
      violationCache.set(key, []);
    }
    
    const timestamps = violationCache.get(key);
    
    // Remove old timestamps
    const filtered = timestamps.filter(t => now - t < floodWindow);
    filtered.push(now);
    violationCache.set(key, filtered);
    
    if (filtered.length > floodLimit) {
      // Log violation
      await logViolation(guildId, null, userId, 'flood', '', 'muted');
      return { isViolation: true, type: 'flood', messages: filtered.length };
    }
    
    return { isViolation: false };
  } catch (error) {
    console.error('[AutomodManager] Error checking flood:', error);
    return { isViolation: false };
  }
}

/**
 * Check for spam (repeated characters/words)
 */
export async function checkSpam(guildId, userId, content, config = {}) {
  try {
    const spamEnabled = config.spam_enabled !== 'false';
    if (!spamEnabled) return { isViolation: false };
    
    const spamThreshold = parseInt(config.spam_threshold || '0.7'); // 70% repeated
    
    // Check for repeated characters
    const charPattern = /(.)\1{4,}/g;
    if (charPattern.test(content)) {
      await logViolation(guildId, null, userId, 'spam_chars', content.substring(0, 100), 'warned');
      return { isViolation: true, type: 'spam_chars' };
    }
    
    // Check for repeated words
    const words = content.toLowerCase().split(/\s+/);
    if (words.length > 0) {
      const uniqueWords = new Set(words).size;
      const repetitionRatio = 1 - (uniqueWords / words.length);
      
      if (repetitionRatio > spamThreshold) {
        await logViolation(guildId, null, userId, 'spam_words', content.substring(0, 100), 'warned');
        return { isViolation: true, type: 'spam_words', ratio: repetitionRatio };
      }
    }
    
    return { isViolation: false };
  } catch (error) {
    console.error('[AutomodManager] Error checking spam:', error);
    return { isViolation: false };
  }
}

/**
 * Check for mention spam
 */
export async function checkMentionSpam(guildId, userId, mentions, config = {}) {
  try {
    const mentionEnabled = config.mention_enabled !== 'false';
    if (!mentionEnabled) return { isViolation: false };
    
    const mentionLimit = parseInt(config.mention_limit || '5');
    
    if (mentions > mentionLimit) {
      await logViolation(guildId, null, userId, 'mention_spam', `${mentions} mentions`, 'removed_message');
      return { isViolation: true, type: 'mention_spam', mentions };
    }
    
    return { isViolation: false };
  } catch (error) {
    console.error('[AutomodManager] Error checking mentions:', error);
    return { isViolation: false };
  }
}

/**
 * Check for invite links
 */
export async function checkInvites(guildId, userId, content, config = {}) {
  try {
    const inviteEnabled = config.invite_enabled !== 'false';
    if (!inviteEnabled) return { isViolation: false };
    
    const invitePattern = /(discord\.gg|discordapp\.com|discord\.com)\/[A-Za-z0-9-_]+/gi;
    
    if (invitePattern.test(content)) {
      await logViolation(guildId, null, userId, 'invite_spam', content.substring(0, 100), 'removed_message');
      return { isViolation: true, type: 'invite_spam' };
    }
    
    return { isViolation: false };
  } catch (error) {
    console.error('[AutomodManager] Error checking invites:', error);
    return { isViolation: false };
  }
}

/**
 * Log a violation
 */
export async function logViolation(guildId, channelId, userId, violationType, content = '', actionTaken = 'logged') {
  try {
    await db.none(
      `INSERT INTO automod_violations (guild_id, channel_id, user_id, violation_type, message_content, action_taken)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [guildId, channelId || 'unknown', userId, violationType, content, actionTaken]
    );
    
    return true;
  } catch (error) {
    console.error('[AutomodManager] Error logging violation:', error);
    return false;
  }
}

/**
 * Get violation statistics
 */
export async function getViolationStats(guildId, days = 7) {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await db.any(
      `SELECT violation_type, COUNT(*) as count 
       FROM automod_violations 
       WHERE guild_id = $1 AND created_at > $2
       GROUP BY violation_type`,
      [guildId, since]
    );
    
    return result;
  } catch (error) {
    console.error('[AutomodManager] Error getting stats:', error);
    return [];
  }
}

/**
 * Get recent violations
 */
export async function getRecentViolations(guildId, limit = 50) {
  try {
    return await db.any(
      `SELECT * FROM automod_violations 
       WHERE guild_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [guildId, limit]
    );
  } catch (error) {
    console.error('[AutomodManager] Error getting violations:', error);
    return [];
  }
}

/**
 * Clear cache for user
 */
export function clearUserCache(guildId, userId) {
  const key = `${guildId}:${userId}`;
  violationCache.delete(key);
}

// ==================== FONCTIONS MANQUANTES ====================

/**
 * Detect spam (repeated messages, characters)
 * Compatibilité: detectSpam(guildId, userId, content, config)
 */
export async function detectSpam(guildId, userId, content, config = {}) {
  try {
    const spamEnabled = config.spam_enabled !== 'false';
    if (!spamEnabled) return { isViolation: false };
    
    // Check for repeated characters (aaaaa, bbbbb)
    if (REPEATED_CHARS_PATTERN.test(content)) {
      await logViolation(guildId, null, userId, 'spam_chars', content.substring(0, 100), 'removed_message');
      return { isViolation: true, reason: 'Repeated characters detected' };
    }
    
    // Check for repeated words
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length > 2) {
      const uniqueWords = new Set(words).size;
      const repetitionRatio = 1 - (uniqueWords / words.length);
      
      if (repetitionRatio > 0.7) { // 70% repeated words = spam
        await logViolation(guildId, null, userId, 'spam_words', content.substring(0, 100), 'removed_message');
        return { isViolation: true, reason: `Repeated words (${Math.round(repetitionRatio * 100)}%)` };
      }
    }
    
    return { isViolation: false };
  } catch (error) {
    console.error('[AutomodManager] detectSpam Error:', error);
    return { isViolation: false };
  }
}

/**
 * Detect mention spam
 * Compatibilité: detectMentionSpam(guildId, userId, Collection<mentions>, config)
 */
export async function detectMentionSpam(guildId, userId, mentions, config = {}) {
  try {
    const mentionEnabled = config.mention_enabled !== 'false';
    if (!mentionEnabled) return { isViolation: false };
    
    const mentionLimit = parseInt(config.mention_limit || '5');
    const mentionCount = mentions.size || mentions || 0;
    
    if (mentionCount > mentionLimit) {
      await logViolation(guildId, null, userId, 'mention_spam', `${mentionCount} mentions`, 'removed_message');
      return { isViolation: true, reason: `Too many mentions: ${mentionCount}/${mentionLimit}` };
    }
    
    return { isViolation: false };
  } catch (error) {
    console.error('[AutomodManager] detectMentionSpam Error:', error);
    return { isViolation: false };
  }
}

/**
 * Detect banned links (invites, external URLs)
 */
export async function detectBannedLinks(guildId, content, config = {}) {
  try {
    const linkEnabled = config.links_enabled !== 'false';
    if (!linkEnabled) return { isViolation: false };
    
    // Check for Discord invites
    if (DISCORD_INVITE_PATTERN.test(content)) {
      return { isViolation: true, reason: 'Discord invite link detected' };
    }
    
    // Check for general URLs
    const urlEnabled = config.urls_allowed === 'false';
    if (urlEnabled && URL_PATTERN.test(content)) {
      return { isViolation: true, reason: 'External URL detected (not allowed)' };
    }
    
    return { isViolation: false };
  } catch (error) {
    console.error('[AutomodManager] detectBannedLinks Error:', error);
    return { isViolation: false };
  }
}

/**
 * Detect banned keywords
 */
export async function detectBannedKeywords(guildId, content, config = {}) {
  try {
    const keywordEnabled = config.keywords_enabled !== 'false';
    if (!keywordEnabled) return { isViolation: false };
    
    // Get banned keywords from config
    let bannedKeywords = config.banned_keywords || '';
    if (typeof bannedKeywords === 'string') {
      bannedKeywords = bannedKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
    }
    
    if (!bannedKeywords || bannedKeywords.length === 0) {
      return { isViolation: false };
    }
    
    const lowerContent = content.toLowerCase();
    
    for (const keyword of bannedKeywords) {
      if (lowerContent.includes(keyword)) {
        await logViolation(guildId, null, null, 'banned_keyword', keyword, 'removed_message');
        return { isViolation: true, reason: `Banned keyword detected` };
      }
    }
    
    return { isViolation: false };
  } catch (error) {
    console.error('[AutomodManager] detectBannedKeywords Error:', error);
    return { isViolation: false };
  }
}

/**
 * ================================================================
 */

export default {
  getAutomodConfig,
  setAutomodSetting,
  checkFlood,
  checkSpam,
  checkMentionSpam,
  checkInvites,
  logViolation,
  getViolationStats,
  getRecentViolations,
  clearUserCache
};
