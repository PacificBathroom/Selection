/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef6ff',
          100: '#d9ebff',
          200: '#b6d8ff',
          300: '#8cc1ff',
          400: '#5aa3ff',
          500: '#2f86ff',
          600: '#1f6aee',
          700: '#1a54c4',
          800: '#1848a0',
          900: '#193e82',
        }
      },
      boxShadow: {
        card: '0 8px 20px rgba(0,0,0,0.06)'
      }
    },
  },
  plugins: [],
};
