/**
 * Analytics Controller
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { analyticsService } from '@/services/analyticsService';
import { errorResponses } from '@/utils/errors';
import { ApiResponse } from '@/types';

export const analyticsController = {
  async getOverview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const timeframe = query.timeframe || 'month';

      const result = await analyticsService.getOverview(timeframe, query.guildId);

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async getGuildGrowth(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const timeframe = query.timeframe || 'month';

      if (!query.guildId) {
        throw errorResponses.invalidParams('guildId is required');
      }

      const result = await analyticsService.getGuildGrowth(query.guildId, timeframe);

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw error;
    }
  },

  async getCommandUsage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const timeframe = query.timeframe || 'month';

      const result = await analyticsService.getCommandUsage(query.guildId, timeframe);

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async getModerationStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const timeframe = query.timeframe || 'month';

      const result = await analyticsService.getModerationStats(query.guildId, timeframe);

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async getActivityHeatmap(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const days = Math.min(parseInt(query.days) || 30, 365);

      const result = await analyticsService.getActivityHeatmap(query.guildId, days);

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },
};
