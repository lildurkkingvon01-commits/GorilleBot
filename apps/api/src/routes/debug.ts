/**
 * Debug Routes
 * TEMPORARY - For development/debugging only
 */

import { FastifyInstance } from 'fastify';
import { debugController } from '@/controllers/debugController';
import { debugDashboardController } from '@/controllers/debugDashboardController';

export async function debugRoutes(fastify: FastifyInstance) {
  // Get dashboard data sources
  fastify.get('/api/debug/dashboard-sources', debugController.getDashboardSources);

  // Get dashboard metrics (raw, filtered, excluded)
  fastify.get('/api/debug/dashboard-metrics', debugDashboardController.getMetrics);

  // Get servers data sources - for servers page diagnostics
  fastify.get('/api/debug/servers-sources', debugController.getServersSources);
}
