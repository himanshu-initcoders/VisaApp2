'use client';

import { useEffect } from 'react';
import { Button, Card, CardContent } from '@/components/ui';

/**
 * Error Boundary for Admin Routes
 *
 * Catches and displays errors gracefully
 */

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('Admin panel error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          {/* Error Icon */}
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Error Message */}
          <h2 className="font-basier text-[31px] text-portrait-ink mb-2">
            Something went wrong
          </h2>
          <p className="font-switzer text-sm text-slate-helper mb-6">
            An error occurred while loading this page. This has been logged for investigation.
          </p>

          {/* Error Details (only in development) */}
          {process.env.NODE_ENV === 'development' && error.message && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-left">
              <p className="font-switzer text-xs text-red-800 font-semibold mb-1">
                Error Details (Development Only):
              </p>
              <p className="font-switzer text-xs text-red-700 font-mono">
                {error.message}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="primary" onClick={reset}>
              Try Again
            </Button>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = '/admin')}
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
