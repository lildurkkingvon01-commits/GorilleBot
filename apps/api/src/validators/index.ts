/**
 * Zod validators for all API requests
 */

import { z } from 'zod';

// Pagination validators
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const filterSchema = z.object({
  guildId: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  severity: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Request validators
export const logsQuerySchema = z.object({
  ...paginationSchema.shape,
  ...filterSchema.shape,
});

export const auditLogsQuerySchema = z.object({
  ...paginationSchema.shape,
  ...filterSchema.shape,
});

export const commandLogsQuerySchema = z.object({
  ...paginationSchema.shape,
  guildId: z.string().optional(),
  userId: z.string().optional(),
  commandName: z.string().optional(),
  success: z.enum(['true', 'false']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const errorLogsQuerySchema = z.object({
  ...paginationSchema.shape,
  severity: z.string().optional(),
  resolved: z.enum(['true', 'false']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Guild validators
export const guildIdParamSchema = z.object({
  guildId: z.string().min(1),
});

export const guildsQuerySchema = z.object({
  ...paginationSchema.shape,
  search: z.string().optional(),
  sort: z.enum(['name', 'members', 'created']).optional(),
});

// User validators
export const userIdParamSchema = z.object({
  userId: z.string().min(1),
});

export const usersQuerySchema = z.object({
  ...paginationSchema.shape,
  guildId: z.string().optional(),
  search: z.string().optional(),
});

// Command validators
export const commandIdParamSchema = z.object({
  commandId: z.coerce.number().int().positive(),
});

export const commandsQuerySchema = z.object({
  ...paginationSchema.shape,
  guildId: z.string().optional(),
  enabled: z.enum(['true', 'false']).optional(),
});

export const updateCommandSchema = z.object({
  enabled: z.boolean().optional(),
  cooldown: z.number().optional(),
  permission: z.string().optional(),
});

// Maintenance validators
export const maintenanceQuerySchema = z.object({
  ...paginationSchema.shape,
});

export const updateMaintenanceSchema = z.object({
  enabled: z.boolean().optional(),
  reason: z.string().optional(),
  affectedCommands: z.array(z.string()).optional(),
});

// Whitelist validators
export const whitelistQuerySchema = z.object({
  ...paginationSchema.shape,
  whitelistType: z.string().optional(),
});

// Backups validators
export const backupsQuerySchema = z.object({
  ...paginationSchema.shape,
  guildId: z.string().optional(),
  backupType: z.string().optional(),
});

// Flags validators
export const flagsQuerySchema = z.object({
  ...paginationSchema.shape,
});

// Analytics validators
export const analyticsQuerySchema = z.object({
  timeframe: z.enum(['day', 'week', 'month', 'year']).optional().default('month'),
  guildId: z.string().optional(),
});

// Settings validators
export const settingsQuerySchema = z.object({
  key: z.string().optional(),
});

export const updateSettingsSchema = z.object({
  key: z.string(),
  value: z.any(),
});

// Export all validators as a namespace
export const validators = {
  pagination: paginationSchema,
  filter: filterSchema,
  logsQuery: logsQuerySchema,
  auditLogsQuery: auditLogsQuerySchema,
  commandLogsQuery: commandLogsQuerySchema,
  errorLogsQuery: errorLogsQuerySchema,
  guildIdParam: guildIdParamSchema,
  guildsQuery: guildsQuerySchema,
  userIdParam: userIdParamSchema,
  usersQuery: usersQuerySchema,
  commandIdParam: commandIdParamSchema,
  commandsQuery: commandsQuerySchema,
  updateCommand: updateCommandSchema,
  maintenanceQuery: maintenanceQuerySchema,
  updateMaintenance: updateMaintenanceSchema,
  whitelistQuery: whitelistQuerySchema,
  backupsQuery: backupsQuerySchema,
  flagsQuery: flagsQuerySchema,
  analyticsQuery: analyticsQuerySchema,
  settingsQuery: settingsQuerySchema,
  updateSettings: updateSettingsSchema,
};

// Type exports
export type LogsQuery = z.infer<typeof logsQuerySchema>;
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
export type CommandLogsQuery = z.infer<typeof commandLogsQuerySchema>;
export type ErrorLogsQuery = z.infer<typeof errorLogsQuerySchema>;
export type GuildIdParam = z.infer<typeof guildIdParamSchema>;
export type GuildsQuery = z.infer<typeof guildsQuerySchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type UsersQuery = z.infer<typeof usersQuerySchema>;
export type CommandIdParam = z.infer<typeof commandIdParamSchema>;
export type CommandsQuery = z.infer<typeof commandsQuerySchema>;
export type UpdateCommand = z.infer<typeof updateCommandSchema>;
export type MaintenanceQuery = z.infer<typeof maintenanceQuerySchema>;
export type UpdateMaintenance = z.infer<typeof updateMaintenanceSchema>;
export type WhitelistQuery = z.infer<typeof whitelistQuerySchema>;
export type BackupsQuery = z.infer<typeof backupsQuerySchema>;
export type FlagsQuery = z.infer<typeof flagsQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type SettingsQuery = z.infer<typeof settingsQuerySchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
