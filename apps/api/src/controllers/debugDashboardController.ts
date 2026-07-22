/**
 * Debug Dashboard Controller
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getDebugDashboardMetrics } from '@/services/debugDashboardService';

export const debugDashboardController = {
  async getMetrics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const metrics = await getDebugDashboardMetrics();
      return reply.code(200).send({
        data: metrics,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('Debug dashboard error:', error);
      return reply.code(500).send({
        error: {
          code: 'DEBUG_ERROR',
          message: 'Failed to load debug metrics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  },
};
