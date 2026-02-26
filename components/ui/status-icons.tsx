// Accessible SVG icons for booking status
import React from 'react';
import CheckSvg from '@/src/icons/check.svg';
import CloseSvg from '@/src/icons/close.svg';
import UndoSvg from '@/src/icons/undo.svg';

export function IconCheck({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return <CheckSvg className={className} aria-label="Accepted" {...props} />;
}

export function IconCross({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return <CloseSvg className={className} aria-label="Rejected" {...props} />;
}

export function IconUndo({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return <UndoSvg className={className} aria-label="Undo" {...props} />;
}
