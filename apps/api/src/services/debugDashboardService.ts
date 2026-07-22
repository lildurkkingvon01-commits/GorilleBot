/**
 * Debug Dashboard Service
 * Provides raw, filtered, and excluded data for audit purposes
 */

import { PrismaClient } from '@prisma/client';
import { isDiscordSnowflake } from '@/utils/validators';
import { formatUptime } from '@/services/dashboardFormatterService';

const prisma = new PrismaClient();

export async function getDebugDashboardMetrics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ===== RAW COMMAND LOGS =====
  const rawCommandLogs = await prisma.commandLog.findMany({
    select: { id: true, command_name: true, user_id: true, guild_id: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 250,
  });

  // Categorize commands
  const commandsByType = {
    total: rawCommandLogs.length,
    realCommands: [] as typeof rawCommandLogs,
    testCommands: [] as typeof rawCommandLogs,
    nullCommands: [] as typeof rawCommandLogs,
  };

  rawCommandLogs.forEach(cmd => {
    if (!cmd.command_name) {
      commandsByType.nullCommands.push(cmd);
    } else if (cmd.command_name.startsWith('test_') || ['test_command', 'test_error_cmd'].includes(cmd.command_name)) {
      commandsByType.testCommands.push(cmd);
    } else {
      commandsByType.realCommands.push(cmd);
    }
  });

  // ===== TOP COMMANDS ANALYSIS =====
  const commandCounts = new Map<string, { raw: string; normalized: string; count: number }>();
  commandsByType.realCommands.forEach(cmd => {
    if (cmd.command_name?.trim()) {
      const rawName = cmd.command_name;
      const normalized = rawName.trim().startsWith('/') ? rawName.trim() : `/${rawName.trim()}`;
      const key = normalized;

      if (!commandCounts.has(key)) {
        commandCounts.set(key, { raw: rawName, normalized, count: 0 });
      }
      const entry = commandCounts.get(key)!;
      entry.count += 1;
    }
  });

  const topCommands = Array.from(commandCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ===== RAW AUDIT LOGS =====
  const rawAuditLogs = await prisma.auditLog.findMany({
    select: { 
      id: true, 
      action: true, 
      user_id: true, 
      guild_id: true, 
      target_id: true,
      target_name: true,
      details: true,
      created_at: true 
    },
    orderBy: { created_at: 'desc' },
    take: 350,
  });

  // Categorize audit actions
  const actionsByType: Record<string, { count: number; examples: (typeof rawAuditLogs)[0][] }> = {};
  const excludedActions = new Set<string>();

  rawAuditLogs.forEach(audit => {
    // Determine if excluded
    const isExcluded = 
      audit.action === 'command_used' || 
      audit.action === 'COMMAND_USED' || 
      audit.action === 'command_executed';

    if (isExcluded) {
      excludedActions.add(audit.action);
    } else {
      if (!actionsByType[audit.action]) {
        actionsByType[audit.action] = { count: 0, examples: [] };
      }
      actionsByType[audit.action].count += 1;
      if (actionsByType[audit.action].examples.length < 2) {
        actionsByType[audit.action].examples.push(audit);
      }
    }
  });

  const totalRealActions = Object.values(actionsByType).reduce((sum, a) => sum + a.count, 0);
  const totalExcludedActions = rawAuditLogs.length - totalRealActions;

  // ===== USERS ANALYSIS =====
  const topCommandUserIds = await prisma.commandLog.groupBy({
    by: ['user_id'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 50,
  });

  const userAnalysis: Record<string, {
    commandCount: number;
    isValid: boolean;
    username?: string;
  }> = {};

  const validUserIds: string[] = [];
  const invalidUserIds: string[] = [];

  topCommandUserIds.forEach((u: any) => {
    if (!u.user_id) return;
    
    const isValid = isDiscordSnowflake(u.user_id);
    if (isValid) {
      validUserIds.push(u.user_id);
    } else {
      invalidUserIds.push(u.user_id);
    }

    userAnalysis[u.user_id] = {
      commandCount: u._count.id,
      isValid,
    };
  });

  // Get usernames
  const userRecords = await prisma.commandLog.findMany({
    where: { user_id: { in: validUserIds.slice(0, 10) } },
    distinct: ['user_id'],
    select: { user_id: true, username: true },
  });

  userRecords.forEach(u => {
    if (u.user_id && userAnalysis[u.user_id]) {
      userAnalysis[u.user_id].username = u.username || undefined;
    }
  });

  // ===== GUILDS ANALYSIS =====
  const commandGuilds = await prisma.commandLog.findMany({
    where: { guild_id: { not: null } },
    distinct: ['guild_id'],
    select: { guild_id: true },
  });

  const auditGuilds = await prisma.auditLog.findMany({
    where: { guild_id: { not: null } },
    distinct: ['guild_id'],
    select: { guild_id: true },
  });

  const allGuildIds = new Set([
    ...commandGuilds.map(g => g.guild_id),
    ...auditGuilds.map(g => g.guild_id),
  ]);

  const guildAnalysis: Record<string, { isValid: boolean }> = {};
  let validGuilds = 0;
  let invalidGuilds = 0;

  allGuildIds.forEach(guildId => {
    const isValid = isDiscordSnowflake(guildId);
    if (guildId) guildAnalysis[guildId] = { isValid };
    if (isValid) validGuilds++;
    else invalidGuilds++;
  });

  // ===== BOT STATUS =====
  const uptime = process.uptime();

  return {
    timestamp: new Date().toISOString(),
    
    raw: {
      commandLogs: {
        total: rawCommandLogs.length,
        sample: rawCommandLogs.slice(0, 5),
      },
      auditLogs: {
        total: rawAuditLogs.length,
        sample: rawAuditLogs.slice(0, 5),
      },
    },

    filtered: {
      commands: {
        total: commandsByType.realCommands.length,
        top: topCommands,
        breakdown: {
          realCommands: commandsByType.realCommands.length,
          testCommands: commandsByType.testCommands.length,
          nullCommands: commandsByType.nullCommands.length,
        },
      },
      actions: {
        total: totalRealActions,
        excluded: totalExcludedActions,
        byType: actionsByType,
        today: rawAuditLogs.filter(
          a => a.created_at && a.created_at >= today && 
          !(a.action === 'command_used' || a.action === 'COMMAND_USED' || a.action === 'command_executed')
        ).length,
        week: rawAuditLogs.filter(
          a => a.created_at && a.created_at >= weekAgo && 
          !(a.action === 'command_used' || a.action === 'COMMAND_USED' || a.action === 'command_executed')
        ).length,
      },
      users: {
        total: validUserIds.length,
        topUsers: validUserIds.slice(0, 10).map(uid => ({
          userId: uid,
          count: userAnalysis[uid].commandCount,
          username: userAnalysis[uid].username,
        })),
      },
      guilds: {
        total: validGuilds,
        list: Array.from(allGuildIds).filter(gid => guildAnalysis[gid as string] && guildAnalysis[gid as string].isValid),
      },
    },

    excluded: {
      commands: {
        test: commandsByType.testCommands.slice(0, 5).map(c => ({
          id: c.id,
          name: c.command_name,
          reason: 'test_ prefix or reserved test name',
        })),
        null: commandsByType.nullCommands.length,
      },
      actions: {
        commandUsed: {
          count: rawAuditLogs.filter(a => a.action === 'command_used' || a.action === 'COMMAND_USED').length,
          reason: 'Counted in command_logs instead',
        },
        commandExecuted: rawAuditLogs.filter(a => a.action === 'command_executed').length,
      },
      users: {
        invalid: invalidUserIds.slice(0, 10).map(uid => ({
          userId: uid,
          count: userAnalysis[uid].commandCount,
          reason: 'Not a valid Discord Snowflake',
        })),
      },
      guilds: {
        invalid: Array.from(allGuildIds)
          .filter(gid => !guildAnalysis[gid as string] || !guildAnalysis[gid as string].isValid)
          .slice(0, 10)
          .map(gid => ({ guildId: gid, reason: 'Not a valid Discord Snowflake' })),
      },
    },

    metrics: {
      commandExecutions: {
        total: commandsByType.realCommands.length,
        today: commandsByType.realCommands.filter(c => c.created_at && c.created_at >= today).length,
        week: commandsByType.realCommands.filter(c => c.created_at && c.created_at >= weekAgo).length,
      },
      adminActions: {
        total: totalRealActions,
        excluded: totalExcludedActions,
        today: rawAuditLogs.filter(
          a => a.created_at && a.created_at >= today && 
          !(a.action === 'command_used' || a.action === 'COMMAND_USED' || a.action === 'command_executed')
        ).length,
        week: rawAuditLogs.filter(
          a => a.created_at && a.created_at >= weekAgo && 
          !(a.action === 'command_used' || a.action === 'COMMAND_USED' || a.action === 'command_executed')
        ).length,
      },
      activeGuilds: validGuilds,
      knownUsers: validUserIds.length,
      botUptime: {
        seconds: Math.floor(uptime),
        formatted: formatUptime(uptime),
      },
    },
  };
}
