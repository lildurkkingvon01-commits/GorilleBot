/**
 * Guilds Routes
 */

import { FastifyInstance } from 'fastify';
import { guildController } from '@/controllers/guildController';
import { serverListController } from '@/controllers/serverListController';

export async function guildRoutes(fastify: FastifyInstance) {
  // Servers page - comprehensive list with stats
  fastify.get('/api/servers', serverListController.getServers);
  fastify.get('/api/servers/:guildId', serverListController.getServerById);

  // Get all guilds
  fastify.get('/api/guilds', guildController.getGuilds);

  // Get guild by ID
  fastify.get('/api/guilds/:guildId', guildController.getGuildById);

  // Get guild stats
  fastify.get('/api/guilds/:guildId/stats', guildController.getGuildStats);

  // Get top guilds
  fastify.get('/api/guilds/top', guildController.getTopGuilds);

  // Get total guilds
  fastify.get('/api/guilds/total', guildController.getGuildTotal);

  // Get guild aggregate
  fastify.get('/api/guilds/aggregate', guildController.getGuildAggregate);
}
