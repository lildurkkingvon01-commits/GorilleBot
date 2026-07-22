/**
 * Debug Service - Shows exact data sources for dashboard
 * TEMPORARY - For verification purposes only
 */

import { PrismaClient } from '@prisma/client';
import {
  isDiscordSnowflake,
  isTestCommand,
  getInvalidGuildIds,
  getInvalidUserIds,
} from '@/utils/validators';

const prisma = new PrismaClient();

export const debugService = {
  async getDashboardSources() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ===== GUILDS DATA =====
    const totalGuildTableRows = await prisma.guild.count();
    
    const commandLogsGuilds = await prisma.commandLog.findMany({
      where: { guild_id: { not: null } },
      distinct: ['guild_id'],
      select: { guild_id: true },
    });

    const auditLogsGuilds = await prisma.auditLog.findMany({
      where: { guild_id: { not: null } },
      distinct: ['guild_id'],
      select: { guild_id: true },
    });

    const allGuildIdSet = new Set<string | null>([
      ...commandLogsGuilds.map(g => g.guild_id),
      ...auditLogsGuilds.map(g => g.guild_id),
    ]);

    // Filter valid and invalid guild IDs
    const validGuildIds = new Set<string>();
    const invalidGuildIds = getInvalidGuildIds(allGuildIdSet);
    
    allGuildIdSet.forEach(id => {
      if (id && isDiscordSnowflake(id)) {
        validGuildIds.add(id);
      }
    });

    // ===== USERS DATA =====
    const commandLogsUsers = await prisma.commandLog.findMany({
      distinct: ['user_id'],
      select: { user_id: true },
    });

    const auditLogsUsers = await prisma.auditLog.findMany({
      where: { user_id: { not: null } },
      distinct: ['user_id'],
      select: { user_id: true },
    });

    const allUserIdSet = new Set<string | null>([
      ...commandLogsUsers.map(u => u.user_id),
      ...auditLogsUsers.map(u => u.user_id),
    ]);

    // Filter valid and invalid user IDs
    const validUserIds = new Set<string>();
    const invalidUserIds = getInvalidUserIds(allUserIdSet);
    
    allUserIdSet.forEach(id => {
      if (id && isDiscordSnowflake(id)) {
        validUserIds.add(id);
      }
    });

    // ===== COMMANDS DATA =====
    const allCommandLogs = await prisma.commandLog.findMany({
      select: { command_name: true },
    });

    const realCommandLogs = allCommandLogs.filter(cmd => !isTestCommand(cmd.command_name));
    const testCommandLogs = allCommandLogs.filter(cmd => isTestCommand(cmd.command_name));

    const uniqueCommandNames = new Set(allCommandLogs.map(cmd => cmd.command_name).filter(Boolean));
    const uniqueRealCommandNames = new Set(realCommandLogs.map(cmd => cmd.command_name).filter(Boolean));

    // Test commands breakdown
    const testCommandsBreakdown = await prisma.commandLog.groupBy({
      by: ['command_name'],
      where: {
        OR: [
          { command_name: { startsWith: 'test_' } },
          { command_name: { in: ['test_command', 'test_error_cmd'] } },
        ],
      },
      _count: { command_name: true },
    });

    const todayAllCommands = await prisma.commandLog.count({
      where: { created_at: { gte: today } },
    });

    const todayRealCommands = allCommandLogs.filter(
      cmd => !isTestCommand(cmd.command_name)
    ).length;

    // ===== ACTIONS DATA =====
    const totalAuditLogs = await prisma.auditLog.count();
    
    const todayAuditLogs = await prisma.auditLog.count({
      where: { created_at: { gte: today } },
    });

    const monthAuditLogs = await prisma.auditLog.count({
      where: { created_at: { gte: monthAgo } },
    });

    // ===== TOP COMMANDS - REAL ONLY =====
    const topCommandsMap = new Map<string, number>();
    realCommandLogs.forEach(cmd => {
      if (cmd.command_name) {
        topCommandsMap.set(cmd.command_name, (topCommandsMap.get(cmd.command_name) || 0) + 1);
      }
    });

    const topCommandsRaw = Array.from(topCommandsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ command_name: name, _count: { command_name: count } }));

    // ===== TOP USERS - VALID ONLY =====
    const topCommandUsersRaw = await prisma.commandLog.groupBy({
      by: ['user_id'],
      _count: { user_id: true },
      orderBy: { _count: { user_id: 'desc' } },
      take: 50,
    });

    const topAuditUsersRaw = await prisma.auditLog.groupBy({
      by: ['user_id'],
      _count: { user_id: true },
      orderBy: { _count: { user_id: 'desc' } },
      take: 50,
      where: { user_id: { not: null } },
    });

    // Merge top users - filter valid only
    const userCountsMap = new Map<string, number>();
    
    topCommandUsersRaw.forEach(u => {
      if (u.user_id && isDiscordSnowflake(u.user_id)) {
        userCountsMap.set(u.user_id, (userCountsMap.get(u.user_id) || 0) + u._count.user_id);
      }
    });

    topAuditUsersRaw.forEach(u => {
      if (u.user_id && isDiscordSnowflake(u.user_id)) {
        userCountsMap.set(u.user_id, (userCountsMap.get(u.user_id) || 0) + u._count.user_id);
      }
    });

    const topUsersRaw = Array.from(userCountsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ id: userId, count }));

    // ===== COMMAND LOGS RAW SAMPLE =====
    const commandLogsSample = await prisma.commandLog.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
    });

    // ===== AUDIT LOGS RAW SAMPLE =====
    const auditLogsSample = await prisma.auditLog.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
    });

    return {
      summary: {
        totalAllCommands: allCommandLogs.length,
        totalRealCommands: realCommandLogs.length,
        totalTestCommands: testCommandLogs.length,
        totalAuditLogs,
        uniqueCommandNames: uniqueCommandNames.size,
        uniqueRealCommandNames: uniqueRealCommandNames.size,
        totalValidGuilds: validGuildIds.size,
        totalInvalidGuilds: invalidGuildIds.size,
        totalValidUsers: validUserIds.size,
        totalInvalidUsers: invalidUserIds.size,
      },
      guilds: {
        description: 'Guild ID validation and filtering',
        fromGuildTable: totalGuildTableRows,
        fromCommandLogsDistinct: commandLogsGuilds.length,
        fromAuditLogsDistinct: auditLogsGuilds.length,
        fromUnionSetTotal: allGuildIdSet.size,
        validGuildIds: Array.from(validGuildIds).sort(),
        invalidGuildIds: Array.from(invalidGuildIds).sort(),
        usedInDashboard: validGuildIds.size,
      },
      users: {
        description: 'User ID validation and filtering',
        fromCommandLogsDistinct: commandLogsUsers.length,
        fromAuditLogsDistinct: auditLogsUsers.length,
        fromUnionSetTotal: allUserIdSet.size,
        validUserIds: Array.from(validUserIds).sort(),
        invalidUserIds: Array.from(invalidUserIds).sort(),
        usedInDashboard: validUserIds.size,
      },
      commands: {
        description: 'Command filtering (excluding test commands)',
        totalAllCommands: allCommandLogs.length,
        totalRealCommands: realCommandLogs.length,
        totalTestCommands: testCommandLogs.length,
        uniqueAllCommandNames: uniqueCommandNames.size,
        uniqueRealCommandNames: uniqueRealCommandNames.size,
        todayAllCommands,
        todayRealCommands,
        excludedTestCommands: testCommandsBreakdown.map(cmd => ({
          name: cmd.command_name,
          count: cmd._count.command_name,
        })),
        usedInDashboard: realCommandLogs.length,
      },
      actions: {
        description: 'Audit logs (no filtering applied)',
        totalAuditLogs,
        todayAuditLogs,
        monthAuditLogs,
        usedInDashboard: totalAuditLogs,
      },
      topCommands: {
        description: 'Top 10 commands (real only, tests excluded)',
        data: topCommandsRaw.map(cmd => ({
          name: cmd.command_name,
          count: cmd._count.command_name,
        })),
      },
      topUsers: {
        description: 'Top 10 users (valid snowflakes only)',
        data: topUsersRaw,
      },
      dataQualityIssues: {
        testCommandsExcluded: testCommandLogs.length,
        invalidGuildIdsExcluded: invalidGuildIds.size,
        invalidUserIdsExcluded: invalidUserIds.size,
        commandLogGuildIdNull: await prisma.commandLog.count({ where: { guild_id: null } }),
        auditLogUserIdNull: await prisma.auditLog.count({ where: { user_id: null } }),
      },
      finalCleanValues: {
        servers: validGuildIds.size,
        users: validUserIds.size,
        commands: realCommandLogs.length,
        actions: totalAuditLogs,
      },
      samples: {
        commandLogsSample,
        auditLogsSample,
      },
    };
  },

  async getServersSources() {
    // Validate Discord snowflake format: 17-20 digits
    const isValidSnowflake = (id: string | number | null): id is string => {
      if (!id) return false;
      const idStr = String(id);
      return /^\d{17,20}$/.test(idStr);
    };

    try {
      // Get all valid guild IDs from database
      const allGuilds = await prisma.guild.findMany({
        select: { id: true, name: true, icon_url: true, member_count: true, created_at: true },
      });

      const validGuilds = allGuilds.filter(g => isValidSnowflake(g.id));
      const validGuildIds = validGuilds.map(g => g.id);

      if (validGuildIds.length === 0) {
        return {
          servers: [],
          totalValid: 0,
          totalInvalid: allGuilds.length,
          stats: {},
        };
      }

      // Get name sources for each guild
      const namesBySource = {
        command_logs: await prisma.commandLog.findMany({
          where: { guild_id: { in: validGuildIds }, guild_name: { not: null } },
          select: { guild_id: true, guild_name: true },
          distinct: ['guild_id'],
        }),
        audit_logs: await prisma.auditLog.findMany({
          where: { guild_id: { in: validGuildIds }, target_name: { not: null } },
          select: { guild_id: true, target_name: true },
          distinct: ['guild_id'],
        }),
        banned_guilds: await prisma.bannedGuild.findMany({
          where: { guild_id: { in: validGuildIds } },
          select: { guild_id: true, guild_name: true },
        }),
      };

      // Get command/error counts
      const commandCounts = await prisma.commandLog.groupBy({
        by: ['guild_id'],
        where: { guild_id: { in: validGuildIds } },
        _count: true,
      });

      const errorCounts = await prisma.errorLog.groupBy({
        by: ['guild_id'],
        where: { guild_id: { in: validGuildIds } },
        _count: true,
      });

      const commandCountMap = new Map(commandCounts.map(c => [c.guild_id, c._count]));
      const errorCountMap = new Map(errorCounts.map(e => [e.guild_id, e._count]));

      // Get last activity
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
        if (la._max.created_at) {
          const time = la._max.created_at instanceof Date
            ? la._max.created_at.getTime()
            : new Date(la._max.created_at).getTime();
          if (la.guild_id) lastActivityMap.set(la.guild_id, time);
        }
      });

      auditLastActivity.forEach(la => {
        if (la._max.created_at) {
          const time = la._max.created_at instanceof Date
            ? la._max.created_at.getTime()
            : new Date(la._max.created_at).getTime();
          const existing = la.guild_id ? lastActivityMap.get(la.guild_id) || 0 : 0;
          if (time > existing) {
            if (la.guild_id) lastActivityMap.set(la.guild_id, time);
          }
        }
      });

      // Get ban status
      const bannedGuilds = await prisma.bannedGuild.findMany({
        where: { guild_id: { in: validGuildIds }, active: true },
        select: { guild_id: true },
      });

      const bannedGuildSet = new Set(bannedGuilds.map(bg => bg.guild_id));

      // Build detailed server data with sources
      const servers = validGuilds.map(guild => {
        // Determine name source
        let resolvedName = guild.name;
        let nameSource = 'guilds_table';

        const commandLogName = namesBySource.command_logs.find(n => n.guild_id === guild.id);
        if (commandLogName?.guild_name) {
          resolvedName = commandLogName.guild_name;
          nameSource = 'command_logs';
        } else {
          const auditLogName = namesBySource.audit_logs.find(n => n.guild_id === guild.id);
          if (auditLogName?.target_name) {
            resolvedName = auditLogName.target_name;
            nameSource = 'audit_logs';
          } else {
            const bannedName = namesBySource.banned_guilds.find(n => n.guild_id === guild.id);
            if (bannedName?.guild_name) {
              resolvedName = bannedName.guild_name;
              nameSource = 'banned_guilds';
            }
          }
        }

        if (!resolvedName) {
          resolvedName = `Serveur inconnu (${guild.id})`;
          nameSource = 'fallback';
        }

        // Member count source
        const memberCountSource = guild.member_count ? 'guilds_table' : 'unavailable';

        // Status source
        const isBanned = bannedGuildSet.has(guild.id);
        const status = isBanned ? 'BANNED' : 'ONLINE';
        const statusSource = isBanned ? 'banned_guilds' : 'default';

        const lastActivityTime = lastActivityMap.get(guild.id) || null;

        return {
          guildId: guild.id,
          resolvedName,
          nameSource,
          memberCount: guild.member_count || null,
          memberCountSource,
          status,
          statusSource,
          commandCount: commandCountMap.get(guild.id) || 0,
          errorCount: errorCountMap.get(guild.id) || 0,
          lastActivityAt: lastActivityTime,
          actionsAvailable: ['Voir logs', 'Stats', 'Config', isBanned ? 'Débannir' : 'Bannir'],
        };
      });

      return {
        servers,
        totalValid: validGuildIds.length,
        totalInvalid: allGuilds.filter(g => !isValidSnowflake(g.id)).length,
        stats: {
          totalServers: servers.length,
          totalBanned: servers.filter(s => s.status === 'BANNED').length,
          totalOnline: servers.filter(s => s.status === 'ONLINE').length,
          avgCommandsPerServer: Math.round(
            servers.reduce((sum, s) => sum + s.commandCount, 0) / servers.length
          ),
        },
      };
    } catch (error) {
      console.error('Error in debugService.getServersSources:', error);
      throw error;
    }
  },
};
