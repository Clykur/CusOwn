'use client';

import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const maxWidthClasses = {
  sm: 'max-w-2xl',
  md: 'max-w-3xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  '2xl': 'max-w-7xl',
};

export default function PageContainer({
  children,
  maxWidth = 'xl',
  className = '',
}: PageContainerProps) {
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className={`mx-auto px-4 py-8 sm:px-6 lg:px-8 ${maxWidthClasses[maxWidth]}`}>
        {children}
      </div>
    </div>
  );
}
