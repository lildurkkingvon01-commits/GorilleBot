/**
 * Users Controller
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { usersService } from '@/services/usersService';
import { errorResponses } from '@/utils/errors';
import { parsePagination } from '@/utils/pagination';
import { ApiResponse } from '@/types';

export const usersController = {
  async getUsers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { page, limit } = parsePagination(query.page, query.limit);

      const result = await usersService.getUsers(page, limit, {
        search: query.search,
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

  async getUserById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.params as any;

      const user = await usersService.getUserById(userId);

      if (!user) {
        throw errorResponses.notFound('User not found');
      }

      return reply.send({
        data: user,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw error;
    }
  },

  async getUserActivity(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.params as any;
      const query = request.query as any;
      const limit = Math.min(parseInt(query.limit) || 20, 100);

      const activity = await usersService.getUserActivity(userId, limit);

      return reply.send({
        data: activity,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async addUserNote(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.params as any;
      const { note } = request.body as any;

      if (!note) {
        throw errorResponses.invalidParams('Note is required');
      }

      const result = await usersService.addUserNote(userId, note);

      return reply.status(201).send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw error;
    }
  },

  async banUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.params as any;
      const { reason, bannedBy } = request.body as any;

      const result = await usersService.banUser(userId, reason, bannedBy);

      return reply.status(201).send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async unbanUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.params as any;
      const { reason, unbannedBy } = request.body as any;

      const result = await usersService.unbanUser(userId, reason, unbannedBy);

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },
};
