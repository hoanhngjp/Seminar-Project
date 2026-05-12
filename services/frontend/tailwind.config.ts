import type { Config } from 'tailwindcss';

// Tailwind config — tokens extracted 1:1 from Stitch Soundwave design system
// Reference: design/stitch_soundwave_dark_login_interface/ng_nh_p_soundwave/code.html
const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        'spotify-green':   '#1ed760',
        'accent-border':   '#1db954',
        'near-black':      '#121212',

        // Surfaces
        'dark-surface':    '#181818',
        'mid-dark':        '#1f1f1f',
        'dark-card':       '#252525',
        'mid-card':        '#272727',

        // Text
        'text-base':       '#ffffff',
        'text-secondary':  '#b3b3b3',
        'text-near-white': '#cbcbcb',
        'text-emphasis':   '#fdfdfd',

        // Semantic
        'negative':        '#f3727f',
        'warning':         '#ffa42b',
        'announcement':    '#539df5',

        // Borders
        'border-muted':    '#4d4d4d',
        'border-pill':     '#7c7c7c',

        // Background / surface variants (from Stitch)
        'background':                  '#0d150d',
        'surface':                     '#0d150d',
        'surface-dim':                 '#0d150d',
        'surface-bright':              '#333b32',
        'surface-container':           '#192219',
        'surface-container-low':       '#151e15',
        'surface-container-high':      '#232c23',
        'surface-container-highest':   '#2e372e',
        'surface-container-lowest':    '#081008',
        'surface-variant':             '#2e372e',

        // On-colors
        'on-surface':          '#dce5d8',
        'on-background':       '#dce5d8',
        'on-surface-variant':  '#bbcbb8',

        // Primary/secondary/tertiary (Material You base from Stitch)
        'primary':           '#4cf479',
        'primary-container': '#1ed760',
        'primary-fixed':     '#69ff89',
        'primary-fixed-dim': '#34e36a',
        'on-primary':        '#003913',

        'secondary':               '#c8c6c5',
        'secondary-container':     '#4a4949',
        'secondary-fixed':         '#e5e2e1',
        'secondary-fixed-dim':     '#c8c6c5',
        'on-secondary':            '#313030',
        'on-secondary-container':  '#bab8b7',

        'tertiary':               '#ffccbb',
        'tertiary-container':     '#ffa585',
        'tertiary-fixed':         '#ffdbcf',
        'tertiary-fixed-dim':     '#ffb59b',
        'on-tertiary':            '#571f08',
        'on-tertiary-container':  '#793820',

        // Error
        'error':           '#ffb4ab',
        'error-container': '#93000a',
        'on-error':        '#690005',

        // Outline
        'outline':         '#859583',
        'outline-variant': '#3c4a3c',

        // Misc
        'surface-tint':       '#34e36a',
        'inverse-surface':    '#dce5d8',
        'inverse-primary':    '#006e2c',
        'inverse-on-surface': '#2a3329',
      },

      borderRadius: {
        // Stitch exact values
        'sm':      '4px',
        'card':    '8px',
        'DEFAULT': '1rem',
        'md':      '1.5rem',
        'lg':      '2rem',
        'xl':      '3rem',
        'pill':    '500px',
        'full':    '9999px',
      },

      spacing: {
        // Stitch spacing scale
        'xs':           '4px',
        'sm':           '8px',
        'base':         '8px',
        'md':           '16px',
        'gutter':       '16px',
        'lg':           '24px',
        'xl':           '32px',
        'sidebar-width':'280px',
      },

      fontFamily: {
        // SpotifyMixUI → Plus Jakarta Sans (Stitch substitution) with full fallback
        'sans': [
          'Plus Jakarta Sans',
          'SpotifyMixUI',
          'CircularSp-Arab',
          'CircularSp-Hebr',
          'CircularSp-Cyrl',
          'Helvetica Neue',
          'helvetica',
          'arial',
          'Hiragino Sans',
          'sans-serif',
        ],
        'title': [
          'Plus Jakarta Sans',
          'SpotifyMixUITitle',
          'Helvetica Neue',
          'helvetica',
          'arial',
          'sans-serif',
        ],
        // Named roles (Stitch font-family utilities)
        'body-regular':    ['Plus Jakarta Sans', 'sans-serif'],
        'body-bold':       ['Plus Jakarta Sans', 'sans-serif'],
        'section-title':   ['Plus Jakarta Sans', 'sans-serif'],
        'feature-heading': ['Plus Jakarta Sans', 'sans-serif'],
        'button-uppercase':['Plus Jakarta Sans', 'sans-serif'],
        'nav-link':        ['Plus Jakarta Sans', 'sans-serif'],
        'caption':         ['Plus Jakarta Sans', 'sans-serif'],
        'small-bold':      ['Plus Jakarta Sans', 'sans-serif'],
        'micro':           ['Plus Jakarta Sans', 'sans-serif'],
      },

      fontSize: {
        // Stitch type scale — exact values from code.html
        'section-title':   ['24px', { lineHeight: '1.2',  letterSpacing: 'normal', fontWeight: '700' }],
        'feature-heading': ['18px', { lineHeight: '1.3',  letterSpacing: 'normal', fontWeight: '600' }],
        'body-bold':       ['16px', { lineHeight: '1.5',  letterSpacing: 'normal', fontWeight: '700' }],
        'body-regular':    ['16px', { lineHeight: '1.5',  letterSpacing: 'normal', fontWeight: '400' }],
        'button-uppercase':['14px', { lineHeight: '1.0',  letterSpacing: '1.4px',  fontWeight: '700' }],
        'nav-link':        ['14px', { lineHeight: 'normal', letterSpacing: 'normal', fontWeight: '400' }],
        'caption':         ['14px', { lineHeight: '1.5',  letterSpacing: 'normal', fontWeight: '400' }],
        'small-bold':      ['12px', { lineHeight: '1.5',  letterSpacing: 'normal', fontWeight: '700' }],
        'micro':           ['10px', { lineHeight: 'normal', letterSpacing: 'normal', fontWeight: '400' }],
      },

      boxShadow: {
        'level-1':     'rgba(0,0,0,0.3) 0px 4px 8px',
        'level-2':     'rgba(0,0,0,0.3) 0px 8px 8px',
        'level-3':     'rgba(0,0,0,0.5) 0px 8px 24px',
        'input-inset': 'rgb(18,18,18) 0px 1px 0px, rgb(124,124,124) 0px 0px 0px 1px inset',
        'glow-green':  'rgba(30,215,96,0.2) 0px 0px 80px 20px',
      },

      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
      },

      animation: {
        shimmer: 'shimmer 1.5s infinite',
        blink:   'blink 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
