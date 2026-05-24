/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@jv/tailwind-preset')],
  content: [
    './App.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}',
    './app/**/*.{js,ts,tsx}',
    './global.css',
    '../packages/ui/src/**/*.{js,ts,tsx}',
    '../packages/forms/src/**/*.{js,ts,tsx}',
  ],
};
