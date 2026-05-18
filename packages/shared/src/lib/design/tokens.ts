// Design tokens for consistent spacing, colors, and typography

export const tokens = {
  // Spacing scale (based on 4px base unit)
  spacing: {
    xs: '0.5rem', // 8px
    sm: '0.75rem', // 12px
    md: '1rem', // 16px
    lg: '1.5rem', // 24px
    xl: '2rem', // 32px
    '2xl': '2.5rem', // 40px
    '3xl': '3rem', // 48px
    '4xl': '4rem', // 64px
  },

  // Sidebar dimensions
  sidebar: {
    width: '16rem', // 256px (w-64)
    mobileBreakpoint: '1024px', // lg breakpoint
  },

  // Page container
  container: {
    maxWidth: {
      sm: '42rem', // 672px
      md: '48rem', // 768px
      lg: '64rem', // 1024px
      xl: '80rem', // 1280px
      '2xl': '96rem', // 1536px
    },
    padding: {
      mobile: '1rem', // 16px
      desktop: '2rem', // 32px
    },
  },

  // Content spacing
  content: {
    sectionGap: '2rem', // 32px between sections
    cardGap: '1.5rem', // 24px between cards
    elementGap: '1rem', // 16px between elements
    tightGap: '0.5rem', // 8px tight spacing
  },

  // Border radius
  radius: {
    sm: '0.5rem', // 8px
    md: '0.75rem', // 12px
    lg: '1rem', // 16px
    xl: '1.5rem', // 24px
    '2xl': '2rem', // 32px
    full: '9999px',
  },

  // Shadows
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },

  // Typography
  typography: {
    heading: {
      '1': { size: '3rem', lineHeight: '1.2', weight: '700' }, // 48px
      '2': { size: '2.5rem', lineHeight: '1.25', weight: '700' }, // 40px
      '3': { size: '2rem', lineHeight: '1.3', weight: '700' }, // 32px
      '4': { size: '1.5rem', lineHeight: '1.4', weight: '600' }, // 24px
      '5': { size: '1.25rem', lineHeight: '1.5', weight: '600' }, // 20px
      '6': { size: '1.125rem', lineHeight: '1.5', weight: '600' }, // 18px
    },
    body: {
      lg: { size: '1.125rem', lineHeight: '1.75' }, // 18px
      md: { size: '1rem', lineHeight: '1.5' }, // 16px
      sm: { size: '0.875rem', lineHeight: '1.5' }, // 14px
      xs: { size: '0.75rem', lineHeight: '1.5' }, // 12px
    },
  },

  // Colors (using Tailwind defaults)
  colors: {
    primary: {
      DEFAULT: '#000000',
      hover: '#1a1a1a',
      light: '#4a4a4a',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    success: {
      DEFAULT: '#10b981',
      light: '#d1fae5',
      dark: '#059669',
    },
    warning: {
      DEFAULT: '#f59e0b',
      light: '#fef3c7',
      dark: '#d97706',
    },
    error: {
      DEFAULT: '#ef4444',
      light: '#fee2e2',
      dark: '#dc2626',
    },
  },

  // Transitions
  transition: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
} as const;

// Tailwind class mappings for easy reference
export const tw = {
  spacing: {
    xs: 'p-2',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
    '2xl': 'p-10',
  },
  gap: {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  },
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
  },
} as const;
