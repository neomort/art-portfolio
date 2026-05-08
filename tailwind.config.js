/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  // Tailwind v4 scans automatically; content key is not needed.
  // Plugin registration is done via CSS (@plugin) in src/index.css.
  theme: {
    fontFamily: {
      sans: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      display: ['Unbounded', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      unbounded: ['Unbounded', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    extend: {
      // Custom colors
      peach: {
        50: '#fff5f2',
        100: '#ffe6e0',
        200: '#ffd1c6',
        300: '#ffb3a1',
        400: '#ff8670',
        500: '#ff5a3f',
        600: '#ed3515',
        700: '#c7280c',
        800: '#a4240f',
        900: '#862114',
        950: '#480d05',
      },
      coral: {
        50: '#fff1f0',
        100: '#ffe0dd',
        200: '#ffc6c1',
        300: '#ff9f96',
        400: '#ff6b5d',
        500: '#ff3d2b',
        600: '#ff1500',
        700: '#cc1100',
        800: '#a81200',
        900: '#8a1508',
        950: '#4b0600',
      },
      maroon: {
        50: '#fdf3f3',
        100: '#fbe5e5',
        200: '#f8cfcf',
        300: '#f2aeae',
        400: '#e78080',
        500: '#d85151',
        600: '#c13434',
        700: '#a12828',
        800: '#862525',
        900: '#702424',
        950: '#3c1010',
      },
      // Border radius
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      // Animations
      animation: {
        'gradient-x': 'gradient-x 15s ease infinite',
        'gradient-y': 'gradient-y 15s ease infinite',
        'gradient-xy': 'gradient-xy 15s ease infinite',
      },
      // Keyframes
      keyframes: {
        'gradient-y': {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': 'center top'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'center center'
          }
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          }
        },
        'gradient-xy': {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          }
        }
      }
    },
  },
  // No JS plugins here; see src/index.css for @plugin registrations.
};