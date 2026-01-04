'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';

export default function Home() {
  const router = useRouter();

  const handleContinue = () => {
    router.push('/select-role');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <main className="mx-auto max-w-3xl text-center">
          <h2 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Book Your Slot,
            <br />
            <span className="text-black">Anytime, Anywhere</span>
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            A simple, elegant solution for booking slots across various services.
            <br />
            <span className="font-medium text-black">Currently available for salon bookings.</span>
          </p>

          <div className="mt-10">
            <Button size="lg" onClick={handleContinue} className="w-full sm:w-auto">
              Tap to Proceed
            </Button>
          </div>
        </main>
      </div>

      <footer className="py-8 text-center text-gray-600 text-sm">
        &copy; {new Date().getFullYear()} CusOwn. All rights reserved.
      </footer>
    </div>
  );
}
