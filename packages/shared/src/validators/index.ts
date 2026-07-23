import { z } from 'zod';

// ============================================================================
// PAGINATION VALIDATORS
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// QUERY VALIDATORS
// ============================================================================

export const AuditLogQuerySchema = PaginationSchema.extend({
  action: z.string().optional(),
  user_id: z.string().optional(),
  guild_id: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export const CommandLogQuerySchema = PaginationSchema.extend({
  user_id: z.string().optional(),
  guild_id: z.string().optional(),
  command_name: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export const ServerQuerySchema = PaginationSchema.extend({
  search: z.string().optional(),
  guild_id: z.string().optional(),
});

export const UserQuerySchema = PaginationSchema.extend({
  search: z.string().optional(),
  is_banned: z.boolean().optional(),
});

// ============================================================================
// REQUEST BODY VALIDATORS
// ============================================================================

export const BanUserSchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  guild_id: z.string().optional(),
  reason: z.string().min(1).max(500).optional(),
  duration_days: z.number().int().min(0).optional(),
});

export const CreateBackupSchema = z.object({
  guild_id: z.string().min(1, 'guild_id is required'),
  name: z.string().min(1).max(100),
});

export const UpdateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
});

export const CreateWhitelistSchema = z.object({
  user_id: z.string().optional(),
  role_id: z.string().optional(),
  type: z.enum(['USER', 'ROLE']),
  reason: z.string().optional(),
});

// ============================================================================
// FILTERS & VALIDATORS
// ============================================================================

export const ActionFilterSchema = z.enum([
  'COMMAND_USED',
  'USER_BANNED',
  'GUILD_BANNED',
  'USER_UNBANNED',
  'GUILD_UNBANNED',
  'BOT_EXPELLED',
  'MAINTENANCE_WHITELIST_ADD',
  'MAINTENANCE_WHITELIST_REMOVE',
  'MAINTENANCE_COMMAND',
]);

// ============================================================================
// UTILITY VALIDATORS
// ============================================================================

export const SnowflakeSchema = z.string().regex(/^\d{17,20}$/, 'Invalid Discord ID');

export const DiscordIdSchema = z.string().min(17).max(20);

export const DateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PaginationParams = z.infer<typeof PaginationSchema>;
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
export type CommandLogQuery = z.infer<typeof CommandLogQuerySchema>;
export type ServerQuery = z.infer<typeof ServerQuerySchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
export type BanUserInput = z.infer<typeof BanUserSchema>;
export type CreateBackupInput = z.infer<typeof CreateBackupSchema>;
export type UpdateSettingInput = z.infer<typeof UpdateSettingSchema>;
export type CreateWhitelistInput = z.infer<typeof CreateWhitelistSchema>;
export type ActionFilter = z.infer<typeof ActionFilterSchema>;
