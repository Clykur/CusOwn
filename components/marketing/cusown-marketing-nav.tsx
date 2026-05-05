'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import {
  CUSOWN_LANDING_NAV_COMPACT_AFTER_SCROLL_PX,
  CUSOWN_LANDING_SECTION_IDS,
} from '@/config/marketing/cusown-landing';
import { ROUTES } from '@/lib/utils/navigation';

export type CusownMarketingNavSectionMode = 'landing' | 'external';

type CusownMarketingNavProps = {
  /** `landing`: smooth-scroll to section ids on this page. `external`: go to `/#section` (e.g. from /select-role). */
  sectionNavMode: CusownMarketingNavSectionMode;
};

export function CusownMarketingNav({ sectionNavMode }: CusownMarketingNavProps) {
  const router = useRouter();
  const reduceMotionNav = useReducedMotion();
  const [navSolid, setNavSolid] = useState(false);
  const [pastHeroNav, setPastHeroNav] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    setPastHeroNav(window.scrollY >= CUSOWN_LANDING_NAV_COMPACT_AFTER_SCROLL_PX);
  }, []);

  useMotionValueEvent(scrollY, 'change', (y) => {
    setNavSolid(y > 24);
    setPastHeroNav(y >= CUSOWN_LANDING_NAV_COMPACT_AFTER_SCROLL_PX);
  });

  const compactBar = pastHeroNav;
  const navMorphTransition = reduceMotionNav
    ? { duration: 0.15 }
    : compactBar
      ? { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.9 }
      : { type: 'tween' as const, duration: 0.14, ease: [0.22, 1, 0.36, 1] as const };

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const go = useCallback(
    (path: string) => {
      setMobileOpen(false);
      router.push(path);
    },
    [router]
  );

  const scrollToSection = useCallback((id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const navItemClass = `text-left font-medium tracking-tight text-zinc-400 transition-colors hover:text-white ${
    compactBar ? 'text-[13px]' : 'text-sm'
  }`;

  const mobileNavItemClass =
    'min-h-[2.75rem] py-2.5 text-left text-[15px] font-medium tracking-tight text-zinc-300 transition-colors hover:text-white active:text-white';

  const navLink = (id: keyof typeof CUSOWN_LANDING_SECTION_IDS, label: string) =>
    sectionNavMode === 'external' ? (
      <Link
        href={`/#${CUSOWN_LANDING_SECTION_IDS[id]}`}
        onClick={() => setMobileOpen(false)}
        className={navItemClass}
      >
        {label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={() => scrollToSection(CUSOWN_LANDING_SECTION_IDS[id])}
        className={navItemClass}
      >
        {label}
      </button>
    );

  const mobileNavLink = (id: keyof typeof CUSOWN_LANDING_SECTION_IDS, label: string) =>
    sectionNavMode === 'external' ? (
      <Link
        href={`/#${CUSOWN_LANDING_SECTION_IDS[id]}`}
        onClick={() => setMobileOpen(false)}
        className={mobileNavItemClass}
      >
        {label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={() => scrollToSection(CUSOWN_LANDING_SECTION_IDS[id])}
        className={mobileNavItemClass}
      >
        {label}
      </button>
    );

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-zinc-950/72 backdrop-blur-md md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <motion.header
        initial={false}
        animate={{
          left: compactBar ? '50%' : '0%',
          x: compactBar ? '-50%' : 0,
          width: compactBar ? 'min(94vw, 56rem)' : '100%',
          borderTopLeftRadius: compactBar ? 22 : 0,
          borderTopRightRadius: compactBar ? 22 : 0,
          borderBottomLeftRadius: compactBar ? 22 : 0,
          borderBottomRightRadius: compactBar ? 22 : 0,
        }}
        transition={navMorphTransition}
        className={`marketing-safe-x fixed z-50 ${
          compactBar
            ? 'top-[max(0.75rem,env(safe-area-inset-top,0px))] md:top-5'
            : 'top-0 pt-[env(safe-area-inset-top,0px)]'
        } ${
          compactBar
            ? 'border border-white/[0.13] bg-zinc-950/88 shadow-[0_16px_56px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)_inset,0_0_60px_-24px_rgba(34,197,94,0.14)] backdrop-blur-2xl backdrop-saturate-150'
            : navSolid
              ? 'border-b border-white/5 bg-zinc-950/78 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl backdrop-saturate-150'
              : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-4 ${
            compactBar ? 'px-3 py-2 sm:px-5 sm:py-2.5' : 'px-4 py-4 sm:px-6 lg:px-8'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              if (sectionNavMode === 'landing') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                router.push(ROUTES.HOME);
              }
            }}
            className="min-w-0 text-left"
          >
            <div
              className={`font-display font-bold tracking-tight text-white transition-[font-size] duration-200 ${
                compactBar ? 'text-base sm:text-[1.05rem]' : 'text-lg'
              }`}
            >
              CUSOWN
            </div>
            {!compactBar ? (
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                a Clykur product
              </div>
            ) : null}
          </button>

          <nav
            className={`hidden items-center md:flex ${compactBar ? 'gap-3 lg:gap-4 xl:gap-5' : 'gap-5 lg:gap-6 xl:gap-8'}`}
          >
            {navLink('platform', 'Platform')}
            {navLink('capabilities', 'Capabilities')}
            {navLink('pricing', 'Pricing')}
            {navLink('process', 'Process')}
            {navLink('roadmap', 'Roadmap')}
            {navLink('faq', 'FAQ')}
            <motion.button
              type="button"
              onClick={() => go(ROUTES.SELECT_ROLE())}
              whileHover={reduceMotionNav ? undefined : { scale: 1.02 }}
              whileTap={reduceMotionNav ? undefined : { scale: 0.98 }}
              className={`rounded-lg bg-accent font-semibold text-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-shadow hover:shadow-[0_0_28px_rgba(34,197,94,0.38)] ${
                compactBar ? 'px-4 py-1.5 text-[13px]' : 'px-5 py-2 text-sm'
              }`}
            >
              Get Started
            </motion.button>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 md:hidden">
            <motion.button
              type="button"
              onClick={() => go(ROUTES.SELECT_ROLE())}
              whileTap={reduceMotionNav ? undefined : { scale: 0.97 }}
              className={`rounded-lg bg-accent font-semibold text-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ${
                compactBar ? 'px-3 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs'
              }`}
            >
              Get Started
            </motion.button>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="rounded-lg p-2.5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] transition-colors hover:border-white/20"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-white/[0.09] bg-zinc-950/97 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl md:hidden"
          >
            <div className="flex flex-col gap-0.5">
              {mobileNavLink('platform', 'Platform')}
              {mobileNavLink('capabilities', 'Capabilities')}
              {mobileNavLink('pricing', 'Pricing')}
              {mobileNavLink('process', 'Process')}
              {mobileNavLink('roadmap', 'Roadmap')}
              {mobileNavLink('faq', 'FAQ')}
            </div>
          </motion.div>
        ) : null}
      </motion.header>
    </>
  );
}
