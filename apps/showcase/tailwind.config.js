/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@jv/tailwind-preset')],
  content: [
    './App.{js,ts,tsx}',
    './app/**/*.{js,ts,tsx}',
    '../../packages/ui/src/**/*.{js,ts,tsx}',
    '../../packages/forms/src/**/*.{js,ts,tsx}',
  ],
};
