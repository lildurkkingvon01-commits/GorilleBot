// ============================================================================
// SHARED TYPES - Redguard Bot & API
// ============================================================================

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface AuditLog {
  id: string;
  action: string;
  action_type?: string;
  user_id: string;
  guild_id?: string;
  details: Record<string, any>;
  created_at: Date;
  updated_at?: Date;
}

export interface CommandLog {
  id: string;
  user_id: string;
  guild_id: string;
  command_name: string;
  args?: Record<string, any>;
  created_at: Date;
}

export interface Server {
  id: string;
  guild_id: string;
  name: string;
  icon?: string;
  owner_id: string;
  member_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface BotUser {
  id: string;
  user_id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  is_banned: boolean;
  ban_reason?: string;
  banned_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Backup {
  id: string;
  guild_id: string;
  name: string;
  data: Record<string, any>;
  created_by: string;
  created_at: Date;
  size: number;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  timestamp: string;
}

export interface AuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface AuditLogQuery extends PaginationQuery {
  action?: string;
  user_id?: string;
  guild_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface CommandLogQuery extends PaginationQuery {
  user_id?: string;
  guild_id?: string;
  command_name?: string;
  start_date?: string;
  end_date?: string;
}

// ============================================================================
// DISCORD TYPES
// ============================================================================

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  email?: string;
  verified?: boolean;
  locale?: string;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  icon_hash?: string;
  splash?: string;
  discovery_splash?: string;
  owner_id: string;
  region?: string;
  afk_channel_id?: string;
  afk_timeout?: number;
  widget_enabled?: boolean;
  widget_channel_id?: string;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  roles: any[];
  emojis: any[];
  features: string[];
  mfa_level: number;
  application_id?: string;
  system_channel_id?: string;
  system_channel_flags: number;
  rules_channel_id?: string;
  joined_at?: string;
  large?: boolean;
  unavailable?: boolean;
  member_count?: number;
  voice_states?: any[];
  members?: any[];
  channels?: any[];
  presences?: any[];
  max_presences?: number;
  max_members?: number;
  vanity_url_code?: string;
  description?: string;
  banner?: string;
  premium_tier: number;
  premium_subscription_count?: number;
  preferred_locale: string;
  public_updates_channel_id?: string;
  max_video_channel_users?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  welcome_screen?: any;
}

// ============================================================================
// ADMIN PANEL TYPES
// ============================================================================

export type ActionCategory = 'COMMAND_USED' | 'SANCTIONS' | 'MAINTENANCE';

export interface AdminPanelStats {
  total_servers: number;
  total_users: number;
  total_commands: number;
  total_errors: number;
  total_sanctions: number;
  total_backups: number;
  uptime_hours: number;
  avg_latency: number;
}

export interface AdminPanelAction {
  id: string;
  action: string;
  action_canonical: string;
  user_id: string;
  guild_id?: string;
  details: Record<string, any>;
  created_at: Date;
}

// ============================================================================
// AUTH TYPES
// ============================================================================

export interface Session {
  user_id: string;
  username: string;
  avatar?: string;
  email?: string;
  roles: string[];
  permissions: string[];
  created_at: Date;
  expires_at: Date;
}

export interface AuthUser {
  id: string;
  user_id: string;
  username: string;
  email?: string;
  avatar?: string;
  roles: string[];
  is_admin: boolean;
  is_moderator: boolean;
  created_at: Date;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ApiError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;
}

export type ErrorCode =
  | 'AUTH_INVALID'
  | 'AUTH_EXPIRED'
  | 'AUTH_REQUIRED'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'RATE_LIMIT'
  | 'PERMISSION_DENIED'
  | 'RESOURCE_NOT_FOUND';
