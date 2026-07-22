/**
 * Dashboard Routes
 */

import { FastifyInstance } from 'fastify';
import { dashboardController } from '@/controllers/dashboardController';
import { dashboardSummaryController } from '@/controllers/dashboardSummaryController';

export async function dashboardRoutes(fastify: FastifyInstance) {
  // Get dashboard summary (UI-ready, formatted data)
  fastify.get('/api/dashboard/summary', dashboardSummaryController.getSummary);

  // Get dashboard overview
  fastify.get('/api/dashboard/overview', dashboardController.getOverview);

  // Get bot status
  fastify.get('/api/dashboard/bot-status', dashboardController.getBotStatus);

  // Get recent activity
  fastify.get('/api/dashboard/activity', dashboardController.getActivity);

  // Get command statistics
  fastify.get('/api/dashboard/command-stats', dashboardController.getCommandStats);

  // Get growth metrics
  fastify.get('/api/dashboard/growth', dashboardController.getGrowth);
}
