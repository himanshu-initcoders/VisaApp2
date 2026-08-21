import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Portrait Design System Colors
        'portrait-ink': '#08304c',
        'nautical-teal': '#084e72',
        'charcoal': '#353535',
        'graphite': '#2c2c2c',
        'slate-helper': '#797979',
        'iron': '#585858',
        'ash': '#dedede',
        'fog': '#c7c7c7',
        'mist': '#eeeeee',
        'mint-wash': '#d7ffe2',
        'sky-wash': '#e8f1ff',
        'peach-wash': '#ffebd6',
      },
      fontFamily: {
        switzer: ['var(--font-switzer)', 'Inter', 'system-ui', 'sans-serif'],
        basier: [
          'var(--font-basier)',
          'Plus Jakarta Sans',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        caption: [
          '10px',
          { lineHeight: '1.5', letterSpacing: '1.4px' },
        ],
        body: ['16px', { lineHeight: '1.5' }],
        'body-lg': ['18px', { lineHeight: '1.45' }],
        subheading: [
          '20px',
          { lineHeight: '1.43', letterSpacing: '-0.26px' },
        ],
        'heading-sm': [
          '31px',
          { lineHeight: '1.1', letterSpacing: '-0.4px' },
        ],
        heading: [
          '44px',
          { lineHeight: '1.08', letterSpacing: '-1.15px' },
        ],
        'heading-lg': [
          '49px',
          { lineHeight: '1.04', letterSpacing: '-1.96px' },
        ],
        display: [
          '76px',
          { lineHeight: '1', letterSpacing: '-4.25px' },
        ],
      },
      borderRadius: {
        nav: '28px',
        button: '28px',
        card: '24px',
        image: '24px',
        input: '16px',
        tag: '9999px',
      },
      spacing: {
        '80': '80px', // section gap
      },
      maxWidth: {
        page: '1200px',
        subtext: '520px',
      },
      boxShadow: {
        'nav': '0 16px 16px -8px rgba(0,0,0,0.03), 0 10px 10px -5px rgba(0,0,0,0.03), 0 5px 5px -2.5px rgba(0,0,0,0.03), 0 3px 3px -1.5px rgba(0,0,0,0.03), 0 2px 2px -1px rgba(0,0,0,0.03), 0 1px 1px -0.5px rgba(0,0,0,0.03)',
        'card': '0 0 0 1px oklab(0 0 0 / 0.08), 0 16px 16px -8px rgba(0,0,0,0.03), 0 10px 10px -5px rgba(0,0,0,0.03), 0 5px 5px -2.5px rgba(0,0,0,0.03), 0 3px 3px -1.5px rgba(0,0,0,0.03), 0 2px 2px -1px rgba(0,0,0,0.03), 0 1px 1px -0.5px rgba(0,0,0,0.03)',
        'elevated': '0 0 0 1px oklab(0 0 0 / 0.06), 0 20px 20px -10px rgba(0,0,0,0.07), 0 10px 10px -5px rgba(0,0,0,0.04), 0 5px 5px -2.5px rgba(0,0,0,0.03), 0 3px 3px -1.5px rgba(0,0,0,0.03), 0 2px 2px -1px rgba(0,0,0,0.03), 0 1px 1px -0.5px rgba(0,0,0,0.03)',
      },
      backgroundImage: {
        'gradient-rainbow':
          'linear-gradient(90deg, rgb(38, 192, 255), rgb(230, 0, 194) 20%, rgb(255, 73, 78) 40%, rgb(255, 161, 62) 60%, rgb(255, 200, 55) 80%, rgb(0, 204, 61))',
      },
    },
  },
  plugins: [],
};

export default config;
