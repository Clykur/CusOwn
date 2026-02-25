// Accessible SVG icons for booking status
import React from 'react';

export function IconCheck({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      aria-label="Accepted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function IconCross({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      aria-label="Rejected"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function IconUndo({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      aria-label="Undo"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 14l-4-4 4-4" />
      <path d="M20 20v-2a8 8 0 00-8-8H5" />
    </svg>
  );
}
