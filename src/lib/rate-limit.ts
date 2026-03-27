/**
 * Simple in-memory rate limiter
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAttempt: number;
}

interface RateLimitResult {
  success: boolean;
  remainingAttempts?: number;
  resetTime?: Date;
  error?: string;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request should be rate limited
   */
  check(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(identifier);

    // No previous requests
    if (!entry) {
      this.store.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
        lastAttempt: now
      });
      return {
        success: true,
        remainingAttempts: maxRequests - 1,
        resetTime: new Date(now + windowMs)
      };
    }

    // Window has expired, reset counter
    if (now > entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
        lastAttempt: now
      };
      this.store.set(identifier, newEntry);
      return {
        success: true,
        remainingAttempts: maxRequests - 1,
        resetTime: new Date(newEntry.resetTime)
      };
    }

    // Within window, check limit
    if (entry.count >= maxRequests) {
      const waitTime = Math.ceil((entry.resetTime - now) / 1000);
      return {
        success: false,
        error: `请求过于频繁，请在 ${waitTime} 秒后重试`,
        resetTime: new Date(entry.resetTime)
      };
    }

    // Increment counter
    entry.count++;
    entry.lastAttempt = now;
    this.store.set(identifier, entry);

    return {
      success: true,
      remainingAttempts: maxRequests - entry.count,
      resetTime: new Date(entry.resetTime)
    };
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  /**
   * Get current rate limit status without incrementing
   */
  getStatus(identifier: string): RateLimitResult {
    const entry = this.store.get(identifier);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      return {
        success: true,
        remainingAttempts: Number.MAX_SAFE_INTEGER
      };
    }

    return {
      success: entry.count === 0,
      remainingAttempts: Math.max(0, Number.MAX_SAFE_INTEGER - entry.count),
      resetTime: new Date(entry.resetTime)
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime + 60000) { // Keep entries for 1 minute after expiry
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global rate limiter instance
const globalRateLimiter = new RateLimiter();

/**
 * Rate limit configuration for different operations
 */
export const RateLimitConfig = {
  VERIFICATION_CODE: {
    maxRequests: 3, // 3 requests
    windowMs: 60 * 1000, // per minute
    errorMessage: '验证码发送过于频繁，请1分钟后重试'
  },
  PASSWORD_RESET: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // per hour
    errorMessage: '密码重置次数过多，请1小时后重试'
  },
  LOGIN_ATTEMPT: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // per 15 minutes
    errorMessage: '登录尝试过多，请15分钟后再试'
  },
  GENERAL_API: {
    maxRequests: 100,
    windowMs: 60 * 1000, // per minute
    errorMessage: '请求过于频繁，请稍后重试'
  }
} as const;

/**
 * Check rate limit for verification code sending
 */
export function checkVerificationCodeRateLimit(
  identifier: string
): RateLimitResult {
  return globalRateLimiter.check(
    identifier,
    RateLimitConfig.VERIFICATION_CODE.maxRequests,
    RateLimitConfig.VERIFICATION_CODE.windowMs
  );
}

/**
 * Check rate limit for password reset
 */
export function checkPasswordResetRateLimit(
  identifier: string
): RateLimitResult {
  return globalRateLimiter.check(
    identifier,
    RateLimitConfig.PASSWORD_RESET.maxRequests,
    RateLimitConfig.PASSWORD_RESET.windowMs
  );
}

/**
 * Check rate limit for login attempts
 */
export function checkLoginRateLimit(
  identifier: string
): RateLimitResult {
  return globalRateLimiter.check(
    identifier,
    RateLimitConfig.LOGIN_ATTEMPT.maxRequests,
    RateLimitConfig.LOGIN_ATTEMPT.windowMs
  );
}

/**
 * Reset rate limit for an identifier
 */
export function resetRateLimit(identifier: string): void {
  globalRateLimiter.reset(identifier);
}

/**
 * Create a custom rate limiter for specific needs
 */
export function createCustomRateLimiter(
  maxRequests: number,
  windowMs: number
): (identifier: string) => RateLimitResult {
  return (identifier: string) => {
    return globalRateLimiter.check(identifier, maxRequests, windowMs);
  };
}

/**
 * Middleware helper for Next.js API routes
 */
export function withRateLimit(
  handler: (req: Request, context?: any) => Promise<Response>,
  getIdentifier: (req: Request) => string,
  config: keyof typeof RateLimitConfig = 'GENERAL_API'
) {
  return async (req: Request, context?: any): Promise<Response> => {
    const identifier = getIdentifier(req);
    const rateLimitResult = globalRateLimiter.check(
      identifier,
      RateLimitConfig[config].maxRequests,
      RateLimitConfig[config].windowMs
    );

    if (!rateLimitResult.success) {
      return Response.json(
        {
          error: rateLimitResult.error || RateLimitConfig[config].errorMessage,
          resetTime: rateLimitResult.resetTime
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RateLimitConfig[config].maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': Math.ceil(
              ((rateLimitResult.resetTime?.getTime() || 0) - Date.now()) / 1000
            ).toString()
          }
        }
      );
    }

    return handler(req, context);
  };
}

/**
 * Get IP address from request
 */
export function getIdentifierFromRequest(req: Request): string {
  // Try various headers for IP address
  const headers = req.headers;

  // Check for forwarded IP
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Check for real IP
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Check for CF connecting IP (Cloudflare)
  const cfIP = headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  // Fallback to a default identifier
  return 'unknown';
}

// Export the global rate limiter instance for advanced use cases
export { globalRateLimiter };
