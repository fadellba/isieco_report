/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        isieco: {
          primary: '#059669',
          'primary-light': '#10B981',
          'primary-dark': '#047857',
          'primary-subtle': '#ECFDF5',
          secondary: '#2563EB',
          'secondary-light': '#3B82F6',
          'secondary-subtle': '#EFF6FF',
          accent: '#EA580C',
          'accent-light': '#F97316',
          'accent-subtle': '#FFF7ED',
          bg: '#F0FDF4',
          surface: '#FFFFFF',
          dark: '#1E293B',
          muted: '#64748B',
          border: '#E2E8F0',
          'border-strong': '#CBD5E1',
          destructive: '#DC2626',
          'destructive-subtle': '#FEF2F2',
          success: '#16A34A',
          'success-subtle': '#F0FDF4',
          warning: '#F59E0B',
          'warning-subtle': '#FFFBEB',
          info: '#0EA5E9',
          'info-subtle': '#F0F9FF',
        },
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.12)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 25px rgba(0, 0, 0, 0.08)',
        'sidebar': '4px 0 24px rgba(0, 0, 0, 0.05)',
      },
      backdropBlur: {
        'glass': '16px',
      },
      borderRadius: {
        'glass': '16px',
        'card': '12px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'fade-in': 'fadeIn 400ms ease-out',
        'slide-up': 'slideUp 400ms ease-out',
        'slide-in-right': 'slideInRight 300ms ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
