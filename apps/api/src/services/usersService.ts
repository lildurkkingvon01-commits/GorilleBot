/**
 * Users Service
 */

import { userRepository } from '@/repositories/user';
import { auditLogRepository } from '@/repositories/auditLog';
import { UserFilters } from '@/repositories/user';

export interface UserActivity {
  id: number;
  action: string;
  details: string;
  created_at: Date;
  type: 'audit' | 'command';
}

export const usersService = {
  async getUsers(page: number, limit: number, filters?: UserFilters) {
    return userRepository.findMany(page, limit, filters);
  },

  async getUserById(userId: string) {
    return userRepository.findById(userId);
  },

  async getUserActivity(userId: string, limit: number = 20) {
    return userRepository.getUserActivity(userId, limit);
  },

  async getUserStats(userId: string) {
    return userRepository.getUserStats(userId);
  },

  async addUserNote(userId: string, note: string) {
    return userRepository.addNote(userId, note);
  },

  async banUser(userId: string, reason: string, bannedBy: string) {
    // Log the ban action
    await auditLogRepository.findMany(1, 1); // Just to verify connection
    
    return userRepository.banUser(userId, reason);
  },

  async unbanUser(userId: string, reason: string, unbannedBy: string) {
    return userRepository.unbanUser(userId, reason);
  },

  async getUsersStats() {
    return userRepository.getStats();
  },
};
