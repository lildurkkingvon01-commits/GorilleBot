/**
 * Dashboard Formatter Service
 * Formats raw DB data into clean UI-ready responses
 */

import { PrismaClient } from '@prisma/client';
import { isDiscordSnowflake } from '@/utils/validators';

const prisma = new PrismaClient();

// Action type labels in French
const ACTION_LABELS: Record<string, string> = {
  // Moderation
  'GUILD_BANNED': 'Serveur banni',
  'GUILD_UNBAN': 'Serveur débanni',
  'USER_BANNED': 'Utilisateur banni',
  'USER_UNBANNED': 'Utilisateur débanni',
  'guild_banned': 'Serveur banni',
  'guild_unbanned': 'Serveur débanni',
  
  // Maintenance/Commands
  'COMMAND_ENABLE': 'Commande activée',
  'COMMAND_DISABLE': 'Commande désactivée',
  
  // We exclude COMMAND_USED from audit stats (counted in command_logs instead)
  'COMMAND_USED': 'Commande utilisée',
  'command_used': 'Commande utilisée',
  'command_executed': 'Commande utilisée',
};

// Badge color mapping by action type (centralized, no random/index-based colors)
// Maps to StatusBadge tone: "success" (green) | "danger" (red) | "warning" (orange/yellow) | "neutral" (gray/blue)
const ACTION_TONES: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  // Moderation
  'GUILD_BANNED': 'danger',           // red
  'GUILD_UNBAN': 'success',           // green
  'guild_banned': 'danger',           // red
  'guild_unbanned': 'success',        // green
  'USER_BANNED': 'danger',            // red
  'USER_UNBANNED': 'success',         // green
  
  // Maintenance
  'COMMAND_ENABLE': 'success',               // green
  'COMMAND_DISABLE': 'danger',               // red
  
  // Commands
  'COMMAND_USED': 'neutral',          // neutral/blue
  'command_used': 'neutral',          // neutral/blue
  'command_executed': 'neutral',      // neutral/blue
};

/**
 * Parse guild unban/other action details (JSON or text format)
 * Handles: {"guild_id":"xxx","guild_name":null} or "Guild xxx unbanned"
 */
function parseGuildActionDetails(details: string | null | undefined): { guildId: string | null; guildName: string | null } {
  if (!details || !details.trim()) {
    return { guildId: null, guildName: null };
  }

  // Try JSON format first: {"guild_id":"xxx","guild_name":"yyy"}
  try {
    const parsed = JSON.parse(details);
    if (parsed.guild_id) {
      return {
        guildId: parsed.guild_id,
        guildName: parsed.guild_name || null,
      };
    }
  } catch {
    // Not JSON, try text format
  }

  // Try text format: "Guild 1491303267211153448 unbanned"
  const idMatch = details.match(/\b(\d{17,20})\b/);
  const guildId = idMatch?.[1] || null;

  return { guildId, guildName: null };
}

/**
 * Parse guild ban details text
 * Input: "Banned 1491303267211153448. Reason: Fondateur"
 * Output: { guildId, reason }
 */
function parseGuildBanDetails(details: string | null | undefined): { guildId: string | null; reason: string } {
  if (!details || !details.trim()) {
    return { guildId: null, reason: '' };
  }

  // Extract guild ID (17-20 digit Snowflake)
  const idMatch = details.match(/\b(\d{17,20})\b/);
  const guildId = idMatch?.[1] || null;

  // Extract reason from "Reason: xxx" format
  let reason = '';
  const reasonMatch = details.match(/Reason:\s*(.+?)(?:\s*\(\d{17,20}\))?$/i);
  if (reasonMatch) {
    reason = reasonMatch[1].trim();
    // Remove trailing ID if present
    reason = reason.replace(/\s*\(\d{17,20}\)\s*$/, '').trim();
  }

  return { guildId, reason };
}

/**
 * Resolve guild name from multiple sources
 */
function resolveGuildName(guildId: string, targetName: string | null | undefined, details: string | null | undefined, guildNameMap?: Map<string, string>): string {
  // Priority 1: audit_logs.target_name (primary source)
  if (targetName && targetName.trim()) {
    return targetName.trim();
  }

  // Priority 2: guildNameMap (pre-fetched names)
  const mappedName = guildNameMap?.get(guildId);
  if (mappedName) {
    return mappedName;
  }

  // Priority 3: Extract from details if format "Guild Name (ID)" or "Banned: GuildName"
  if (details && typeof details === 'string') {
    // Try format: "GuildName (123456789)" 
    const match1 = details.match(/^(.+?)\s*\(\d{17,20}\)$/);
    if (match1) return match1[1].trim();

    // Try format: "Banned 123456789. Reason: ..." - extract guild name if present
    const match2 = details.match(/^([^(]+)(?:\(|$)/);
    if (match2) {
      const text = match2[1].trim();
      // Skip if it's just an ID
      if (!/^\d{17,20}$/.test(text)) {
        return text;
      }
    }
  }

  // Fallback: Unknown
  return 'Serveur inconnu';
}

/**
 * Format audit log entry into UI-ready activity
 * Returns structured data: actionLabel, tone, title, subtitle, details, actorLabel, createdAt (ISO UTC)
 * 
 * NEVER returns raw JSON or unparsed details
 * Frontend will format createdAt with proper timezone handling
 */
export function formatAuditLogForUI(auditLog: any, usernameMap?: Map<string, string>, guildNameMap?: Map<string, string>) {
  // Skip command_used entries - counted separately in command_logs
  if (
    auditLog.action === 'command_used' ||
    auditLog.action === 'COMMAND_USED' ||
    auditLog.action === 'command_executed'
  ) {
    return null;
  }

  const actorLabel = `Par: ${usernameMap?.get(auditLog.user_id) || `User #${auditLog.user_id?.slice(-4)}` || 'Unknown'}`;

  const actionLabel = ACTION_LABELS[auditLog.action] || 
                     auditLog.action.replace(/_/g, ' ').toLowerCase();

  const tone = ACTION_TONES[auditLog.action] || 'neutral';
  
  // FIX: Database stores "timestamp without time zone" which Prisma treats as UTC
  // But the actual value is LOCAL time (e.g., stored as 17:05 local)
  // Prisma Date interprets this 17:05 as UTC, creating a timestamp for 17:05 UTC
  // To get the correct local time, we need to adjust backwards by the timezone offset
  // getTimezoneOffset() returns -120 for UTC+2 (Belgium)
  // We ADD the offset (add negative number = subtract) to convert from UTC interpretation to local
  const date = auditLog.created_at instanceof Date ? auditLog.created_at : new Date(auditLog.created_at);
  const offset = date.getTimezoneOffset() * 60 * 1000; // -7200000 ms in Belgium
  const createdAt = date.getTime() + offset; // Add negative offset = subtract 7200000

  // Parse based on action type
  let title = '';
  let subtitle = '';
  let details = '';

  const action = auditLog.action?.toUpperCase() || '';

  // ===== GUILD BAN ACTIONS =====
  if (action.includes('GUILD_BAN')) {
    const parsed = parseGuildBanDetails(auditLog.details);
    const guildId = parsed.guildId || auditLog.target_id;
    const guildName = guildId ? (guildNameMap?.get(guildId) || 'Serveur inconnu') : 'Serveur inconnu';

    title = guildName;
    subtitle = guildId ? `ID: ${guildId}` : '';
    details = parsed.reason ? `Raison: ${parsed.reason}` : '';
  }

  // ===== GUILD UNBAN ACTIONS =====
  else if (action.includes('GUILD_UNBAN') || action === 'GUILD_UNBAN') {
    const parsed = parseGuildActionDetails(auditLog.details);
    const guildId = parsed.guildId || auditLog.target_id;
    
    // Try to get name from map or from parsed details
    let guildName = '';
    if (parsed.guildName) {
      guildName = parsed.guildName;
    } else if (guildId) {
      guildName = guildNameMap?.get(guildId) || 'Serveur inconnu';
    } else {
      guildName = 'Serveur inconnu';
    }

    title = guildName;
    subtitle = guildId ? `ID: ${guildId}` : '';
    details = '';
  }

  // ===== USER BAN ACTIONS =====
  else if (action.includes('USER_BAN') || action.includes('USER_BANNED')) {
    const userId = auditLog.target_id;
    const userName = userId ? (usernameMap?.get(userId) || `User #${userId.slice(-4)}`) : 'Utilisateur inconnu';
    
    title = userName;
    subtitle = userId ? `ID: ${userId}` : '';
    details = '';
  }

  // ===== USER UNBAN ACTIONS =====
  else if (action.includes('USER_UNBAN') || action.includes('USER_UNBANNED')) {
    const userId = auditLog.target_id;
    const userName = userId ? (usernameMap?.get(userId) || `User #${userId.slice(-4)}`) : 'Utilisateur inconnu';
    
    title = userName;
    subtitle = userId ? `ID: ${userId}` : '';
    details = '';
  }

  // ===== WHITELIST ACTIONS =====
  else if (action.includes('WHITELIST')) {
    const entry = auditLog.target_name || auditLog.target_id || auditLog.details || 'Entrée';
    title = entry;
    subtitle = '';
    details = '';
  }

  // ===== BACKUP ACTIONS =====
  else if (action.includes('BACKUP')) {
    const backupId = auditLog.target_id || auditLog.details || 'Sauvegarde';
    title = backupId;
    subtitle = '';
    const actionType = actionLabel.toLowerCase();
    details = actionType ? `Action: ${actionType}` : '';
  }

  // ===== PERMISSION ACTIONS =====
  else if (action.includes('PERMISSION') || action.includes('PERM')) {
    const target = auditLog.target_name || auditLog.target_id || 'Permissions';
    title = target;
    subtitle = '';
    const actionType = actionLabel.toLowerCase();
    details = actionType ? `Action: ${actionType}` : '';
  }

  // ===== BOT_EXPELLED ACTIONS =====
  else if (action.includes('BOT_EXPELLED') || action.includes('EXPELLED')) {
    // Format: "From guild: Serveur de LeBelge_e (1491303267211153448)"
    const nameMatch = auditLog.details?.match(/From guild:\s*(.+?)\s*\((\d{17,20})\)/);
    if (nameMatch) {
      const guildName = nameMatch[1].trim();
      const guildId = nameMatch[2];
      title = guildName;
      subtitle = `ID: ${guildId}`;
      details = '';
    } else {
      title = 'Bot expulsé';
      subtitle = '';
      details = '';
    }
  }

  // ===== GENERIC FALLBACK (NO JSON) =====
  else {
    // Never display raw JSON or unparsed details
    title = auditLog.target_name || 'Événement';
    subtitle = auditLog.target_id ? `ID: ${auditLog.target_id}` : '';
    details = '';
  }

  return {
    id: auditLog.id,
    actionLabel,
    tone,
    title,
    subtitle,
    details,
    actorLabel,
    createdAt,  // ISO UTC string for frontend to format with proper timezone
  };
}

/**
 * Summary dashboard response with UI-ready data
 */
export async function getDashboardSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ===== GUILDS & USERS =====
  // For activeGuilds: count all guilds where bot_present=true AND not banned
  const activeGuildsInDb = await prisma.guild.findMany({
    where: { bot_present: true },
    select: { id: true },
  });
  
  const bannedGuildIds = await prisma.bannedGuild.findMany({
    where: { active: true },
    select: { guild_id: true },
  });
  
  const bannedGuildSet = new Set(bannedGuildIds.map(b => b.guild_id));
  const activeGuildIds = activeGuildsInDb
    .map(g => g.id)
    .filter(id => !bannedGuildSet.has(id) && isDiscordSnowflake(id));

  // Get guilds with logs for totalGuildsCount (for stats - all guilds that ever had activity)
  const [commandGuilds, auditGuilds, commandUsers] = await Promise.all([
    prisma.commandLog.findMany({
      where: { guild_id: { not: null } },
      distinct: ['guild_id'],
      select: { guild_id: true },
    }),
    prisma.auditLog.findMany({
      where: { guild_id: { not: null } },
      distinct: ['guild_id'],
      select: { guild_id: true },
    }),
    prisma.commandLog.findMany({
      distinct: ['user_id'],
      select: { user_id: true },
    }),
  ]);

  const allGuildIds = new Set([
    ...commandGuilds.map(g => g.guild_id).filter(id => isDiscordSnowflake(id)),
    ...auditGuilds.map(g => g.guild_id).filter(id => isDiscordSnowflake(id)),
  ]);
  const validUsers = new Set(
    commandUsers.map(u => u.user_id).filter(id => isDiscordSnowflake(id))
  );

  // ===== COMMANDS: Real executions (NOT test commands, ONLY from ACTIVE + NOT banned servers) =====
  // Filter: WHERE guild_id IN (guilds WHERE bot_present=true) AND guild_id NOT IN (banned_guilds WHERE active=true)
  const allowedGuildIds = Array.from(activeGuildIds).filter((id): id is string => typeof id === 'string');
  
  const allCommandLogs = await prisma.commandLog.findMany({
    where: {
      guild_id: { in: allowedGuildIds }
    },
    select: { command_name: true, created_at: true },
  });

  const realCommands = allCommandLogs.filter(cmd => 
    cmd.command_name && 
    !cmd.command_name.startsWith('test_') &&
    !['test_command', 'test_error_cmd'].includes(cmd.command_name)
  );

  const totalCommandExecutions = realCommands.length;
  const todayCommands = realCommands.filter(c => c.created_at && c.created_at >= today).length;
  const weekCommands = realCommands.filter(c => c.created_at && c.created_at >= weekAgo).length;

  // ===== ACTIONS: Audit logs EXCLUDING command_used =====
  const auditLogs = await prisma.auditLog.findMany({
    select: { action: true, created_at: true },
  });

  const realActions = auditLogs.filter(a => 
    a.action !== 'command_used' && 
    a.action !== 'COMMAND_USED' &&
    a.action !== 'command_executed'
  );

  const totalAdminActions = realActions.length;
  const todayActions = realActions.filter(a => a.created_at && a.created_at >= today).length;
  const weekActions = realActions.filter(a => a.created_at && a.created_at >= weekAgo).length;

  // ===== BOT STATUS =====
  const uptime = process.uptime();
  const status = 'online'; // TODO: Get from bot connection

  // ===== TOP COMMANDS (Real, no tests, no nulls) =====
  const commandCounts = new Map<string, { raw: string; normalized: string; count: number }>();
  realCommands.forEach(cmd => {
    if (cmd.command_name && cmd.command_name.trim()) {
      const rawName = cmd.command_name.trim();
      // Normalize: ensure "/" prefix, handle spaces
      const normalized = rawName.startsWith('/') ? rawName : `/${rawName}`;
      
      if (!commandCounts.has(normalized)) {
        commandCounts.set(normalized, { raw: rawName, normalized, count: 0 });
      }
      const entry = commandCounts.get(normalized)!;
      entry.count += 1;
    }
  });

  const topCommands = Array.from(commandCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(cmd => ({
      name: cmd.normalized, // with "/"
      executions: cmd.count,
    }));

  // ===== TOP USERS (Valid only, ONLY from ACTIVE + NOT banned servers) =====
  const topCommandUsers = await prisma.commandLog.groupBy({
    by: ['user_id'],
    _count: { id: true },
    where: {
      // Only count commands from active, non-banned guilds
      guild_id: { in: allowedGuildIds }
    },
    orderBy: { _count: { id: 'desc' } },
    take: 50,
  });

  const userCounts = new Map<string, number>();
  topCommandUsers.forEach((u: any) => {
    if (u.user_id && isDiscordSnowflake(u.user_id)) {
      userCounts.set(u.user_id, u._count.id);
    }
  });

  // Get usernames
  const topUserIds = Array.from(userCounts.keys()).slice(0, 10);
  const userRecords = await prisma.commandLog.findMany({
    where: { user_id: { in: topUserIds } },
    distinct: ['user_id'],
    select: { user_id: true, username: true },
    orderBy: { created_at: 'desc' },
  });

  const usernameMap = new Map<string, string>();
  userRecords.forEach(u => {
    if (u.user_id && u.username) {
      usernameMap.set(u.user_id, u.username);
    }
  });

  const topUsers = Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, count]) => ({
      userId,
      username: usernameMap.get(userId) || `User #${userId.slice(-4)}`,
      userDisplay: `${usernameMap.get(userId) || `User #${userId.slice(-4)}`} (${userId})`,
      count,
    }));

  // ===== GUILD NAMES MAP =====
  // Get guild names from audit logs where target_name is filled
  const guildNamesFromAudit = await prisma.auditLog.findMany({
    where: { 
      target_name: { not: null }
    },
    select: { guild_id: true, target_id: true, target_name: true },
    take: 200,
  });

  const guildNameMap = new Map<string, string>();
  guildNamesFromAudit.forEach(entry => {
    if (entry.target_name && entry.target_name.trim()) {
      // Map both guild_id and target_id to the guild name
      if (entry.guild_id) {
        guildNameMap.set(entry.guild_id, entry.target_name);
      }
      if (entry.target_id) {
        guildNameMap.set(entry.target_id, entry.target_name);
      }
    }
  });

  // ===== RECENT ACTIVITY (Mixed, formatted) =====
  const recentActivityRaw = await prisma.auditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: 20,
  });

  const recentActivity = recentActivityRaw
    .map(audit => formatAuditLogForUI(audit, usernameMap, guildNameMap))
    .filter(a => a !== null)
    .slice(0, 10);

  return {
    cards: {
      commandExecutions: {
        label: 'Exécutions commandes',
        value: totalCommandExecutions,
        today: todayCommands,
        week: weekCommands,
      },
      adminActions: {
        label: 'Actions admin',
        value: totalAdminActions,
        today: todayActions,
        week: weekActions,
      },
      activeGuilds: {
        label: 'Serveurs actifs',
        value: activeGuildIds.length,
      },
      knownUsers: {
        label: 'Utilisateurs',
        value: validUsers.size,
      },
    },
    topCommands,
    topUsers,
    recentActivity,
    botStatus: {
      status,
      uptime: Math.floor(uptime),
      uptimeFormatted: formatUptime(uptime),
      latency: 0, // TODO: Get from bot connection
      version: process.env.BOT_VERSION || '3.8.1',
    },
  };
}

/**
 * Format uptime in readable format (EXPORTED for shared use)
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '< 1m';
}
