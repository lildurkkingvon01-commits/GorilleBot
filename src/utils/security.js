import { addAuditLog, getAuditLogs } from './database.js';

let db = null;

export function setSecurityDb(database) {
  db = database;
}

// ==================== VALIDATION DES IDS ====================

export async function validateGuildId(guildId) {
  if (!guildId || typeof guildId !== 'string' || guildId.length < 15) {
    return false;
  }
  return /^\d+$/.test(guildId);
}

export async function validateUserId(userId) {
  if (!userId || typeof userId !== 'string' || userId.length < 15) {
    return false;
  }
  return /^\d+$/.test(userId);
}

export async function validateRoleId(guildId, roleId, interaction) {
  if (!roleId || typeof roleId !== 'string' || roleId.length < 15) {
    return false;
  }
  if (!/^\d+$/.test(roleId)) {
    return false;
  }
  
  // Vérifier que le rôle existe réellement
  try {
    const role = await interaction.guild.roles.fetch(roleId);
    return !!role;
  } catch (e) {
    return false;
  }
}

export async function validateUserInGuild(guildId, userId, interaction) {
  if (!userId || typeof userId !== 'string' || userId.length < 15) {
    return false;
  }
  if (!/^\d+$/.test(userId)) {
    return false;
  }
  
  // Vérifier que l'utilisateur existe réellement
  try {
    const member = await interaction.guild.members.fetch(userId);
    return !!member;
  } catch (e) {
    return false;
  }
}

// ==================== AUDIT LOGS ====================

export async function logAudit(guildId, userId, action, details) {
  try {
    const {
      commandName = null,
      targetId = null,
      targetType = null,
      status = 'success',
      errorMsg = null
    } = details || {};

    await addAuditLog(guildId, userId, action, {
      commandName,
      targetId,
      targetType,
      status,
      errorMsg
    });
    
    console.log(`[AUDIT] ${userId} → ${action} (${status})`);
  } catch (error) {
    console.error('Error logging audit:', error);
  }
}

// ==================== RATE LIMITING ====================

const rateLimitMap = new Map(); // { "userId": { count, resetTime } }
const RATE_LIMIT_WINDOW = 60000; // 1 minute en ms
const RATE_LIMIT_MAX = 20; // max 20 requêtes/minute

export function checkRateLimit(userId) {
  const now = Date.now();
  
  if (!rateLimitMap.has(userId)) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  const userLimit = rateLimitMap.get(userId);
  
  // Réinitialiser la fenêtre si expirée
  if (now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  // Vérifier limite
  if (userLimit.count >= RATE_LIMIT_MAX) {
    const resetIn = Math.ceil((userLimit.resetTime - now) / 1000);
    return { 
      allowed: false, 
      remaining: 0,
      resetIn: resetIn
    };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count };
}

// Nettoyer les vieilles entrées tous les 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of rateLimitMap.entries()) {
    if (now > data.resetTime + 60000) {
      rateLimitMap.delete(userId);
    }
  }
}, 300000);
