/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        isieco: {
          primary: '#2bc48a',
          'primary-light': '#56d6a5',
          'primary-dark': '#15855b',
          accent: '#f5a64a',
          'accent-light': '#ffc174',
          bg: '#0a100d',
          surface: '#111a15',
          dark: '#e5eee8',
          muted: '#91a198',
          border: '#26362d',
        },
      },
    },
  },
  plugins: [],
};
