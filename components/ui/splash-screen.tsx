'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

const loadingAnimation = {
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
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              d: 1,
              ty: 'el',
              s: { a: 0, k: [80, 80] },
              p: { a: 0, k: [0, 0] },
              nm: 'Ellipse Path 1',
            },
            {
              ty: 'st',
              c: { a: 0, k: [0.06, 0.09, 0.16, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 4 },
              lc: 2,
              lj: 1,
              ml: 4,
              d: [
                { n: 'd', nm: 'dash', v: { a: 0, k: 60 } },
                { n: 'g', nm: 'gap', v: { a: 0, k: 200 } },
                {
                  n: 'o',
                  nm: 'offset',
                  v: {
                    a: 1,
                    k: [
                      { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 0, s: [0] },
                      { t: 120, s: [-251] },
                    ],
                  },
                },
              ],
              nm: 'Stroke 1',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
          nm: 'Ellipse 1',
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
    },
  ],
};

const SPLASH_SHOWN_KEY = 'cusown_splash_shown';

export function SplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if user has already seen the splash screen
    const hasSeenSplash = localStorage.getItem(SPLASH_SHOWN_KEY);
    if (hasSeenSplash) {
      setVisible(false);
      return;
    }

    // First-time visitor - show splash screen
    setShouldShow(true);
    setTimeout(() => setShowContent(true), 100);

    const minDuration = 3500;

    const hideTimeout = setTimeout(() => {
      // Mark splash as shown for future visits
      localStorage.setItem(SPLASH_SHOWN_KEY, 'true');
      setFadeOut(true);
      setTimeout(() => setVisible(false), 500);
    }, minDuration);

    return () => {
      clearTimeout(hideTimeout);
    };
  }, []);

  // Don't render if not mounted, not visible, or shouldn't show
  if (!mounted || !visible || !shouldShow) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white transition-all duration-500 ${
        fadeOut ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
      style={{ backgroundColor: 'white' }}
    >
      {/* Main content */}
      <div
        className={`relative flex flex-col items-center transition-all duration-700 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Logo */}
        <h1 className="font-calegar text-5xl sm:text-6xl font-bold tracking-[0.15em] uppercase mb-8 text-slate-900">
          CusOwn
        </h1>

        {/* Lottie Loading Animation */}
        <div className="w-20 h-20 mb-10">
          <Lottie animationData={loadingAnimation} loop={true} />
        </div>

        {/* Branding */}
        <div
          className={`flex items-center gap-3 transition-all duration-700 delay-300 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="text-sm font-light text-slate-400 tracking-wider">A</span>
          <Image
            src="/icons/Clykur Logo.svg"
            alt="Clykur"
            width={140}
            height={140}
            className="w-28 h-28 sm:w-32 sm:h-32"
            priority
          />
          <span className="text-sm font-light text-slate-400 tracking-wider">Product</span>
        </div>
      </div>
    </div>
  );
}
