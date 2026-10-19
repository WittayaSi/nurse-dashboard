/**
 * Simple in-memory rate limiter for API routes.
 * 
 * Usage in API route:
 *   import { rateLimit } from '@/lib/rate-limit';
 *   const limiter = rateLimit({ interval: 60_000, limit: 30 });
 *   
 *   export async function GET(request: Request) {
 *     const res = limiter.check(request);
 *     if (res) return res; // 429 Too Many Requests
 *     // ... normal logic
 *   }
 */

import { NextResponse } from 'next/server';

interface RateLimitOptions {
    /** Time window in milliseconds (default: 60_000 = 1 minute) */
    interval?: number;
    /** Maximum requests per IP per interval (default: 60) */
    limit?: number;
}

interface TokenBucket {
    count: number;
    lastReset: number;
}

const ipMap = new Map<string, TokenBucket>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of ipMap) {
        if (now - bucket.lastReset > 300_000) {
            ipMap.delete(ip);
        }
    }
}, 300_000);

export function rateLimit(options?: RateLimitOptions) {
    const interval = options?.interval ?? 60_000;
    const limit = options?.limit ?? 60;

    return {
        /**
         * Check if the request exceeds rate limit.
         * @returns NextResponse with 429 if limit exceeded, or null if OK.
         */
        check(request: Request): NextResponse | null {
            const forwarded = request.headers.get('x-forwarded-for');
            const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
            const now = Date.now();

            let bucket = ipMap.get(ip);
            if (!bucket || now - bucket.lastReset > interval) {
                bucket = { count: 0, lastReset: now };
                ipMap.set(ip, bucket);
            }

            bucket.count++;

            if (bucket.count > limit) {
                return NextResponse.json(
                    { error: 'Too many requests. Please try again later.' },
                    {
                        status: 429,
                        headers: {
                            'Retry-After': String(Math.ceil((bucket.lastReset + interval - now) / 1000)),
                        },
                    }
                );
            }

            return null;
        },
    };
}
