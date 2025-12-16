/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react';
import type { Asset } from '@/types/asset';

interface AssetLightboxProps {
  asset: Asset | null;
  assets: Asset[];
  onClose: () => void;
  onNavigate: (asset: Asset) => void;
}

export default function AssetLightbox({
  asset,
  assets,
  onClose,
  onNavigate,
}: AssetLightboxProps) {
  const currentIndex = asset ? assets.findIndex((a) => a.id === asset.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < assets.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(assets[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, assets, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      onNavigate(assets[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, assets, onNavigate]);

  const handleDownload = useCallback(() => {
    if (!asset) return;
    const link = document.createElement('a');
    link.href = asset.url;
    link.download = asset.name || 'asset';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [asset]);

  // Keyboard navigation
  useEffect(() => {
    if (!asset) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          handlePrev();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [asset, onClose, handlePrev, handleNext]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (asset) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [asset]);

  if (!asset) return null;

  // Add cache-busting parameter
  const getCacheBustedUrl = (url: string) => {
    if (!url || url.startsWith('/placeholder')) return url;
    const timestamp = new Date(asset.updatedAt).getTime();
    return `${url}?t=${timestamp}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {currentIndex + 1} / {assets.length}
          </span>
          <span className="text-sm font-medium truncate max-w-md">
            {asset.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={() => window.open(getCacheBustedUrl(asset.url), '_blank')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex items-center justify-center relative px-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Previous button */}
        <button
          onClick={handlePrev}
          disabled={!hasPrev}
          className={`absolute left-4 p-3 rounded-full transition-all ${
            hasPrev
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
          title="Previous (←)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Image */}
        <div className="max-w-full max-h-full flex items-center justify-center">
          <img
            src={getCacheBustedUrl(asset.url)}
            alt={asset.name}
            className="max-w-full max-h-[calc(100vh-160px)] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={!hasNext}
          className={`absolute right-4 p-3 rounded-full transition-all ${
            hasNext
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
          title="Next (→)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Footer with asset info */}
      <div
        className="p-4 text-white text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-gray-400 max-w-2xl mx-auto line-clamp-2">
          {asset.description}
        </p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
          <span className="capitalize">{asset.type}</span>
          <span>•</span>
          <span className="uppercase">{asset.provider}</span>
        </div>
      </div>
    </div>
  );
}
