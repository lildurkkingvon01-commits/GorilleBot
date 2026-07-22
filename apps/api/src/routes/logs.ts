/**
 * Logs Routes
 */

import { FastifyInstance } from 'fastify';
import { logsController } from '@/controllers/logsController';

export async function logsRoutes(fastify: FastifyInstance) {
  // Audit Logs
  fastify.get('/api/logs/audit', logsController.getAuditLogs);
  fastify.get('/api/logs/audit/:id', logsController.getAuditLogById);

  // Command Logs
  fastify.get('/api/logs/commands', logsController.getCommandLogs);
  fastify.get('/api/logs/commands/:id', logsController.getCommandLogById);

  // Error Logs
  fastify.get('/api/logs/errors', logsController.getErrorLogs);
  fastify.get('/api/logs/errors/:id', logsController.getErrorLogById);

  // Log Statistics
  fastify.get('/api/logs/stats', logsController.getLogStats);
}
