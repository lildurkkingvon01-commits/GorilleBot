/**
 * Error handling utilities
 */

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCodes = {
  // Validation errors
  INVALID_PARAMS: 'INVALID_PARAMS',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_PAGINATION: 'INVALID_PAGINATION',

  // Not found
  NOT_FOUND: 'NOT_FOUND',
  GUILD_NOT_FOUND: 'GUILD_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  COMMAND_NOT_FOUND: 'COMMAND_NOT_FOUND',
  LOG_NOT_FOUND: 'LOG_NOT_FOUND',

  // Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  QUERY_ERROR: 'QUERY_ERROR',

  // Server
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export const createError = (
  code: string,
  message: string,
  statusCode: number = 500,
  details?: any
): AppError => {
  return new AppError(code, message, statusCode, details);
};

export const errorResponses = {
  invalidParams: (details?: any) =>
    createError(
      ErrorCodes.INVALID_PARAMS,
      'Invalid request parameters',
      400,
      details
    ),
  notFound: (resource: string) =>
    createError(
      ErrorCodes.NOT_FOUND,
      `${resource} not found`,
      404
    ),
  unauthorized: () =>
    createError(
      ErrorCodes.UNAUTHORIZED,
      'Unauthorized access',
      401
    ),
  forbidden: () =>
    createError(
      ErrorCodes.FORBIDDEN,
      'Access denied',
      403
    ),
  databaseError: (details?: any) =>
    createError(
      ErrorCodes.DATABASE_ERROR,
      'Database error occurred',
      500,
      details
    ),
  internalError: (details?: any) =>
    createError(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'Internal server error',
      500,
      details
    ),
};
