'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CusownMarketingNav } from '@/components/marketing/cusown-marketing-nav';

type SelectRolePremiumChromeProps = {
  children: ReactNode;
};

export function SelectRolePremiumChrome({ children }: SelectRolePremiumChromeProps) {
  return (
    <div className="marketing-safe-x relative min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div
        className="pointer-events-none fixed inset-0 z-[100] grain-overlay mix-blend-overlay"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_72%_58%_at_50%_-8%,rgba(34,197,94,0.12),transparent_56%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_48%_42%_at_100%_85%,rgba(34,197,94,0.07),transparent_52%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0)_0%,rgba(9,9,11,0.55)_100%)]"
        aria-hidden
      />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-[35%] top-[10%] h-[min(100vw,520px)] w-[min(100vw,520px)] rounded-full bg-accent/14 blur-[100px]"
        animate={{ opacity: [0.4, 0.58, 0.4], scale: [1, 1.05, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-[30%] bottom-[5%] h-[min(90vw,480px)] w-[min(90vw,480px)] rounded-full bg-emerald-400/10 blur-[95px]"
        animate={{ opacity: [0.32, 0.52, 0.32] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      <CusownMarketingNav sectionNavMode="external" />

      <div className="relative z-10 pt-[max(4.5rem,calc(3.75rem+env(safe-area-inset-top,0px)))] sm:pt-[5.25rem]">
        {children}
      </div>
    </div>
  );
}
