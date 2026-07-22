/**
 * Commands Routes
 */

import { FastifyInstance } from 'fastify';
import { commandsController } from '@/controllers/commandsController';

export async function commandsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/commands', commandsController.getCommands);
  fastify.get('/api/commands/:commandId/stats', commandsController.getCommandStats);
  fastify.patch('/api/commands/:commandId', commandsController.updateCommand);
  fastify.post('/api/commands/:commandId/enable', commandsController.enableCommand);
  fastify.post('/api/commands/:commandId/disable', commandsController.disableCommand);
  fastify.post('/api/commands/:commandId/reset-stats', commandsController.resetCommandStats);
}
