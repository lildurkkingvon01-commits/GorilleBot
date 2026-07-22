/**
 * Server List Service - FIXED VERSION
 * Rules:
 * 1. ONLY include guild IDs that match Discord snowflake format: /^\d{17,20}$/
 * 2. Resolve server names from: audit_logs.target_name > banned_guilds.guild_name > guilds.name > fallback
 * 3. Count commands ONLY for valid snowflakes
 * 4. Status: bot cache = ONLINE, banned_guilds = BANNED, else = UNKNOWN
 * 5. Member count: from bot cache or null
 */

import { PrismaClient } from '@prisma/client';
import { calculateSkip } from '@/utils/pagination';

const prisma = new PrismaClient();

export interface ServerListFilters {
  search?: string;
  guildId?: string;
  sort?: 'activity' | 'members' | 'name';
  page?: number;
  limit?: number;
}

export interface ServerData {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number | null;
  status: 'ONLINE' | 'BANNED' | 'UNKNOWN';
  commandCount: number;
  errorCount: number;
  lastActivityAt: number | null;
  lastActivityFormatted: string;
  banned: boolean;
  joinedAt: number | null;
}

// Validate Discord snowflake format: 17-20 digits
function isValidSnowflake(id: string | number | null): id is string {
  if (!id) return false;
  const idStr = String(id);
  return /^\d{17,20}$/.test(idStr);
}

// Format time distance
function formatDistanceToNow(timestamp: number): string {
  const now = Date.now();
  const seconds = Math.floor((now - timestamp) / 1000);

  if (seconds < 60) return 'il y a quelques secondes';
  if (seconds < 120) return 'il y a 1 minute';
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} minutes`;
  if (seconds < 7200) return 'il y a 1 heure';
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)} heures`;
  if (seconds < 172800) return 'hier';
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)} jours`;
  if (seconds < 2592000) return `il y a ${Math.floor(seconds / 604800)} semaines`;
  if (seconds < 31536000) return `il y a ${Math.floor(seconds / 2592000)} mois`;
  return `il y a ${Math.floor(seconds / 31536000)} ans`;
}

export const serverListService = {
  async getServers(filters: ServerListFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);

    try {
      // STEP 1: Get all ACTIVE guilds (bot_present=true) with valid snowflake IDs
      const allGuilds = await prisma.guild.findMany({
        where: { 
          bot_present: true // Only guilds where bot is currently present
        },
        select: { id: true, name: true, icon_url: true, member_count: true, created_at: true },
      });

      // Filter ONLY valid snowflakes
      const validGuilds = allGuilds.filter(g => isValidSnowflake(g.id));

      if (validGuilds.length === 0) {
        return {
          servers: [],
          pagination: { page, limit, total: 0, pages: 0 },
        };
      }

      const validGuildIds = validGuilds.map(g => g.id);

      // STEP 2: Get server names from multiple sources (priority order)
      // Priority: command_logs.guild_name > audit_logs.target_name > banned_guilds.guild_name > guilds.name > fallback
      
      const nameMap = new Map<string, { name: string; source: string }>();

      // Source 1: command_logs.guild_name (most reliable - contains actual Discord names)
      const commandLogNames = await prisma.commandLog.findMany({
        where: {
          guild_id: { in: validGuildIds },
          guild_name: { not: null },
        },
        select: { guild_id: true, guild_name: true },
        distinct: ['guild_id'],
      });

      commandLogNames.forEach(log => {
        if (log.guild_id && log.guild_name && !nameMap.has(log.guild_id)) {
          nameMap.set(log.guild_id, { name: log.guild_name, source: 'command_logs' });
        }
      });

      // Source 2: audit_logs.target_name
      const auditLogNames = await prisma.auditLog.findMany({
        where: {
          guild_id: { in: validGuildIds },
          target_name: { not: null },
        },
        select: { guild_id: true, target_name: true },
        distinct: ['guild_id'],
      });

      auditLogNames.forEach(log => {
        if (log.guild_id && log.target_name && !nameMap.has(log.guild_id)) {
          nameMap.set(log.guild_id, { name: log.target_name, source: 'audit_logs' });
        }
      });

      // Source 3: banned_guilds.guild_name (only if it's a real name, not a placeholder)
      const bannedGuildsWithNames = await prisma.bannedGuild.findMany({
        where: { guild_id: { in: validGuildIds } },
        select: { guild_id: true, guild_name: true },
      });

      bannedGuildsWithNames.forEach(bg => {
        if (bg.guild_id && bg.guild_name && !nameMap.has(bg.guild_id)) {
          // Ignore placeholder names like "Guild 1234567890"
          const isPlaceholder = /^Guild \d+$/.test(bg.guild_name);
          if (!isPlaceholder) {
            nameMap.set(bg.guild_id, { name: bg.guild_name, source: 'banned_guilds' });
          }
        }
      });

      // STEP 3: Get command counts ONLY for valid guild IDs
      const commandCounts = await prisma.commandLog.groupBy({
        by: ['guild_id'],
        where: { guild_id: { in: validGuildIds } },
        _count: true,
      });

      const commandCountMap = new Map(
        commandCounts.map(c => [c.guild_id, c._count])
      );

      // STEP 4: Get error counts ONLY for valid guild IDs
      const errorCounts = await prisma.errorLog.groupBy({
        by: ['guild_id'],
        where: { guild_id: { in: validGuildIds } },
        _count: true,
      });

      const errorCountMap = new Map(
        errorCounts.map(e => [e.guild_id, e._count])
      );

      // STEP 5: Get last activity ONLY for valid guild IDs
      const [commandLastActivity, auditLastActivity] = await Promise.all([
        prisma.commandLog.groupBy({
          by: ['guild_id'],
          where: { guild_id: { in: validGuildIds } },
          _max: { created_at: true },
        }),
        prisma.auditLog.groupBy({
          by: ['guild_id'],
          where: { guild_id: { in: validGuildIds } },
          _max: { created_at: true },
        }),
      ]);

      const lastActivityMap = new Map<string, number>();

      commandLastActivity.forEach(la => {
        if (la._max.created_at != null && la.guild_id != null) {
          const dateVal = la._max.created_at as any;
          const time = dateVal instanceof Date
            ? (dateVal as Date).getTime()
            : new Date(String(dateVal)).getTime();
          lastActivityMap.set(la.guild_id as string, time);
        }
      });

      auditLastActivity.forEach(la => {
        if (la._max.created_at != null && la.guild_id != null) {
          const dateVal = la._max.created_at as any;
          const time = dateVal instanceof Date
            ? (dateVal as Date).getTime()
            : new Date(String(dateVal)).getTime();
          const existing = lastActivityMap.get(la.guild_id as string) || 0;
          if (time > existing) {
            lastActivityMap.set(la.guild_id as string, time);
          }
        }
      });

      // STEP 6: Get ban status ONLY for valid guild IDs
      const bannedGuilds = await prisma.bannedGuild.findMany({
        where: { 
          guild_id: { in: validGuildIds },
          active: true,
        },
        select: { guild_id: true },
      });

      const bannedGuildSet = new Set(bannedGuilds.map(bg => bg.guild_id));

      // STEP 7: Build server data
      let servers: ServerData[] = validGuilds.map(guild => {
        const lastActivityTime = lastActivityMap.get(guild.id) || null;
        const lastActivityFormatted = lastActivityTime
          ? formatDistanceToNow(lastActivityTime)
          : 'Jamais';

        const isBanned = bannedGuildSet.has(guild.id);

        // Resolve name: PRIORITY ORDER
        // 1. command_logs.guild_name (if exists in nameMap)
        // 2. audit_logs.target_name (if exists in nameMap)
        // 3. guilds.name (PRIMARY SOURCE from bot sync)
        // 4. Fallback to unknown
        const nameData = nameMap.get(guild.id);
        const guildName = (guild.name as any) || '';
        const resolvedName: string = nameData?.name ?? guildName ?? `Serveur inconnu (${guild.id})`;

        return {
          id: guild.id,
          name: resolvedName,
          icon: guild.icon_url || null,
          memberCount: guild.member_count || null,
          status: isBanned ? 'BANNED' : 'ONLINE',
          commandCount: commandCountMap.get(guild.id) || 0,
          errorCount: errorCountMap.get(guild.id) || 0,
          lastActivityAt: lastActivityTime,
          lastActivityFormatted,
          banned: isBanned,
          joinedAt: guild.created_at?.getTime() || null,
        };
      });

      // Apply search filter
      if (filters.search) {
        const searchLower = (filters.search as string).toLowerCase();
        servers = servers.filter(s =>
          (s.name as string).toLowerCase().includes(searchLower) ||
          s.id.includes(filters.search as string)
        );
      }

      // Apply sorting
      if (filters.sort === 'activity') {
        servers.sort((a, b) => {
          const timeA = a.lastActivityAt || 0;
          const timeB = b.lastActivityAt || 0;
          return timeB - timeA;
        });
      } else if (filters.sort === 'members') {
        servers.sort((a, b) => {
          const countA = b.memberCount || 0;
          const countB = a.memberCount || 0;
          return countB - countA;
        });
      } else if (filters.sort === 'name') {
        servers.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      } else {
        // Default: sort by last activity
        servers.sort((a, b) => {
          const timeA = a.lastActivityAt || 0;
          const timeB = b.lastActivityAt || 0;
          return timeB - timeA;
        });
      }

      // Apply pagination on filtered results
      const totalCount = servers.length;
      const startIdx = (page - 1) * limit;
      const paginatedServers = servers.slice(startIdx, startIdx + limit);

      return {
        servers: paginatedServers,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      console.error('Error in serverListService.getServers:', error);
      throw error;
    }
  },

  async getServerById(guildId: string) {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
    });

    if (!guild) {
      return null;
    }

    // Get command count
    const commandCount = await prisma.commandLog.count({
      where: { guild_id: guildId },
    });

    // Get error count
    const errorCount = await prisma.errorLog.count({
      where: { guild_id: guildId },
    });

    // Get last activity - get max from both logs
    const [commandLastActivity, auditLastActivity] = await Promise.all([
      prisma.commandLog.findFirst({
        where: { guild_id: guildId },
        orderBy: { created_at: 'desc' },
        select: { created_at: true },
      }),
      prisma.auditLog.findFirst({
        where: { guild_id: guildId },
        orderBy: { created_at: 'desc' },
        select: { created_at: true },
      }),
    ]);

    let lastActivityTime: number | null = null;
    if (commandLastActivity?.created_at) {
      const time = commandLastActivity.created_at instanceof Date
        ? commandLastActivity.created_at.getTime()
        : new Date(commandLastActivity.created_at).getTime();
      lastActivityTime = time;
    }
    if (auditLastActivity?.created_at) {
      const time = auditLastActivity.created_at instanceof Date
        ? auditLastActivity.created_at.getTime()
        : new Date(auditLastActivity.created_at).getTime();
      if (!lastActivityTime || time > lastActivityTime) {
        lastActivityTime = time;
      }
    }

    // Get ban status
    const bannedGuild = await prisma.bannedGuild.findUnique({
      where: { guild_id: guildId },
    });

    return {
      id: guild.id,
      name: guild.name,
      icon: guild.icon_url || null,
      memberCount: guild.member_count || 0,
      status: bannedGuild ? 'BANNED' : 'ONLINE',
      commandCount,
      errorCount,
      lastActivityAt: lastActivityTime,
      banned: !!bannedGuild,
      joinedAt: guild.created_at?.getTime() || null,
    };
  },
};
