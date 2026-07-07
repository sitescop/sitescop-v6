/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B6E4F',
          dark: '#08543C',
          light: '#0E875F',
        },
        secondary: {
          DEFAULT: '#005A9C',
        },
        accent: {
          DEFAULT: '#F39C12',
        },
        surface: '#FFFFFF',
        background: '#F4F7FA',
        border: '#D9E2EC',
        text: {
          DEFAULT: '#1F2937',
          light: '#6B7280',
          muted: '#9CA3AF',
        },
        danger: '#DC2626',
        warning: '#F59E0B',
        success: '#16A34A',
        sidebar: {
          DEFAULT: '#18253D',
          hover: '#1F2F4A',
          active: '#0B6E4F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
        lg: '16px',
        sm: '8px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.08)',
        elevated: '0 10px 30px rgba(0,0,0,0.08)',
      },
      spacing: {
        sidebar: '260px',
        topbar: '64px',
      },
    },
  },
  plugins: [],
};
