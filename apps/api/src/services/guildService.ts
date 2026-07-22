/**
 * Guild Service
 */

import { guildRepository, guildStatsRepository } from '@/repositories/guild';
import { auditLogRepository } from '@/repositories/auditLog';
import { commandLogRepository } from '@/repositories/commandLog';

export const guildService = {
  async getGuilds(page: number, limit: number, filters?: any) {
    return guildRepository.findMany(page, limit, filters);
  },

  async getGuildById(guildId: string) {
    return guildRepository.findById(guildId);
  },

  async getGuildStats(guildId: string) {
    return guildStatsRepository.findByGuildId(guildId);
  },

  async getGuildActivityStats(guildId: string) {
    const [auditStats, commandStats] = await Promise.all([
      auditLogRepository.getStats(guildId),
      commandLogRepository.getStats(guildId),
    ]);

    return {
      auditLogs: auditStats,
      commandLogs: commandStats,
    };
  },

  async getGuildTopMembers(guildId: string, limit: number = 10) {
    return auditLogRepository.getTopUsers(limit, guildId);
  },

  async getGuildTopActions(guildId: string, limit: number = 10) {
    return auditLogRepository.getTopActions(limit, guildId);
  },

  async getTopGuilds(metric: 'members' | 'commands' = 'members', limit: number = 10) {
    if (metric === 'commands') {
      return guildRepository.getTopGuildsByCommands(limit);
    }
    return guildRepository.getTopGuildsByMembers(limit);
  },

  async getGuildTotal() {
    return guildRepository.getTotalCount();
  },

  async getGuildAggregate() {
    return guildStatsRepository.getAggregate();
  },
};
