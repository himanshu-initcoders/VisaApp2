import type { AnalyticsEventMap, AnalyticsEventName } from '@/lib/analytics/events';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function canPush(): boolean {
  return typeof window !== 'undefined' && Array.isArray(window.dataLayer);
}

/** Push a typed custom event onto the GTM dataLayer. */
export function trackEvent<E extends AnalyticsEventName>(
  event: E,
  params?: AnalyticsEventMap[E]
): void {
  if (!canPush()) return;
  window.dataLayer!.push({
    event,
    ...(params ?? {}),
  });
}

/** Virtual SPA page view for GA4 via GTM. */
export function trackPageView(pagePath: string, pageTitle?: string): void {
  trackEvent('page_view', {
    page_path: pagePath,
    ...(pageTitle ? { page_title: pageTitle } : {}),
  });
}
