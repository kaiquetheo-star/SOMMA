/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './store/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        obsidian: '#0F1512',
        'moss-900': '#1A2420',
        'moss-glass': 'rgba(74, 93, 68, 0.35)',
        'matte-gold': '#BFA06A',
        'dark-copper': '#8B4513',
        'blood-red': '#6B1E1E',
      },
      fontFamily: {
        display: ['PlayfairDisplay_400Regular'],
        'display-bold': ['PlayfairDisplay_700Bold'],
        body: ['Inter_400Regular'],
        'body-medium': ['Inter_500Medium'],
      },
    },
  },
  plugins: [],
};
