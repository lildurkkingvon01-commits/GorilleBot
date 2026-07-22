/**
 * Dashboard Controller
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { dashboardService } from '@/services/dashboardService';
import { ApiResponse } from '@/types';
import { errorResponses } from '@/utils/errors';

export const dashboardController = {
  async getOverview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await dashboardService.getOverview();
      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };
      return reply.send(response);
    } catch (error) {
      console.error('Error fetching dashboard overview:', error);
      throw errorResponses.internalError();
    }
  },

  async getBotStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await dashboardService.getBotStatus();
      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };
      return reply.send(response);
    } catch (error) {
      console.error('Error fetching bot status:', error);
      throw errorResponses.internalError();
    }
  },

  async getActivity(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await dashboardService.getActivity();
      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };
      return reply.send(response);
    } catch (error) {
      console.error('Error fetching activity:', error);
      throw errorResponses.internalError();
    }
  },

  async getCommandStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await dashboardService.getCommandStats();
      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };
      return reply.send(response);
    } catch (error) {
      console.error('Error fetching command stats:', error);
      throw errorResponses.internalError();
    }
  },

  async getGrowth(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await dashboardService.getGrowthMetrics();
      const response: ApiResponse = {
        data,
        meta: { timestamp: new Date().toISOString() },
      };
      return reply.send(response);
    } catch (error) {
      console.error('Error fetching growth metrics:', error);
      throw errorResponses.internalError();
    }
  },
};
