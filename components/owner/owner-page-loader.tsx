'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface OwnerPageLoaderProps {
  title: string;
}

export default function OwnerPageLoader({ title }: OwnerPageLoaderProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const increment = Math.random() * 15 + 5;
        return Math.min(prev + increment, 100);
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 font-calegar">
          CusOwn
        </h1>

        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-900 rounded-full transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-slate-400 tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <span className="text-sm text-slate-500">A</span>
          <Image
            src="/icons/Clykur Logo.svg"
            alt="Clykur"
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="text-sm text-slate-500">Product</span>
        </div>
      </div>
    </div>
  );
}
