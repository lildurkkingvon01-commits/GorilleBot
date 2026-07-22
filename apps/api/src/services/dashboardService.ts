/**
 * Dashboard Service
 */

import { guildRepository, guildStatsRepository } from '@/repositories/guild';
import { auditLogRepository } from '@/repositories/auditLog';
import { commandLogRepository } from '@/repositories/commandLog';
import { maintenanceRepository } from '@/repositories/other';
import { PrismaClient } from '@prisma/client';
import {
  DashboardOverview,
  BotStatus,
  CommandStatistics,
} from '@/types';
import {
  isDiscordSnowflake,
  isTestCommand,
  filterValidGuildIds,
  filterValidUserIds,
} from '@/utils/validators';

const prisma = new PrismaClient();

export const dashboardService = {
  async getOverview(): Promise<DashboardOverview> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get unique guilds from command_logs and audit_logs - filter valid snowflakes only
    const [commandGuilds, auditGuilds] = await Promise.all([
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
    ]);

    const allGuildIds = new Set([
      ...commandGuilds.map(g => g.guild_id),
      ...auditGuilds.map(g => g.guild_id),
    ]);
    const validGuildIds = filterValidGuildIds(allGuildIds);
    const totalGuilds = validGuildIds.size;

    // Get unique users from command_logs and audit_logs - filter valid snowflakes only
    const [commandUsers, auditUsers] = await Promise.all([
      prisma.commandLog.findMany({
        distinct: ['user_id'],
        select: { user_id: true },
      }),
      prisma.auditLog.findMany({
        where: { user_id: { not: null } },
        distinct: ['user_id'],
        select: { user_id: true },
      }),
    ]);

    const allUserIds = new Set([
      ...commandUsers.map(u => u.user_id),
      ...auditUsers.map(u => u.user_id),
    ]);
    const validUserIds = filterValidUserIds(allUserIds);
    const totalUsers = validUserIds.size;

    // Get commands excluding test commands
    const allCommands = await prisma.commandLog.findMany({
      select: { command_name: true, created_at: true },
    });
    const realCommands = allCommands.filter(c => !isTestCommand(c.command_name));
    const totalCommands = realCommands.length;

    // Get command stats (today, week, month) - excluding test commands
    const todayCommands = realCommands.filter(c => c.created_at && c.created_at >= today).length;
    const weekCommands = realCommands.filter(c => c.created_at && c.created_at >= weekAgo).length;
    const monthCommands = realCommands.filter(c => c.created_at && c.created_at >= monthAgo).length;

    // Get audit stats (today, week, month)
    const [todayAudit, weekAudit, monthAudit] = await Promise.all([
      prisma.auditLog.count({
        where: { created_at: { gte: today } },
      }),
      prisma.auditLog.count({
        where: { created_at: { gte: weekAgo } },
      }),
      prisma.auditLog.count({
        where: { created_at: { gte: monthAgo } },
      }),
    ]);

    // Get top commands (excluding test commands)
    const commandCounts = new Map<string, number>();
    realCommands.forEach(cmd => {
      if (cmd.command_name) {
        commandCounts.set(cmd.command_name, (commandCounts.get(cmd.command_name) || 0) + 1);
      }
    });
    const topCommands = Array.from(commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name,
        count,
      }));

    // Get top users by count of actions (commands + audit logs combined) - only valid users
    const topCommandUsers = await prisma.commandLog.groupBy({
      by: ['user_id'],
      _count: { user_id: true },
      orderBy: { _count: { user_id: 'desc' } },
      take: 50,
    });

    const topAuditUsers = await prisma.auditLog.groupBy({
      by: ['user_id'],
      _count: { user_id: true },
      orderBy: { _count: { user_id: 'desc' } },
      take: 50,
      where: { user_id: { not: null } },
    });

    // Merge and aggregate top users - filter valid IDs only
    const userCounts = new Map<string, number>();
    
    topCommandUsers.forEach(u => {
      if (u.user_id && isDiscordSnowflake(u.user_id)) {
        userCounts.set(u.user_id, (userCounts.get(u.user_id) || 0) + u._count.user_id);
      }
    });

    topAuditUsers.forEach(u => {
      if (u.user_id && isDiscordSnowflake(u.user_id)) {
        userCounts.set(u.user_id, (userCounts.get(u.user_id) || 0) + u._count.user_id);
      }
    });

    // Get usernames for top users from command_logs
    const topUserIds = Array.from(userCounts.keys()).slice(0, 10);
    const usernames = await prisma.commandLog.findMany({
      where: { user_id: { in: topUserIds } },
      distinct: ['user_id'],
      select: { user_id: true, username: true },
      orderBy: { created_at: 'desc' },
    });

    const usernameMap = new Map<string, string>();
    usernames.forEach(u => {
      if (u.user_id && u.username) {
        usernameMap.set(u.user_id, u.username);
      }
    });

    const topUsers = Array.from(userCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({
        id: userId,
        username: usernameMap.get(userId),
        count,
      }));

    const totalWarnings = 0; // TODO: Calculate from data

    return {
      totalGuilds,
      totalUsers,
      totalCommands,
      totalWarnings,
      commandStats: {
        today: todayCommands,
        week: weekCommands,
        month: monthCommands,
      },
      auditStats: {
        today: todayAudit,
        week: weekAudit,
        month: monthAudit,
      },
      topCommands,
      topUsers,
    };
  },

  async getBotStatus(): Promise<BotStatus> {
    const uptime = process.uptime();

    // Get guild and user counts from real data sources - filter valid snowflakes only
    const [commandGuilds, auditGuilds, commandUsers, auditUsers] = await Promise.all([
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
      prisma.auditLog.findMany({
        where: { user_id: { not: null } },
        distinct: ['user_id'],
        select: { user_id: true },
      }),
    ]);

    const allGuildIds = new Set([
      ...commandGuilds.map(g => g.guild_id),
      ...auditGuilds.map(g => g.guild_id),
    ]);
    const validGuildIds = filterValidGuildIds(allGuildIds);
    const guilds = validGuildIds.size;

    const allUserIds = new Set([
      ...commandUsers.map(u => u.user_id),
      ...auditUsers.map(u => u.user_id),
    ]);
    const validUserIds = filterValidUserIds(allUserIds);
    const users = validUserIds.size;

    // TODO: Get actual bot status and latency from Discord bot connection
    const status = 'online';
    const latency = 0;

    return {
      uptime: Math.floor(uptime),
      status: status as 'online' | 'offline' | 'maintenance',
      guilds,
      users,
      latency,
    };
  },

  async getActivity() {
    const [auditLogs, commandLogs] = await Promise.all([
      auditLogRepository.findMany(1, 20),
      commandLogRepository.findMany(1, 20),
    ]);

    return {
      recentAudit: auditLogs.data,
      recentCommands: commandLogs.data,
    };
  },

  async getCommandStats(): Promise<CommandStatistics> {
    const stats = await commandLogRepository.getStats();
    const topCommands = await commandLogRepository.getTopCommands(5);

    return {
      total: stats.total,
      today: stats.today,
      week: stats.week,
      month: stats.month,
      topCommands: topCommands.map((cmd: any) => ({
        name: cmd.command_name,
        count: cmd._count.command_name,
      })),
      failureRate: stats.failureRate,
    };
  },

  async getGrowthMetrics() {
    // Get counts from real data sources
    const [commandGuilds, auditGuilds, commandUsers, auditUsers, totalCommands] = await Promise.all([
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
      prisma.auditLog.findMany({
        where: { user_id: { not: null } },
        distinct: ['user_id'],
        select: { user_id: true },
      }),
      prisma.commandLog.count(),
    ]);

    const guildIds = new Set([
      ...commandGuilds.map(g => g.guild_id),
      ...auditGuilds.map(g => g.guild_id),
    ]);

    const userIds = new Set([
      ...commandUsers.map(u => u.user_id),
      ...auditUsers.map(u => u.user_id),
    ]);

    // Calculate growth trends (simplified)
    return {
      guilds: {
        total: guildIds.size,
        trend: 'stable', // TODO: Calculate from historical data
      },
      users: {
        total: userIds.size,
        trend: 'stable',
      },
      commands: {
        total: totalCommands,
        trend: 'stable',
      },
    };
  },
};
