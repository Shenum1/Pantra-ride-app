/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        primary: { DEFAULT: '#0058D9', tint: '#E8F0FE' },
        success: { DEFAULT: '#1B8A54', tint: '#E6F6EE' },
        warning: { DEFAULT: '#9A5B00', tint: '#FDF1DF' },
        danger: { DEFAULT: '#C6291A', tint: '#FCEAE8' },
        pending: { DEFAULT: '#4A5AB8', tint: '#EBEDFB' },
      },
      borderRadius: {
        sm: '5px',
        md: '8px',
      },
    },
  },
  plugins: [],
};
