'use client';

import { memo } from 'react';
import Image from 'next/image';
import DownloadIcon from '@/src/icons/download.svg';

interface QRCodeSectionProps {
  qrCode: string | null | undefined;
  bookingLink: string;
}

function QRCodeSectionComponent({ qrCode, bookingLink }: QRCodeSectionProps) {
  const downloadQRCode = () => {
    if (!qrCode) return;
    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `${bookingLink}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="flex-shrink-0">
          {qrCode ? (
            <div className="flex justify-center bg-white p-3 lg:p-4 rounded-lg border-2 border-gray-200 relative w-40 h-40 lg:w-48 lg:h-48">
              <Image src={qrCode} alt="QR Code" fill className="object-contain" unoptimized />
            </div>
          ) : (
            <div className="w-40 h-40 lg:w-48 lg:h-48 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-gray-200">
              <p className="text-gray-500 text-sm">Generating...</p>
            </div>
          )}
        </div>
        <div className="flex-1 text-center md:text-left w-full md:w-auto">
          <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-2">QR Code</h2>
          <p className="text-sm text-gray-600 mb-4">
            Download and keep it safe. Stick it in your shop for customers to scan and book.
          </p>
          {qrCode && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <button
                onClick={downloadQRCode}
                className="h-11 px-6 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
              >
                <DownloadIcon className="w-5 h-5" aria-hidden="true" />
                Download QR Code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const QRCodeSection = memo(QRCodeSectionComponent);
export default QRCodeSection;
