/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },
        dark: {
          50: '#e2e4ed',
          100: '#c5c9db',
          200: '#e2e4ed',
          300: '#c5c9db',
          400: '#9ca0b8',
          500: '#6b7094',
          600: '#3d4155',
          700: '#2a2d3a',
          800: '#1a1d27',
          900: '#111318',
          950: '#0a0b10',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
};
