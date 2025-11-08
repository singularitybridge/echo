/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { X, Image as ImageIcon, Film } from 'lucide-react';

interface ReferenceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterRefs: string[];
  selectedReference: 'previous' | number;
  onSelectReference: (ref: 'previous' | number) => void;
  sceneIndex: number;
  previousSceneTitle?: string;
  projectId: string;
}

export const ReferenceSelectionModal: React.FC<ReferenceSelectionModalProps> = ({
  isOpen,
  onClose,
  characterRefs,
  selectedReference,
  onSelectReference,
  sceneIndex,
  previousSceneTitle,
  projectId,
}) => {
  if (!isOpen) return null;

  const handleSelect = (ref: 'previous' | number) => {
    onSelectReference(ref);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Select Start Frame</h2>
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
            Choose which asset or previous shot to use as the starting frame for this scene
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Previous Shot Option */}
            {sceneIndex > 0 && (
              <button
                onClick={() => handleSelect('previous')}
                className={`relative aspect-[9/16] rounded-lg border-2 transition-all overflow-hidden group ${
                  selectedReference === 'previous'
                    ? 'border-indigo-600 ring-2 ring-indigo-600 ring-opacity-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col items-center justify-center p-4">
                  <Film size={48} className="text-indigo-600 mb-3" />
                  <span className="text-sm font-medium text-gray-900 text-center">
                    Continue from Previous Shot
                  </span>
                  {previousSceneTitle && (
                    <span className="text-xs text-gray-500 mt-1 text-center">
                      "{previousSceneTitle}"
                    </span>
                  )}
                </div>
                {selectedReference === 'previous' && (
                  <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            )}

            {/* Character Assets */}
            {characterRefs.map((refUrl, index) => (
              <button
                key={index}
                onClick={() => handleSelect(index + 1)}
                className={`relative aspect-[9/16] rounded-lg border-2 transition-all overflow-hidden group ${
                  selectedReference === index + 1
                    ? 'border-indigo-600 ring-2 ring-indigo-600 ring-opacity-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img
                  src={refUrl}
                  alt={`Asset ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <span className="text-white text-sm font-medium">
                    Asset {index + 1}
                  </span>
                </div>
                {selectedReference === index + 1 && (
                  <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-all pointer-events-none" />
              </button>
            ))}
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
