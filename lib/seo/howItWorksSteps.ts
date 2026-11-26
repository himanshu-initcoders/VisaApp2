/**
 * Shared “how Viserv works” steps for home, /how-it-works, and HowTo JSON-LD.
 */

export const HOW_IT_WORKS_STEPS = [
  {
    id: 'destination',
    title: 'Choose your destination',
    description:
      'Pick the country you’re visiting and the visa that fits your trip: tourist, business.',
    stepNumber: 1,
  },
  {
    id: 'docs',
    title: 'Check documents and price',
    description:
      'See the full cost, how long it takes, and the exact documents you’ll need, before you pay.',
    stepNumber: 2,
  },
  {
    id: 'apply',
    title: 'Apply in one go',
    description:
      'Add travellers, upload your documents and pay. Our experts review everything before it’s submitted.',
    stepNumber: 3,
  },
  {
    id: 'track',
    title: 'Track your visa',
    description:
      'Get updates at every stage, so you always know where your application stands.',
    stepNumber: 4,
  },
] as const;

export type HowItWorksStep = (typeof HOW_IT_WORKS_STEPS)[number];
