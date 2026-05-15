'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

/** Accent #22c55e — matches landing `text-accent` loader on dark shell. */
const LOTTIE_STROKE_LANDING = [0.133, 0.773, 0.369, 1] as const;
const LOTTIE_STROKE_DEFAULT = [0.06, 0.09, 0.16, 1] as const;

function buildLoadingAnimation(strokeRgb: readonly [number, number, number, number]) {
  return {
    v: '5.5.7',
    fr: 60,
    ip: 0,
    op: 120,
    w: 200,
    h: 200,
    nm: 'Loading',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Circle 1',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: {
            a: 1,
            k: [
              { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 0, s: [0] },
              { t: 120, s: [360] },
            ],
          },
          p: { a: 0, k: [100, 100, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        shapes: [
          {
            ty: 'gr',
            it: [
              {
                d: 1,
                ty: 'el',
                s: { a: 0, k: [80, 80] },
                p: { a: 0, k: [0, 0] },
              },
              {
                ty: 'st',
                c: { a: 0, k: [...strokeRgb] },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 4 },
                lc: 2,
                lj: 1,
                d: [
                  { n: 'd', v: { a: 0, k: 60 } },
                  { n: 'g', v: { a: 0, k: 200 } },
                  {
                    n: 'o',
                    v: {
                      a: 1,
                      k: [
                        { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 0, s: [0] },
                        { t: 120, s: [-251] },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

const loadingAnimationDefault = buildLoadingAnimation(LOTTIE_STROKE_DEFAULT);
const loadingAnimationLanding = buildLoadingAnimation(LOTTIE_STROKE_LANDING);

const SPLASH_MAIN_MS = 3500;
const SPLASH_FADE_MS = 500;

export function SplashScreen() {
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [loadPercent, setLoadPercent] = useState(0);

  useEffect(() => {
    setMounted(true);

    const allowedRoutes = ['/', '/customer/dashboard', '/owner/dashboard'];

    // Not an allowed route → don't show splash
    if (!allowedRoutes.includes(pathname)) {
      setVisible(false);
      return;
    }

    // Per-session control
    const sessionKey = `splash_shown_${pathname}`;
    const hasSeen = sessionStorage.getItem(sessionKey);

    if (hasSeen) {
      setVisible(false);
      return;
    }

    // Show splash
    setShouldShow(true);
    setLoadPercent(0);
    setTimeout(() => setShowContent(true), 100);

    const hideTimeout = setTimeout(() => {
      sessionStorage.setItem(sessionKey, 'true');
      setLoadPercent(100);
      setFadeOut(true);
      setTimeout(() => setVisible(false), SPLASH_FADE_MS);
    }, SPLASH_MAIN_MS);

    return () => clearTimeout(hideTimeout);
  }, [pathname]);

  useEffect(() => {
    if (!shouldShow || !visible) return;

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SPLASH_MAIN_MS);
      setLoadPercent(Math.min(100, Math.floor(t * 100)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shouldShow, visible, pathname]);

  if (!mounted || !visible || !shouldShow) return null;

  const isLanding = pathname === '/';
  const loadingAnimation = isLanding ? loadingAnimationLanding : loadingAnimationDefault;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden transition-all duration-500 ${
        isLanding ? 'bg-zinc-950' : 'bg-white'
      } ${fadeOut ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
    >
      {isLanding ? (
        <>
          <div
            className="pointer-events-none fixed inset-0 z-0 grain-overlay mix-blend-overlay"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950/90 via-zinc-950/45 to-zinc-950"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/35 to-zinc-950/85"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(34,197,94,0.12),transparent_50%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,0,0,0.45),transparent_50%)]"
            aria-hidden
          />
        </>
      ) : null}

      <div
        className={`relative z-10 flex flex-col items-center transition-all duration-700 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Logo */}
        <h1
          className={`mb-8 text-5xl font-bold tracking-tight sm:text-6xl ${
            isLanding
              ? 'font-display text-white'
              : 'font-calegar uppercase tracking-[0.15em] text-slate-900'
          }`}
        >
          {isLanding ? 'CUSOWN' : 'CusOwn'}
        </h1>

        {/* Loader */}
        <div className="mb-10 h-20 w-20">
          <Lottie animationData={loadingAnimation} loop />
        </div>

        {/* Branding */}
        <div
          className={`flex items-center gap-3 transition-all duration-700 delay-300 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <span
            className={`text-sm font-light tracking-wider ${isLanding ? 'text-zinc-500' : 'text-slate-400'}`}
          >
            A
          </span>
          <Image
            src="/icons/Clykur Logo.svg"
            alt="Clykur"
            width={140}
            height={140}
            className={`h-28 w-28 sm:h-32 sm:w-32 ${isLanding ? 'brightness-0 invert opacity-90' : ''}`}
            priority
          />
          <span
            className={`text-sm font-light tracking-wider ${isLanding ? 'text-zinc-500' : 'text-slate-400'}`}
          >
            Product
          </span>
        </div>
      </div>

      <p
        className={`pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(1.25rem,env(safe-area-inset-right,0px))] z-10 font-mono text-xs font-semibold tabular-nums tracking-tight sm:text-sm ${
          isLanding ? 'text-zinc-500' : 'text-slate-400'
        }`}
        aria-live="polite"
        aria-label={`Loading ${loadPercent} percent`}
      >
        <span className={isLanding ? 'text-accent' : 'text-slate-700'}>{loadPercent}</span>
        <span className="text-[0.85em] font-medium opacity-80">%</span>
      </p>
    </div>
  );
}
