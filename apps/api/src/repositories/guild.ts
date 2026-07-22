/**
 * Guild Repository
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { calculateSkip, PaginationResult } from '@/utils/pagination';

const prisma = new PrismaClient();

export interface GuildFilters {
  search?: string;
  sort?: 'name' | 'members' | 'created';
}

export const guildRepository = {
  async findMany(
    page: number,
    limit: number,
    filters?: GuildFilters
  ): Promise<PaginationResult<any>> {
    const where: Prisma.GuildWhereInput = {};

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { id: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { id: 'asc' };
    if (filters?.sort === 'name') {
      orderBy = { name: 'asc' };
    } else if (filters?.sort === 'members') {
      orderBy = { member_count: 'desc' } as any;
    } else if (filters?.sort === 'created') {
      orderBy = { created_at: 'desc' } as any;
    }

    const [data, total] = await Promise.all([
      prisma.guild.findMany({
        where,
        orderBy,
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.guild.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  },

  async findById(guildId: string) {
    return prisma.guild.findUnique({
      where: { id: guildId },
    });
  },

  async findByIdSimple(guildId: string) {
    return prisma.guild.findUnique({
      where: { id: guildId },
    });
  },

  async getTotalCount() {
    return prisma.guild.count();
  },

  async getTopGuildsByMembers(limit: number = 10) {
    return prisma.guild.findMany({
      orderBy: {
        member_count: 'desc',
      },
      take: limit,
    });
  },

  async getTopGuildsByCommands(limit: number = 10) {
    // Since we don't have a direct command count on Guild, use commands from logs
    return prisma.guild.findMany({
      orderBy: {
        member_count: 'desc',
      },
      take: limit,
    });
  },

  async getGuildStats(guildId: string) {
    return prisma.guildStats.findFirst({
      where: { guild_id: guildId },
    });
  },
};

export const guildStatsRepository = {
  async findByGuildId(guildId: string) {
    return prisma.guildStats.findFirst({
      where: { guild_id: guildId },
    });
  },

  async getAggregate() {
    const stats = await prisma.guildStats.aggregate({
      _sum: {
        execution_count: true,
      },
      _avg: {
        execution_count: true,
      },
      _max: {
        execution_count: true,
      },
    });

    return {
      _sum: { execution_count: stats._sum?.execution_count || 0 },
      _avg: { execution_count: stats._avg?.execution_count || 0 },
      _max: { execution_count: stats._max?.execution_count || 0 },
    };
  },

  async getTotalMembers() {
    const result = await prisma.guild.aggregate({
      _sum: {
        member_count: true,
      },
    });

    return result._sum?.member_count || 0;
  },

  async getTotalCommands() {
    const result = await prisma.guildStats.aggregate({
      _sum: {
        execution_count: true,
      },
    });

    return result._sum?.execution_count || 0;
  },

  async getTopStats(field: 'member_count', limit: number = 10) {
    return prisma.guild.findMany({
      orderBy: {
        [field]: 'desc',
      } as any,
      take: limit,
    });
  },
};
