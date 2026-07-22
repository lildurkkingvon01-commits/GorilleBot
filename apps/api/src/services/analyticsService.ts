/**
 * Analytics Service
 */

import { commandLogRepository } from '@/repositories/commandLog';
import { auditLogRepository } from '@/repositories/auditLog';
import { guildRepository } from '@/repositories/guild';

export const analyticsService = {
  async getOverview(timeframe: string = 'month', guildId?: string) {
    const [commandStats, auditStats, topCommands, topUsers] = await Promise.all([
      commandLogRepository.getStats(guildId),
      auditLogRepository.getStats(guildId),
      commandLogRepository.getTopCommands(5, guildId),
      auditLogRepository.getTopUsers(5, guildId),
    ]);

    return {
      timeframe,
      period: { start: getPeriodStart(timeframe), end: new Date() },
      commands: {
        total: commandStats.total,
        today: commandStats.today,
        week: commandStats.week,
        month: commandStats.month,
        failureRate: commandStats.failureRate,
      },
      actions: {
        total: auditStats.total,
        today: auditStats.today,
        week: auditStats.week,
        month: auditStats.month,
      },
      topCommands: topCommands.slice(0, 5).map((cmd: any) => ({
        name: cmd.command_name,
        executions: cmd._count?.command_name || 0,
      })),
      topUsers: topUsers.slice(0, 5).map((user: any) => ({
        id: user.user_id,
        actions: user._count?.user_id || 0,
      })),
    };
  },

  async getGuildGrowth(guildId: string, timeframe: string = 'month') {
    const data = await guildRepository.findById(guildId);

    if (!data) {
      return { error: 'Guild not found' };
    }

    // Calculate growth trend (placeholder - would need historical data)
    const trend = 0.05; // 5% growth

    return {
      guildId,
      name: data.name,
      members: data.member_count,
      trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
      growthRate: Math.round(trend * 100),
      joinedRecently: 0,
      leftRecently: 0,
    };
  },

  async getCommandUsage(guildId?: string, timeframe: string = 'month') {
    const commandStats = await commandLogRepository.getTopCommands(20, guildId);

    return {
      timeframe,
      total: commandStats.length,
      commands: commandStats.map((cmd: any) => ({
        name: cmd.command_name,
        executions: cmd._count?.command_name || 0,
        successRate: 95, // Placeholder
      })),
    };
  },

  async getModerationStats(guildId?: string, timeframe: string = 'month') {
    const actions = await auditLogRepository.getTopActions(10, guildId);

    const moderationActions = actions.filter((action: any) =>
      ['GUILD_BANNED', 'GUILD_KICKED', 'user_banned', 'user_unbanned', 'COMMAND_MAINTENANCE_DISABLE'].includes(
        action.action
      )
    );

    return {
      timeframe,
      guildId,
      total: moderationActions.reduce((sum: number, act: any) => sum + (act._count?.action || 0), 0),
      actions: moderationActions.map((act: any) => ({
        type: act.action,
        count: act._count?.action || 0,
      })),
    };
  },

  async getActivityHeatmap(guildId?: string, days: number = 30) {
    const commandStats = await commandLogRepository.findMany(1, 1000, { guildId });

    const heatmap: Record<string, number> = {};

    commandStats.data.forEach((log: any) => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      heatmap[date] = (heatmap[date] || 0) + 1;
    });

    return {
      timeframe: `last_${days}_days`,
      guildId,
      data: Object.entries(heatmap)
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
        .slice(0, days)
        .map(([date, count]) => ({ date, count })),
    };
  },

  async getCommandErrorRate(guildId?: string) {
    const stats = await commandLogRepository.getStats(guildId);

    return {
      failureRate: stats.failureRate,
      successRate: 100 - stats.failureRate,
      timestamp: new Date(),
    };
  },
};

function getPeriodStart(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case 'day':
      return new Date(now.setHours(0, 0, 0, 0));
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      return weekStart;
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
