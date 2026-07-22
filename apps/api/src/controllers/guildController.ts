/**
 * Guilds Controller
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { guildService } from '@/services/guildService';
import { ApiResponse } from '@/types';
import { errorResponses } from '@/utils/errors';
import { parsePagination, createPaginatedResponse } from '@/utils/pagination';

export const guildController = {
  async getGuilds(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { page, limit } = parsePagination(query.page, query.limit);
      const filters = {
        search: query.search as string | undefined,
        sort: query.sort as 'name' | 'members' | 'created' | undefined,
      };

      const result = await guildService.getGuilds(page, limit, filters);
      const response = createPaginatedResponse(result.data, result.total, page, limit);

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching guilds:', error);
      throw errorResponses.databaseError();
    }
  },

  async getGuildById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { guildId } = request.params as { guildId: string };

      const data = await guildService.getGuildById(guildId);

      if (!data) {
        throw errorResponses.notFound('Guild');
      }

      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching guild:', error);
      throw errorResponses.internalError();
    }
  },

  async getGuildStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { guildId } = request.params as { guildId: string };

      const guild = await guildService.getGuildById(guildId);

      if (!guild) {
        throw errorResponses.notFound('Guild');
      }

      const stats = await guildService.getGuildStats(guildId);
      const activity = await guildService.getGuildActivityStats(guildId);

      const response: ApiResponse = {
        data: {
          guild: {
            id: guild.id,
            name: guild.name,
          },
          stats,
          activity,
        },
        meta: { timestamp: new Date().toISOString() },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching guild stats:', error);
      throw errorResponses.internalError();
    }
  },

  async getTopGuilds(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const metric = (query.metric as 'members' | 'commands') || 'members';
      const limit = Math.min(parseInt(query.limit as string) || 10, 100);

      const data = await guildService.getTopGuilds(metric, limit);

      const response: ApiResponse = {
        data,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching top guilds:', error);
      throw errorResponses.internalError();
    }
  },

  async getGuildTotal(request: FastifyRequest, reply: FastifyReply) {
    try {
      const total = await guildService.getGuildTotal();

      const response: ApiResponse = {
        data: { total },
        meta: { timestamp: new Date().toISOString() },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching guild total:', error);
      throw errorResponses.internalError();
    }
  },

  async getGuildAggregate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await guildService.getGuildAggregate();

      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching guild aggregate:', error);
      throw errorResponses.internalError();
    }
  },
};
