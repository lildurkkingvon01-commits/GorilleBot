/**
 * Logs Controller
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logsService } from '@/services/logsService';
import { ApiResponse } from '@/types';
import { errorResponses } from '@/utils/errors';
import { parsePagination, parseFilters, createPaginatedResponse } from '@/utils/pagination';

export const logsController = {
  // Audit Logs
  async getAuditLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { page, limit } = parsePagination(query.page, query.limit);
      const filters = parseFilters(query);

      const result = await logsService.getAuditLogs(page, limit, filters);
      const response = createPaginatedResponse(result.data, result.total, page, limit);

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw errorResponses.databaseError();
    }
  },

  async getAuditLogById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const logId = parseInt(id, 10);

      if (isNaN(logId)) {
        throw errorResponses.invalidParams({ id: 'must be a number' });
      }

      const data = await logsService.getAuditLogById(logId);

      if (!data) {
        throw errorResponses.notFound('Audit log');
      }

      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      throw errorResponses.internalError();
    }
  },

  // Command Logs
  async getCommandLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { page, limit } = parsePagination(query.page, query.limit);
      const filters = {
        guildId: query.guildId,
        userId: query.userId,
        commandName: query.commandName,
        dateFrom: query.dateFrom ? new Date(query.dateFrom as string) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo as string) : undefined,
      };

      const result = await logsService.getCommandLogs(page, limit, filters);
      const response = createPaginatedResponse(result.data, result.total, page, limit);

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching command logs:', error);
      throw errorResponses.databaseError();
    }
  },

  async getCommandLogById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const logId = parseInt(id, 10);

      if (isNaN(logId)) {
        throw errorResponses.invalidParams({ id: 'must be a number' });
      }

      const data = await logsService.getCommandLogById(logId);

      if (!data) {
        throw errorResponses.notFound('Command log');
      }

      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching command log:', error);
      throw errorResponses.internalError();
    }
  },

  // Error Logs
  async getErrorLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { page, limit } = parsePagination(query.page, query.limit);
      const filters = {
        severity: query.severity,
        resolved: query.resolved === 'true',
        dateFrom: query.dateFrom ? new Date(query.dateFrom as string) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo as string) : undefined,
      };

      const result = await logsService.getErrorLogs(page, limit, filters);
      const response = createPaginatedResponse(result.data, result.total, page, limit);

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching error logs:', error);
      throw errorResponses.databaseError();
    }
  },

  async getErrorLogById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const logId = parseInt(id, 10);

      if (isNaN(logId)) {
        throw errorResponses.invalidParams({ id: 'must be a number' });
      }

      const data = await logsService.getErrorLogById(logId);

      if (!data) {
        throw errorResponses.notFound('Error log');
      }

      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching error log:', error);
      throw errorResponses.internalError();
    }
  },

  // Stats
  async getLogStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { guildId } = request.query as { guildId?: string };

      const [auditStats, commandStats, errorStats] = await Promise.all([
        logsService.getAuditLogStats(guildId),
        logsService.getCommandLogStats(guildId),
        logsService.getErrorLogStats(),
      ]);

      const response: ApiResponse = {
        data: {
          audit: auditStats,
          commands: commandStats,
          errors: errorStats,
        },
        meta: { timestamp: new Date().toISOString() },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching log stats:', error);
      throw errorResponses.internalError();
    }
  },
};
