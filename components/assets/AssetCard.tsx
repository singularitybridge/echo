/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState } from 'react';
import { Edit2, Trash2, Eye, MoreVertical, Tag, Copy, Check, Sparkles } from 'lucide-react';
import type { Asset } from '@/types/asset';

interface AssetCardProps {
  asset: Asset;
  onDelete: (assetId: string) => void;
  onEdit: (assetId: string) => void;
  onView?: (asset: Asset) => void;
  onRegenerate?: (asset: Asset) => void;
}

export default function AssetCard({ asset, onDelete, onEdit, onView, onRegenerate }: AssetCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Add cache-busting parameter using updatedAt timestamp
  const getCacheBustedUrl = (url: string) => {
    if (!url || url.startsWith('/placeholder')) return url;
    const timestamp = new Date(asset.updatedAt).getTime();
    return `${url}?t=${timestamp}`;
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'character':
        return 'bg-blue-100 text-blue-700';
      case 'prop':
        return 'bg-green-100 text-green-700';
      case 'location':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getProviderColor = (provider: string): string => {
    switch (provider) {
      case 'gemini':
        return 'bg-indigo-100 text-indigo-700';
      case 'openai':
        return 'bg-emerald-100 text-emerald-700';
      case 'fal':
        return 'bg-pink-100 text-pink-700';
      case 'replicate':
        return 'bg-orange-100 text-orange-700';
      case 'uploaded':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      <div className="relative aspect-[9/16] bg-gray-100">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        )}
        <img
          src={getCacheBustedUrl(asset.url || '/placeholder-asset.png')}
          alt={asset.name}
          className={`w-full h-full object-cover ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } transition-opacity`}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-asset.png';
            setImageLoaded(true);
          }}
        />

        {/* Overlay with actions (shown on hover) */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => onView ? onView(asset) : window.open(getCacheBustedUrl(asset.url), '_blank')}
            className="flex items-center justify-center w-10 h-10 bg-white rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
            title="View full size"
          >
            <Eye className="w-5 h-5" />
          </button>
          <button
            onClick={() => onEdit(asset.id)}
            className="flex items-center justify-center w-10 h-10 bg-white rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
            title="Edit asset"
          >
            <Edit2 className="w-5 h-5" />
          </button>
          {onRegenerate && asset.generationPrompt && (
            <button
              onClick={() => onRegenerate(asset)}
              className="flex items-center justify-center w-10 h-10 bg-white rounded-full text-indigo-600 hover:bg-gray-100 transition-colors"
              title="Regenerate asset"
            >
              <Sparkles className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => onDelete(asset.id)}
            className="flex items-center justify-center w-10 h-10 bg-white rounded-full text-red-600 hover:bg-gray-100 transition-colors"
            title="Delete asset"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(
              asset.type
            )}`}
          >
            {asset.type.charAt(0).toUpperCase() + asset.type.slice(1)}
          </span>
        </div>

        {/* Provider badge */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${getProviderColor(
              asset.provider
            )}`}
          >
            {asset.provider === 'upload' ? 'Uploaded' : asset.provider.toUpperCase()}
          </span>
        </div>

        {/* Title and Description Overlay at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 pt-8">
          <h3 className="font-semibold text-white text-sm mb-0.5 truncate" title={asset.name}>
            {asset.name}
          </h3>
          {asset.description && (
            <p className="text-xs text-white/80 line-clamp-2" title={asset.description}>
              {asset.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
