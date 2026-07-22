/**
 * Bot Routes - Endpoints for bot to sync actions
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function botRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/bot/guild-actions
   * Returns pending guild actions for the bot to execute
   */
  fastify.get('/api/bot/guild-actions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pendingActions = await prisma.guildAction.findMany({
        where: {
          status: 'PENDING',
        },
        orderBy: { created_at: 'asc' },
        take: 100, // Get up to 100 pending actions
      });

      return reply.send({
        data: pendingActions,
        meta: {
          timestamp: new Date().toISOString(),
          count: pendingActions.length,
        },
      });
    } catch (error) {
      console.error('Error fetching guild actions:', error);
      return reply.status(500).send({
        error: 'Failed to fetch guild actions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/bot/guild-actions/:id/complete
   * Mark a guild action as completed
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/bot/guild-actions/:id/complete',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const actionId = parseInt(id, 10);

        console.log(`[BOT ACTIONS] Marking action ${actionId} as COMPLETED`);

        if (isNaN(actionId)) {
          console.warn(`[BOT ACTIONS] Invalid action ID: ${id}`);
          return reply.status(400).send({ error: 'Invalid action ID' });
        }

        // Use updateMany to avoid "Record not found" error
        const updated = await prisma.guildAction.updateMany({
          where: { id: actionId },
          data: {
            status: 'COMPLETED',
            executed_at: new Date(),
          },
        });

        if (updated.count === 0) {
          console.warn(`[BOT ACTIONS] Action ${actionId} not found`);
          return reply.status(404).send({ error: 'Action not found' });
        }

        // Fetch the updated record
        const completed = await prisma.guildAction.findUnique({
          where: { id: actionId },
        });

        console.log(`[BOT ACTIONS] ✅ Action ${actionId} marked as COMPLETED in DB`);

        return reply.send({
          data: completed,
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (error) {
        console.error(`[BOT ACTIONS] ❌ Error completing guild action:`, error);
        return reply.status(500).send({
          error: 'Failed to complete action',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/bot/guild-actions/:id/fail
   * Mark a guild action as failed
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/bot/guild-actions/:id/fail',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const { reason } = request.body as { reason?: string };
        const actionId = parseInt(id, 10);

        if (isNaN(actionId)) {
          return reply.status(400).send({ error: 'Invalid action ID' });
        }

        const failed = await prisma.guildAction.update({
          where: { id: actionId },
          data: {
            status: 'FAILED',
            executed_at: new Date(),
            reason: reason || 'Action failed',
          },
        });

        console.error(`[BOT ACTIONS] Action ${actionId} marked as FAILED: ${reason || 'No reason'}`);

        return reply.send({
          data: failed,
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (error) {
        console.error('Error failing guild action:', error);
        return reply.status(500).send({
          error: 'Failed to mark action as failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
