/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mc: {
          // Backgrounds - dark stone/obsidian feel
          bg:       '#0d0d0d',
          bg2:      '#111111',
          stone:    '#161616',
          stone2:   '#1c1c1c',
          stone3:   '#222222',
          // Main Azuria blue accent
          blue:     '#3d7fff',
          blueHov:  '#5b96ff',
          blueDark: '#1a3a7a',
          // Minecraft green for play button
          green:    '#4aaa3f',
          greenHov: '#5cc450',
          greenDark:'#1e4a1a',
          // Gold for premium
          gold:     '#ffaa00',
          goldDark: '#7a4e00',
          // Danger red
          red:      '#cc3333',
          redHov:   '#dd4444',
          // Test server orange
          orange:   '#ff8800',
          orangeDk: '#7a4000',
          // Text
          text:     '#f0f0f0',
          text2:    '#aaaaaa',
          text3:    '#666666',
          // Borders
          border:   '#2a2a2a',
          border2:  '#333333',
          // Azuria purple
          purple:   '#8844ff',
          purpleDk: '#3d1a7a',
        }
      },
      fontFamily: {
        'mc': ['"Press Start 2P"', 'monospace'],
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%) skewX(-12deg)' },
          '100%': { transform: 'translateX(200%) skewX(-12deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        scanline: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100px' },
        },
        glow: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pixelIn: {
          '0%': { opacity: '0', filter: 'blur(4px)', transform: 'scale(0.96)' },
          '100%': { opacity: '1', filter: 'blur(0)', transform: 'scale(1)' },
        }
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        float: 'float 4s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite',
        slideUp: 'slideUp 0.3s ease-out',
        fadeIn: 'fadeIn 0.2s ease-out',
        pixelIn: 'pixelIn 0.4s ease-out',
      },
      boxShadow: {
        'mc-blue': '0 0 30px rgba(61,127,255,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        'mc-green': '0 0 30px rgba(74,170,63,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
        'mc-red': '0 0 30px rgba(204,51,51,0.5)',
        'mc-gold': '0 0 30px rgba(255,170,0,0.4)',
        'mc-glow': '0 0 60px rgba(61,127,255,0.2)',
        'mc-inset': 'inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,255,255,0.05)',
      }
    },
  },
  plugins: [],
}
