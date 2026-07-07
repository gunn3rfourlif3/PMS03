/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        onbrand: 'var(--onbrand)',
        tint: 'var(--tint)',
        accent: 'var(--accent)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        bg: 'var(--bg)',
        card: 'var(--card)',
        danger: 'var(--danger)',
        dangerbg: 'var(--dangerbg)',
        success: 'var(--success)',
      },
      fontFamily: {
        sans: ['var(--font)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '0.9rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        glass: '0 10px 40px -12px rgba(2, 6, 23, 0.18)',
        'glass-lg': '0 24px 70px -20px rgba(2, 6, 23, 0.28)',
        soft: '0 4px 20px -6px rgba(2, 6, 23, 0.10)',
      },
      backdropBlur: { xs: '2px' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { 'fade-up': 'fade-up 0.4s ease both' },
    },
  },
  plugins: [],
};
