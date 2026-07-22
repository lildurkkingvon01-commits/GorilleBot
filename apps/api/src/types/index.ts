/**
 * Global Types for API
 */

export interface ApiResponse<T = any> {
  data?: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    timestamp?: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface FilterParams {
  guildId?: string;
  userId?: string;
  action?: string;
  severity?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface BotStatus {
  uptime: number;
  status: 'online' | 'offline' | 'maintenance';
  guilds: number;
  users: number;
  latency: number;
}

export interface DashboardOverview {
  totalGuilds: number;
  totalUsers: number;
  totalCommands: number;
  totalWarnings: number;
  commandStats: {
    today: number;
    week: number;
    month: number;
  };
  auditStats: {
    today: number;
    week: number;
    month: number;
  };
  topCommands: Array<{
    name: string;
    count: number;
  }>;
  topUsers: Array<{
    id: string;
    username?: string;
    count: number;
  }>;
}

export interface ActivityLog {
  id: number;
  type: string;
  userId: string;
  guildId?: string;
  action: string;
  details?: any;
  createdAt: Date;
}

export interface CommandStatistics {
  total: number;
  today: number;
  week: number;
  month: number;
  topCommands: Array<{
    name: string;
    count: number;
  }>;
  failureRate: number;
}

export interface AuditLogEntry {
  id: number;
  userId: string;
  guildId?: string;
  action: string;
  targetId?: string;
  targetName?: string;
  details?: any;
  createdAt: Date;
}

export interface GuildInfo {
  id: string;
  name: string;
  icon?: string;
  ownerId?: string;
  prefix?: string;
  config?: any;
  stats?: GuildStats;
  createdAt: Date;
}

export interface GuildStats {
  memberCount: number;
  commandCount: number;
  warningCount: number;
  muteCount: number;
  banCount: number;
  totalMessagesSeen: number;
  totalCommandsRan: number;
}

export interface UserInfo {
  id: string;
  guilds?: number;
  commandCount?: number;
  warnings?: number;
  bans?: number;
  banned?: boolean;
}

export interface CommandInfo {
  id: number;
  name: string;
  enabled: boolean;
  updatedAt: Date;
}

export interface MaintenanceStatus {
  id: number;
  type: string;
  enabled: boolean;
  startedAt?: Date;
  endedAt?: Date;
  reason?: string;
  affectedCommands?: string[];
}
