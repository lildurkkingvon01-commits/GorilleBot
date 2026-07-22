// ============================================================================
// PERMISSIONS & ROLES SYSTEM
// ============================================================================

export enum Permission {
  // Admin Panel Access
  VIEW_DASHBOARD = 'view_dashboard',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  VIEW_COMMAND_LOGS = 'view_command_logs',
  VIEW_SERVERS = 'view_servers',
  VIEW_USERS = 'view_users',
  
  // User Management
  BAN_USER = 'ban_user',
  UNBAN_USER = 'unban_user',
  KICK_USER = 'kick_user',
  MUTE_USER = 'mute_user',
  
  // Guild Management
  BAN_GUILD = 'ban_guild',
  UNBAN_GUILD = 'unban_guild',
  
  // Command Management
  ENABLE_COMMAND = 'enable_command',
  DISABLE_COMMAND = 'disable_command',
  TOGGLE_MAINTENANCE = 'toggle_maintenance',
  MANAGE_WHITELIST = 'manage_whitelist',
  
  // Server Management
  MANAGE_SERVERS = 'manage_servers',
  VIEW_SERVER_SETTINGS = 'view_server_settings',
  UPDATE_SERVER_SETTINGS = 'update_server_settings',
  
  // Backup Management
  CREATE_BACKUP = 'create_backup',
  RESTORE_BACKUP = 'restore_backup',
  DELETE_BACKUP = 'delete_backup',
  VIEW_BACKUPS = 'view_backups',
  
  // System Management
  MANAGE_BOT_SETTINGS = 'manage_bot_settings',
  VIEW_BOT_STATS = 'view_bot_stats',
  RESTART_BOT = 'restart_bot',
  
  // Feature Flags
  MANAGE_FLAGS = 'manage_flags',
}

export enum Role {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
}

// ============================================================================
// ROLE-PERMISSION MAPPING
// ============================================================================

export const RolePermissions: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    // All permissions
    ...Object.values(Permission),
  ],
  
  [Role.ADMIN]: [
    // Admin Panel Access
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_AUDIT_LOGS,
    Permission.VIEW_COMMAND_LOGS,
    Permission.VIEW_SERVERS,
    Permission.VIEW_USERS,
    
    // User Management
    Permission.BAN_USER,
    Permission.UNBAN_USER,
    Permission.KICK_USER,
    Permission.MUTE_USER,
    
    // Guild Management
    Permission.BAN_GUILD,
    Permission.UNBAN_GUILD,
    
    // Command Management
    Permission.ENABLE_COMMAND,
    Permission.DISABLE_COMMAND,
    Permission.TOGGLE_MAINTENANCE,
    Permission.MANAGE_WHITELIST,
    
    // Server Management
    Permission.MANAGE_SERVERS,
    Permission.VIEW_SERVER_SETTINGS,
    Permission.UPDATE_SERVER_SETTINGS,
    
    // Backup Management
    Permission.CREATE_BACKUP,
    Permission.RESTORE_BACKUP,
    Permission.DELETE_BACKUP,
    Permission.VIEW_BACKUPS,
    
    // System Management
    Permission.MANAGE_BOT_SETTINGS,
    Permission.VIEW_BOT_STATS,
    
    // Feature Flags
    Permission.MANAGE_FLAGS,
  ],
  
  [Role.MODERATOR]: [
    // Admin Panel Access (read-only)
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_AUDIT_LOGS,
    Permission.VIEW_COMMAND_LOGS,
    Permission.VIEW_SERVERS,
    Permission.VIEW_USERS,
    
    // User Management
    Permission.BAN_USER,
    Permission.UNBAN_USER,
    Permission.KICK_USER,
    Permission.MUTE_USER,
    
    // View only
    Permission.VIEW_SERVER_SETTINGS,
    Permission.VIEW_BACKUPS,
    Permission.VIEW_BOT_STATS,
  ],
  
  [Role.MEMBER]: [
    // Basic read access
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_BOT_STATS,
  ],
};

// ============================================================================
// PERMISSION CHECKING UTILITIES
// ============================================================================

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = RolePermissions[role];
  return permissions.includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((perm) => hasPermission(role, perm));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}

export function getRolePermissions(role: Role): Permission[] {
  return RolePermissions[role] || [];
}

// ============================================================================
// DISCORD PERMISSION MAPPING
// ============================================================================

export const DiscordPermissionFlags = {
  ADMINISTRATOR: 1n << 3n,
  BAN_MEMBERS: 1n << 2n,
  KICK_MEMBERS: 1n << 1n,
  MANAGE_MESSAGES: 1n << 13n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_GUILD_EXPRESSIONS: 1n << 30n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MODERATE_MEMBERS: 1n << 40n,
};

export function hasDiscordPermission(permissions: bigint, flag: bigint): boolean {
  return (permissions & flag) === flag;
}

// ============================================================================
// ADMIN ROLE DETECTION
// ============================================================================

export function isAdminRole(roleName: string): boolean {
  const adminRolePatterns = ['admin', 'moderator', 'staff', 'manager', 'owner'];
  return adminRolePatterns.some((pattern) =>
    roleName.toLowerCase().includes(pattern),
  );
}

export function isOwner(userId: string, ownerId: string): boolean {
  return userId === ownerId;
}

// ============================================================================
// AUDIT LOG PERMISSION CATEGORIES
// ============================================================================

export const AuditLogPermissionMap: Record<string, Permission[]> = {
  COMMAND_USED: [Permission.VIEW_COMMAND_LOGS],
  USER_BANNED: [Permission.BAN_USER],
  GUILD_BANNED: [Permission.BAN_GUILD],
  USER_UNBANNED: [Permission.UNBAN_USER],
  GUILD_UNBANNED: [Permission.UNBAN_GUILD],
  BOT_EXPELLED: [Permission.VIEW_AUDIT_LOGS],
  COMMAND_MAINTENANCE_ENABLE: [Permission.TOGGLE_MAINTENANCE],
  COMMAND_MAINTENANCE_DISABLE: [Permission.TOGGLE_MAINTENANCE],
  MAINTENANCE_WHITELIST_ADD: [Permission.MANAGE_WHITELIST],
  MAINTENANCE_WHITELIST_REMOVE: [Permission.MANAGE_WHITELIST],
  MAINTENANCE_COMMAND: [Permission.MANAGE_WHITELIST],
};

export function canViewAction(role: Role, action: string): boolean {
  const requiredPermissions = AuditLogPermissionMap[action];
  if (!requiredPermissions) return true; // Default allow if action not mapped
  
  return hasAnyPermission(role, requiredPermissions);
}
