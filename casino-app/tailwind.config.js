/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}',
    './app/**/*.{js,ts,tsx}',
    './global.css',
  ],
  theme: {
    extend: {
      spacing: {
        global: '20px',
      },
      colors: {
        // Brand
        highlight: '#f5c542', // gold
        gold: '#f5c542',
        lime: '#2cd673',
        ember: '#ff5147',
        sky: '#3aa1ff',
        iron: '#0d1014',
        slate: '#1a1f27',
        bone: '#f7f4ef',
        fog: '#ece9e2',

        // Light theme
        light: {
          primary: '#f7f4ef',
          secondary: '#ece9e2',
          text: '#0d1014',
          subtext: '#5a6470',
        },
        // Dark theme
        dark: {
          primary: '#0d1014',
          secondary: '#1a1f27',
          darker: '#04060a',
          text: '#f7f4ef',
          subtext: '#8a93a0',
        },
      },
    },
  },
  plugins: [],
};
