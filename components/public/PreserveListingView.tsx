'use client';

import { useLayoutEffect, type ReactNode } from 'react';

export const VISA_KIND_NAV_CLASS = 'visa-kind-nav';

const PRICING_TOP_KEY = 'visa-kind-pricing-top';
const SCROLL_Y_KEY = 'visa-kind-scroll-y';

export function beginVisaKindNavigation() {
  document.documentElement.classList.add(VISA_KIND_NAV_CLASS);
  sessionStorage.setItem(SCROLL_Y_KEY, String(window.scrollY));

  const pricing = document.getElementById('pricing');
  if (pricing) {
    sessionStorage.setItem(
      PRICING_TOP_KEY,
      String(pricing.getBoundingClientRect().top)
    );
  }
}

function finishVisaKindNavigation() {
  const html = document.documentElement;
  const savedTop = sessionStorage.getItem(PRICING_TOP_KEY);
  const savedY = sessionStorage.getItem(SCROLL_Y_KEY);
  const pricing = document.getElementById('pricing');

  html.classList.remove('scroll-smooth');

  if (pricing && savedTop != null) {
    const delta = pricing.getBoundingClientRect().top - Number(savedTop);
    if (delta !== 0) {
      window.scrollBy(0, delta);
    }
  } else if (savedY != null) {
    window.scrollTo(0, Number(savedY));
  }

  html.classList.add('scroll-smooth');
  html.classList.remove(VISA_KIND_NAV_CLASS);
  sessionStorage.removeItem(PRICING_TOP_KEY);
  sessionStorage.removeItem(SCROLL_Y_KEY);
}

export function PreserveListingView({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    finishVisaKindNavigation();
  }, []);

  return children;
}
