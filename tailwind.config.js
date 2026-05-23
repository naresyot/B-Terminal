/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#020617',     // Slate 950
          panel: '#0f172a',  // Slate 900
          border: '#1e293b', // Slate 800
          text: '#f8fafc',   // Slate 50
          accent: '#10b981', // Emerald 500
        }
      }
    },
  },
  plugins: [],
}
