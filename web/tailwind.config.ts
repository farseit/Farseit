import type { Config } from 'tailwindcss';

// SaaS panel colors come from CSS variables in src/app/globals.css (light + dark).
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- SaaS panel (dashboard, login, admin)
        background: token('background'),
        foreground: token('foreground'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        border: token('border'),
        muted: token('muted'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground'), soft: token('primary-soft') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        success: token('success'),
        danger: token('danger'),
        warning: token('warning'),
        // ---- FarseIT company site
        ink: '#0B0E14',
        'ink-soft': '#151A24',
        paper: '#FFFFFF',
        fsurface: '#F5F7FA',
        brand: { DEFAULT: '#1657FF', deep: '#0B1E63', light: '#E9EFFF' },
        signal: { DEFAULT: '#FF6A1A', soft: '#FFE7D6' },
        slate: { DEFAULT: '#5B6472', light: '#8A93A3' },
        line: '#E4E8EF',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-hind)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(to right, rgba(11,14,20,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(11,14,20,0.05) 1px, transparent 1px)',
      },
      maxWidth: { content: '1200px' },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      keyframes: { float: { '50%': { transform: 'translateY(-8px)' } } },
      boxShadow: {
        card: '0 1px 2px rgb(var(--foreground) / 0.04), 0 8px 24px -12px rgb(var(--foreground) / 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
