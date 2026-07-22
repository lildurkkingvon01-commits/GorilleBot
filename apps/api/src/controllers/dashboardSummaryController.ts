/**
 * Dashboard Summary Controller
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getDashboardSummary } from '@/services/dashboardFormatterService';

export const dashboardSummaryController = {
  async getSummary(request: FastifyRequest, reply: FastifyReply) {
    try {
      const summary = await getDashboardSummary();
      return reply.code(200).send({
        data: summary,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('Dashboard summary error:', error);
      return reply.code(500).send({
        error: {
          code: 'DASHBOARD_ERROR',
          message: 'Failed to load dashboard summary',
        },
      });
    }
  },
};
