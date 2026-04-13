'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

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
              c: { a: 0, k: [0.06, 0.09, 0.16, 1] },
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

export function SplashScreen() {
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

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
    setTimeout(() => setShowContent(true), 100);

    const hideTimeout = setTimeout(() => {
      sessionStorage.setItem(sessionKey, 'true');
      setFadeOut(true);
      setTimeout(() => setVisible(false), 500);
    }, 3500);

    return () => clearTimeout(hideTimeout);
  }, [pathname]);

  if (!mounted || !visible || !shouldShow) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white transition-all duration-500 ${
        fadeOut ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
    >
      <div
        className={`relative flex flex-col items-center transition-all duration-700 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Logo */}
        <h1 className="font-calegar text-5xl sm:text-6xl font-bold tracking-[0.15em] uppercase mb-8 text-slate-900">
          CusOwn
        </h1>

        {/* Loader */}
        <div className="w-20 h-20 mb-10">
          <Lottie animationData={loadingAnimation} loop />
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
