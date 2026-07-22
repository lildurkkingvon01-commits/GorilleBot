/**
 * Analytics Routes
 */

import { FastifyInstance } from 'fastify';
import { analyticsController } from '@/controllers/analyticsController';

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/analytics/overview', analyticsController.getOverview);
  fastify.get('/api/analytics/guild-growth', analyticsController.getGuildGrowth);
  fastify.get('/api/analytics/command-usage', analyticsController.getCommandUsage);
  fastify.get('/api/analytics/moderation', analyticsController.getModerationStats);
  fastify.get('/api/analytics/activity-heatmap', analyticsController.getActivityHeatmap);
}
