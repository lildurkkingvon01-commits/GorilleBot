/**
 * Debug Controller
 * TEMPORARY - For development/debugging only
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { debugService } from '@/services/debugService';

export const debugController = {
  async getDashboardSources(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await debugService.getDashboardSources();
      return reply.send({
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('Error fetching debug data:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  },

  async getServersSources(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await debugService.getServersSources();
      return reply.send({
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('Error in debugController.getServersSources:', error);
      return reply.status(500).send({
        error: {
          code: 'DEBUG_ERROR',
          message: 'Failed to retrieve server sources',
        },
      });
    }
  },
};
