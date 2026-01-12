/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'growth-high': '#22c55e',
        'growth-medium': '#86efac',
        'growth-low': '#dcfce7',
        'decline-low': '#fee2e2',
        'decline-medium': '#fca5a5',
        'decline-high': '#ef4444',
      }
    },
  },
  plugins: [],
}
