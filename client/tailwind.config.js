/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['DM Sans', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
        body: ['DM Sans', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      colors: {
        sarthak: {
          50: '#f4f7f4',
          100: '#e5ede6',
          200: '#cbdbce',
          300: '#a4c2aa',
          400: '#7ba484',
          500: '#558561',
          600: '#426a4c',
          700: '#34523c',
          800: '#2a4231',
          900: '#233729',
        },
        cream: {
          50: '#fdfcf9',
          100: '#faf7f2',
          200: '#f4efe5',
          300: '#eae2d3',
          400: '#dcceb8',
        },
        safety: {
          green: '#426a4c',
          yellow: '#d97706',
          orange: '#ea580c',
          red: '#dc2626',
        },
        surface: {
          50: '#fbf9f5',
          100: '#f4efe6',
          200: '#e8e1d5',
          300: '#d5ccbe',
          700: '#57524a',
          800: '#3c3833',
          900: '#24211d',
          950: '#171513',
        },
      },
      fontSize: {
        'senior-sm': ['1rem', '1.5rem'],
        'senior-base': ['1.125rem', '1.75rem'],
        'senior-lg': ['1.25rem', '1.875rem'],
        'senior-xl': ['1.5rem', '2rem'],
        'senior-2xl': ['1.875rem', '2.375rem'],
        'senior-3xl': ['2.25rem', '2.75rem'],
        'senior-4xl': ['3rem', '3.5rem'],
      },
      spacing: {
        'touch': '48px',
        'touch-lg': '56px',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'shake': 'shake 0.5s ease-in-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(34, 197, 94, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
