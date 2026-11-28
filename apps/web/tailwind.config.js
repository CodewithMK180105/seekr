/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Google Sans Text"',
          '"Google Sans"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: {
          light: 'rgba(255, 255, 255, 0.75)',
          dark: 'rgba(15, 23, 42, 0.65)',
        },
        border: 'var(--border)',
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
      },
      boxShadow: {
        'glass-light': '0 8px 32px 0 rgba(31, 38, 135, 0.07), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'glass-hover-light': '0 14px 40px 0 rgba(31, 38, 135, 0.12), 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'glass-hover-dark': '0 14px 40px 0 rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
        'glow-blue': '0 0 35px -5px rgba(59, 130, 246, 0.35)',
        'glow-indigo': '0 0 35px -5px rgba(99, 102, 241, 0.35)',
      },
      backdropBlur: {
        xs: '2px',
        glass: '16px',
        'glass-heavy': '24px',
      },
      animation: {
        'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float 8s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
