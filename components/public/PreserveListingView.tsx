'use client';

import { useLayoutEffect, type ReactNode } from 'react';

export const VISA_KIND_NAV_CLASS = 'visa-kind-nav';

const ANCHOR_TOP_KEY = 'visa-kind-anchor-top';
const ANCHOR_ID_KEY = 'visa-kind-anchor-id';
const SCROLL_Y_KEY = 'visa-kind-scroll-y';

const ANCHOR_CANDIDATES = ['overview', 'pricing'] as const;

function readAnchor() {
  for (const id of ANCHOR_CANDIDATES) {
    const node = document.getElementById(id);
    if (!node) continue;
    const top = node.getBoundingClientRect().top;
    // Prefer an anchor that is currently on / near screen.
    if (top < window.innerHeight && top > -node.getBoundingClientRect().height) {
      return { id, top };
    }
  }

  const pricing = document.getElementById('pricing');
  if (pricing) {
    return { id: 'pricing', top: pricing.getBoundingClientRect().top };
  }

  const overview = document.getElementById('overview');
  if (overview) {
    return { id: 'overview', top: overview.getBoundingClientRect().top };
  }

  return null;
}

export function beginVisaKindNavigation() {
  const html = document.documentElement;
  html.classList.add(VISA_KIND_NAV_CLASS);
  html.style.overflowAnchor = 'none';
  sessionStorage.setItem(SCROLL_Y_KEY, String(window.scrollY));

  const anchor = readAnchor();
  if (anchor) {
    sessionStorage.setItem(ANCHOR_ID_KEY, anchor.id);
    sessionStorage.setItem(ANCHOR_TOP_KEY, String(anchor.top));
  }
}

/** Drop a pending preserve without adjusting scroll (failed / cancelled switch). */
export function cancelVisaKindNavigation() {
  const html = document.documentElement;
  html.classList.remove(VISA_KIND_NAV_CLASS);
  html.style.overflowAnchor = '';
  sessionStorage.removeItem(ANCHOR_TOP_KEY);
  sessionStorage.removeItem(ANCHOR_ID_KEY);
  sessionStorage.removeItem(SCROLL_Y_KEY);
}

/**
 * Restore scroll after a soft or hard listing switch.
 * Keeps the overview/pricing block where it was so sibling clicks don't
 * dump the user into Requirements when page height changes.
 */
export function finishVisaKindNavigation() {
  const html = document.documentElement;
  const savedTop = sessionStorage.getItem(ANCHOR_TOP_KEY);
  const savedId = sessionStorage.getItem(ANCHOR_ID_KEY);
  const savedY = sessionStorage.getItem(SCROLL_Y_KEY);
  const hadPending = savedTop != null || savedY != null;

  html.classList.remove('scroll-smooth');

  if (savedTop != null) {
    const anchor =
      (savedId ? document.getElementById(savedId) : null) ||
      document.getElementById('pricing') ||
      document.getElementById('overview');

    if (anchor) {
      const delta = anchor.getBoundingClientRect().top - Number(savedTop);
      if (Math.abs(delta) > 1) {
        window.scrollBy(0, delta);
      }
    } else if (savedY != null) {
      window.scrollTo(0, Number(savedY));
    }
  } else if (savedY != null) {
    window.scrollTo(0, Number(savedY));
  }

  html.classList.add('scroll-smooth');
  html.classList.remove(VISA_KIND_NAV_CLASS);
  html.style.overflowAnchor = '';
  sessionStorage.removeItem(ANCHOR_TOP_KEY);
  sessionStorage.removeItem(ANCHOR_ID_KEY);
  sessionStorage.removeItem(SCROLL_Y_KEY);

  if (hadPending) {
    ensureOverviewInView();
  }

  return hadPending;
}

/** Snap Overview back if Requirements took over the viewport after a height change. */
export function ensureOverviewInView() {
  const overview = document.getElementById('overview');
  const requirements = document.getElementById('requirements');
  if (!overview) return false;

  const overviewRect = overview.getBoundingClientRect();
  const requirementsRect = requirements?.getBoundingClientRect();
  const overviewVisible =
    overviewRect.bottom > 140 && overviewRect.top < window.innerHeight * 0.6;
  const requirementsDominates = Boolean(
    requirementsRect &&
      requirementsRect.top < 180 &&
      requirementsRect.top < overviewRect.bottom
  );

  if (overviewVisible && !requirementsDominates) return false;

  const html = document.documentElement;
  html.classList.remove('scroll-smooth');
  const stickyOffset = 88; // header + sticky section nav
  const y = window.scrollY + overviewRect.top - stickyOffset;
  window.scrollTo(0, Math.max(0, y));
  html.classList.add('scroll-smooth');
  return true;
}

export function PreserveListingView({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    finishVisaKindNavigation();
  }, []);

  return children;
}
