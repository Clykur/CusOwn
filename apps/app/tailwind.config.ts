import type { Config } from 'tailwindcss';
import { colors, gradients } from './lib/theme/colors';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: colors.background,
        surface: colors.surface,
        brand: colors.brand,
        text: colors.text,
        border: colors.border,
        state: colors.state,
        accent: {
          DEFAULT: colors.brand.primary,
        },
      },
      backgroundImage: {
        'gradient-primary': gradients.primary,
        'gradient-hero': gradients.hero,
        'gradient-radial-green':
          'radial-gradient(ellipse 80% 60% at 50% 120%, rgba(34, 197, 94, 0.18), transparent 55%)',
      },
      borderRadius: {
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};
export default config;
