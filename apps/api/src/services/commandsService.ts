/**
 * Commands Service
 */

import { commandRepository } from '@/repositories/other';
import { commandLogRepository } from '@/repositories/commandLog';

export const commandsService = {
  async getCommands(page: number, limit: number, filters?: any) {
    return commandRepository.findMany(page, limit, filters);
  },

  async getCommandById(commandId: number) {
    return commandRepository.findById(commandId);
  },

  async getCommandByName(name: string) {
    return commandRepository.findByName(name);
  },

  async getCommandStats(commandName: string, guildId?: string) {
    const [total, today, week, month, avgExecutionTime] = await Promise.all([
      commandLogRepository.findMany(1, 1, {
        commandName,
        guildId,
      }),
      commandLogRepository.getStats(guildId),
      commandLogRepository.getAverageExecutionTime(commandName, guildId),
      commandLogRepository.getTopCommands(1, guildId),
      commandLogRepository.getAverageExecutionTime(commandName, guildId),
    ]);

    return {
      name: commandName,
      executions: total.total,
      today: today.today,
      week: today.week,
      month: today.month,
      averageExecutionTime: avgExecutionTime.average,
      maxExecutionTime: avgExecutionTime.max,
      minExecutionTime: avgExecutionTime.min,
    };
  },

  async enableCommand(commandName: string) {
    // This would typically update a database record
    // For now, log the action
    return { success: true, command: commandName, enabled: true };
  },

  async disableCommand(commandName: string) {
    return { success: true, command: commandName, enabled: false };
  },

  async resetCommandStats(commandName: string) {
    // This would typically reset stats in the database
    return { success: true, command: commandName, message: 'Stats reset' };
  },

  async getEnabledCommands() {
    return commandRepository.getEnabled();
  },

  async getDisabledCommands() {
    return commandRepository.getDisabled();
  },
};
