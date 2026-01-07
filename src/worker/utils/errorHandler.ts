/**
 * Centralized Error Handling Module
 * 
 * Provides standardized error responses for all API routes.
 * Ensures consistent error format and prevents sensitive data leakage.
 */

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
}

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  details?: any;
  timestamp?: string;
}

/**
 * Custom error classes for type-safe error handling
 */
export class ValidationError extends Error {
  code = ErrorCode.VALIDATION_ERROR;
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class AuthError extends Error {
  code = ErrorCode.AUTH_ERROR;
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'AuthError';
    this.details = details;
  }
}

export class DatabaseError extends Error {
  code = ErrorCode.DATABASE_ERROR;
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'DatabaseError';
    this.details = details;
  }
}

export class EncryptionError extends Error {
  code = ErrorCode.ENCRYPTION_ERROR;
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'EncryptionError';
    this.details = details;
  }
}

export class NotFoundError extends Error {
  code = ErrorCode.NOT_FOUND;
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'NotFoundError';
    this.details = details;
  }
}

/**
 * Creates a standardized error response object
 * 
 * @param error - Error instance or error message
 * @param code - Error code enum
 * @param details - Optional additional details (sanitized)
 * @returns Standardized error response
 */
export function createErrorResponse(
  error: Error | string,
  code: ErrorCode = ErrorCode.INTERNAL_ERROR,
  details?: any
): ErrorResponse {
  const message = error instanceof Error ? error.message : error;
  
  // Sanitize details to prevent sensitive data leakage
  const sanitizedDetails = sanitizeErrorDetails(details);

  return {
    error: message,
    code,
    details: sanitizedDetails,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sanitizes error details to prevent sensitive data leakage
 * Removes potential secrets, keys, tokens, etc.
 * 
 * @param details - Error details object
 * @returns Sanitized details
 */
function sanitizeErrorDetails(details: any): any {
  if (!details) return undefined;

  if (typeof details !== 'object') {
    return details;
  }

  const sensitiveKeys = [
    'password',
    'secret',
    'key',
    'token',
    'api_key',
    'api_secret',
    'private_key',
    'access_token',
    'refresh_token',
    'authorization',
    'auth',
    'credential',
  ];

  const sanitized: any = Array.isArray(details) ? [] : {};

  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeErrorDetails(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Handles errors and returns appropriate HTTP status code
 * 
 * @param error - Error instance
 * @returns Tuple of [statusCode, errorResponse]
 */
export function handleError(error: unknown): [number, ErrorResponse] {
  // Handle custom error types
  if (error instanceof ValidationError) {
    return [400, createErrorResponse(error, error.code, error.details)];
  }

  if (error instanceof AuthError) {
    return [401, createErrorResponse(error, error.code, error.details)];
  }

  if (error instanceof NotFoundError) {
    return [404, createErrorResponse(error, error.code, error.details)];
  }

  if (error instanceof DatabaseError) {
    return [500, createErrorResponse(error, error.code, error.details)];
  }

  if (error instanceof EncryptionError) {
    return [500, createErrorResponse(error, error.code, error.details)];
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return [401, createErrorResponse(error, ErrorCode.AUTH_ERROR)];
    }
    
    if (message.includes('not found')) {
      return [404, createErrorResponse(error, ErrorCode.NOT_FOUND)];
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return [400, createErrorResponse(error, ErrorCode.VALIDATION_ERROR)];
    }
    
    if (message.includes('database') || message.includes('sql')) {
      return [500, createErrorResponse(error, ErrorCode.DATABASE_ERROR)];
    }
    
    if (message.includes('encrypt') || message.includes('decrypt')) {
      return [500, createErrorResponse(error, ErrorCode.ENCRYPTION_ERROR)];
    }
  }

  // Default: Internal server error
  return [
    500,
    createErrorResponse(
      error instanceof Error ? error : new Error('Internal server error'),
      ErrorCode.INTERNAL_ERROR
    ),
  ];
}

/**
 * Error handling middleware for Hono
 * Catches errors and returns standardized responses
 */
export function errorHandlerMiddleware() {
  return async (c: any, next: any) => {
    try {
      await next();
    } catch (error) {
      const [statusCode, errorResponse] = handleError(error);
      
      // Log error for debugging (but don't expose sensitive data)
      console.error(`[${errorResponse.code}] ${errorResponse.error}`, {
        statusCode,
        timestamp: errorResponse.timestamp,
      });

      return c.json(errorResponse, statusCode);
    }
  };
}
