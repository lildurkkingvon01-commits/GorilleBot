/**
 * Commands Controller
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { commandsService } from '@/services/commandsService';
import { errorResponses } from '@/utils/errors';
import { parsePagination } from '@/utils/pagination';
import { ApiResponse } from '@/types';

export const commandsController = {
  async getCommands(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { page, limit } = parsePagination(query.page, query.limit);

      const result = await commandsService.getCommands(page, limit, {
        enabled: query.enabled ? query.enabled === 'true' : undefined,
      });

      return reply.send({
        data: result.data,
        meta: {
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            pages: result.pages,
          },
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse<any>);
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async getCommandStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { commandId } = request.params as any;

      const cmd = await commandsService.getCommandById(commandId);
      if (!cmd) {
        throw errorResponses.notFound('Command not found');
      }

      const stats = await commandsService.getCommandStats(cmd.command_name);

      return reply.send({
        data: stats,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw error;
    }
  },

  async updateCommand(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { commandId } = request.params as any;
      const { enabled, cooldown, permission } = request.body as any;

      const cmd = await commandsService.getCommandById(commandId);
      if (!cmd) {
        throw errorResponses.notFound('Command not found');
      }

      return reply.send({
        data: { commandId, enabled, cooldown, permission },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw error;
    }
  },

  async enableCommand(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { commandId } = request.params as any;

      const cmd = await commandsService.getCommandById(commandId);
      if (!cmd) {
        throw errorResponses.notFound('Command not found');
      }

      const result = await commandsService.enableCommand(cmd.command_name);

      return reply.status(201).send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async disableCommand(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { commandId } = request.params as any;

      const cmd = await commandsService.getCommandById(commandId);
      if (!cmd) {
        throw errorResponses.notFound('Command not found');
      }

      const result = await commandsService.disableCommand(cmd.command_name);

      return reply.status(201).send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async resetCommandStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { commandId } = request.params as any;

      const cmd = await commandsService.getCommandById(commandId);
      if (!cmd) {
        throw errorResponses.notFound('Command not found');
      }

      const result = await commandsService.resetCommandStats(cmd.command_name);

      return reply.status(201).send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },
};
