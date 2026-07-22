/**
 * Users Routes
 */

import { FastifyInstance } from 'fastify';
import { usersController } from '@/controllers/usersController';

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get('/api/users', usersController.getUsers);
  fastify.get('/api/users/:userId', usersController.getUserById);
  fastify.get('/api/users/:userId/activity', usersController.getUserActivity);
  fastify.patch('/api/users/:userId/notes', usersController.addUserNote);
  fastify.post('/api/users/:userId/ban', usersController.banUser);
  fastify.post('/api/users/:userId/unban', usersController.unbanUser);
}
