/**
 * Logs Service
 */

import { auditLogRepository } from '@/repositories/auditLog';
import { commandLogRepository } from '@/repositories/commandLog';
import { errorLogRepository } from '@/repositories/other';
import { AuditLogEntry } from '@/types';
import { QueryFilters } from '@/utils/pagination';

export interface LogFilters extends QueryFilters {
  severity?: string;
  success?: boolean;
}

export const logsService = {
  // Audit Logs
  async getAuditLogs(page: number, limit: number, filters?: any) {
    return auditLogRepository.findMany(page, limit, filters);
  },

  async getAuditLogById(id: number) {
    return auditLogRepository.findById(id);
  },

  async getAuditLogStats(guildId?: string) {
    return auditLogRepository.getStats(guildId);
  },

  async getAuditLogTopActions(limit?: number, guildId?: string) {
    return auditLogRepository.getTopActions(limit, guildId);
  },

  // Command Logs
  async getCommandLogs(page: number, limit: number, filters?: any) {
    return commandLogRepository.findMany(page, limit, filters);
  },

  async getCommandLogById(id: number) {
    return commandLogRepository.findById(id);
  },

  async getCommandLogStats(guildId?: string) {
    return commandLogRepository.getStats(guildId);
  },

  async getCommandLogTopCommands(limit?: number, guildId?: string) {
    return commandLogRepository.getTopCommands(limit, guildId);
  },

  async getCommandLogExecutionTime(commandName?: string, guildId?: string) {
    return commandLogRepository.getAverageExecutionTime(commandName, guildId);
  },

  // Error Logs
  async getErrorLogs(page: number, limit: number, filters?: any) {
    return errorLogRepository.findMany(page, limit, filters);
  },

  async getErrorLogById(id: number) {
    return errorLogRepository.findById(id);
  },

  async getErrorLogStats() {
    return errorLogRepository.getStats();
  },
};
