/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { X, Image as ImageIcon, Film, Ban } from 'lucide-react';

interface AssetInfo {
  url: string;
  name?: string;
  description?: string;
}

interface EndFrameSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterRefs: string[];  // Same format as ReferenceSelectionModal - array of URLs
  assetInfo?: AssetInfo[];  // Optional: asset name and description for display
  selectedEndFrame: 'none' | 'asset' | 'next-shot';
  selectedAssetIndex?: number;  // 1-based index like referenceMode
  onSelectEndFrame: (mode: 'none' | 'asset' | 'next-shot', assetIndex?: number) => void;
  nextSceneTitle?: string;
  nextSceneGenerated: boolean;
  nextSceneFirstFrameUrl?: string;
}

export const EndFrameSelectionModal: React.FC<EndFrameSelectionModalProps> = ({
  isOpen,
  onClose,
  characterRefs,
  assetInfo,
  selectedEndFrame,
  selectedAssetIndex,
  onSelectEndFrame,
  nextSceneTitle,
  nextSceneGenerated,
  nextSceneFirstFrameUrl,
}) => {
  if (!isOpen) return null;

  const handleSelect = (mode: 'none' | 'asset' | 'next-shot', assetIndex?: number) => {
    onSelectEndFrame(mode, assetIndex);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Select End Frame</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600 mb-6">
            Choose how to end this scene. Use "None" for free generation, or select a target end frame for transitions.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* None Option (Default) */}
            <button
              onClick={() => handleSelect('none')}
              className={`relative aspect-[9/16] rounded-lg border-2 transition-all overflow-hidden group ${
                selectedEndFrame === 'none'
                  ? 'border-indigo-600 ring-2 ring-indigo-600 ring-opacity-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
                <Ban size={48} className="text-gray-400 mb-3" />
                <span className="text-sm font-medium text-gray-900 text-center">
                  None
                </span>
                <span className="text-xs text-gray-500 mt-1 text-center">
                  No end frame constraint
                </span>
              </div>
              {selectedEndFrame === 'none' && (
                <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>

            {/* Next Shot Option (only if next shot is generated) */}
            {nextSceneGenerated && nextSceneFirstFrameUrl && (
              <button
                onClick={() => handleSelect('next-shot')}
                className={`relative aspect-[9/16] rounded-lg border-2 transition-all overflow-hidden group ${
                  selectedEndFrame === 'next-shot'
                    ? 'border-indigo-600 ring-2 ring-indigo-600 ring-opacity-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img
                  src={nextSceneFirstFrameUrl}
                  alt="Next shot first frame"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col items-center justify-end p-3">
                  <Film size={32} className="text-white mb-2" />
                  <span className="text-white text-sm font-medium text-center">
                    Continue to Next Shot
                  </span>
                  {nextSceneTitle && (
                    <span className="text-white/80 text-xs mt-1 text-center">
                      "{nextSceneTitle}"
                    </span>
                  )}
                </div>
                {selectedEndFrame === 'next-shot' && (
                  <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-all pointer-events-none" />
              </button>
            )}

            {/* Asset Options - same format as ReferenceSelectionModal */}
            {characterRefs.map((refUrl, index) => {
              const assetIndex = index + 1;  // 1-based index like referenceMode
              const isSelected = selectedEndFrame === 'asset' && selectedAssetIndex === assetIndex;
              const info = assetInfo?.[index];
              const displayName = info?.name || `Asset ${assetIndex}`;
              const displayDescription = info?.description;

              return (
                <button
                  key={index}
                  onClick={() => handleSelect('asset', assetIndex)}
                  className={`relative aspect-[9/16] rounded-lg border-2 transition-all overflow-hidden group ${
                    isSelected
                      ? 'border-indigo-600 ring-2 ring-indigo-600 ring-opacity-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img
                    src={refUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 pt-8 text-left">
                    <h3 className="font-semibold text-white text-sm mb-0.5 truncate" title={displayName}>
                      {displayName}
                    </h3>
                    {displayDescription && (
                      <p className="text-xs text-white/80 line-clamp-2" title={displayDescription}>
                        {displayDescription}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-all pointer-events-none" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <ImageIcon size={16} className="inline mr-1" />
            {characterRefs.length} asset{characterRefs.length !== 1 ? 's' : ''} available
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
