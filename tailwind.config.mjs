/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Pomelo (ส้มโอ) inspired palette
        pomelo: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316', // main pomelo orange
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        flesh: {
          // pomelo flesh — soft pink-coral
          50: '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#F43F5E',
        },
        leaf: {
          // pomelo leaf green (muted)
          50: '#F3F8F1',
          100: '#E3EEDD',
          200: '#C6DDB9',
          300: '#9EC58A',
          400: '#7BAE63',
          500: '#5E9448',
          600: '#487235',
        },
        cream: {
          50: '#FDFBF7',
          100: '#F9F4EB',
          200: '#F1E9D6',
        },
        ink: {
          50: '#FDF9F2',
          100: '#F9F1E3',
          200: '#EADDC6',
          300: '#A89785',
          400: '#8A7463',
          500: '#6B5545',
          600: '#52433A',
          700: '#3A2C23',
          800: '#281F1A',
          900: '#1B1410',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', '"Noto Sans Thai"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', '"Noto Sans Thai"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(27,20,16,0.04), 0 8px 24px -12px rgba(27,20,16,0.08)',
        glow: '0 0 0 1px rgba(249,115,22,0.25), 0 20px 40px -20px rgba(249,115,22,0.35)',
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0 0.06 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
