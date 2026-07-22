/**
 * Discord Snowflake & Data Validators
 */

/**
 * Check if value is a valid Discord snowflake (17-20 digit string)
 * Discord IDs are typically 18-20 characters, but we accept 17-20 to be safe
 */
export function isDiscordSnowflake(value: any): value is string {
  return typeof value === 'string' && /^\d{17,20}$/.test(value);
}

/**
 * Check if a command name is a test command to be excluded
 */
export function isTestCommand(commandName: any): boolean {
  if (!commandName || typeof commandName !== 'string') {
    return false;
  }
  return (
    commandName.startsWith('test_') ||
    ['test_command', 'test_error_cmd'].includes(commandName)
  );
}

/**
 * Validate and filter guild IDs - only keep valid Discord snowflakes
 */
export function filterValidGuildIds(guildIds: Set<string | null>): Set<string> {
  const validIds = new Set<string>();
  guildIds.forEach((id) => {
    if (id && isDiscordSnowflake(id)) {
      validIds.add(id);
    }
  });
  return validIds;
}

/**
 * Get invalid (fake/test) guild IDs
 */
export function getInvalidGuildIds(guildIds: Set<string | null>): Set<string> {
  const invalidIds = new Set<string>();
  guildIds.forEach((id) => {
    if (id && !isDiscordSnowflake(id)) {
      invalidIds.add(id);
    }
  });
  return invalidIds;
}

/**
 * Validate and filter user IDs - only keep valid Discord snowflakes
 */
export function filterValidUserIds(userIds: Set<string | null>): Set<string> {
  const validIds = new Set<string>();
  userIds.forEach((id) => {
    if (id && isDiscordSnowflake(id)) {
      validIds.add(id);
    }
  });
  return validIds;
}

/**
 * Get invalid (fake/test) user IDs
 */
export function getInvalidUserIds(userIds: Set<string | null>): Set<string> {
  const invalidIds = new Set<string>();
  userIds.forEach((id) => {
    if (id && !isDiscordSnowflake(id)) {
      invalidIds.add(id);
    }
  });
  return invalidIds;
}
