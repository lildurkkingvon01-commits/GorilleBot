/**
 * Server List Controller
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { serverListService } from '@/services/serverListService';
import { ApiResponse } from '@/types';
import { errorResponses } from '@/utils/errors';

export const serverListController = {
  async getServers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      
      const filters = {
        search: query.search as string | undefined,
        guildId: query.guildId as string | undefined,
        sort: (query.sort as string)?.toLowerCase() as 'activity' | 'members' | 'name' | undefined,
        page: parseInt(query.page as string) || 1,
        limit: Math.min(parseInt(query.limit as string) || 20, 100),
      };

      const result = await serverListService.getServers(filters);

      const response: ApiResponse = {
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching servers:', error);
      throw errorResponses.databaseError();
    }
  },

  async getServerById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { guildId } = request.params as { guildId: string };

      const data = await serverListService.getServerById(guildId);

      if (!data) {
        throw errorResponses.notFound('Server');
      }

      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };

      return reply.send(response);
    } catch (error) {
      console.error('Error fetching server:', error);
      throw errorResponses.internalError();
    }
  },
};
