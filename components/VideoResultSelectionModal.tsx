/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Film, Loader2, AlertCircle, Check } from 'lucide-react';
import { VideoGenerationResult } from '@/types/ai-models';
import { getVideoGenerationModelDefinition } from '@/lib/ai-models';

interface VideoResultSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: VideoGenerationResult[];
  onSelect: (result: VideoGenerationResult) => void;
  isLoading?: boolean;
}

export default function VideoResultSelectionModal({
  isOpen,
  onClose,
  results,
  onSelect,
  isLoading = false,
}: VideoResultSelectionModalProps) {
  const [selectedResult, setSelectedResult] = useState<VideoGenerationResult | null>(null);
  const [hoveredResult, setHoveredResult] = useState<VideoGenerationResult | null>(null);

  const handleSelect = (result: VideoGenerationResult) => {
    if (result.loading || result.error) return;
    setSelectedResult(result);
  };

  const handleConfirm = () => {
    if (selectedResult) {
      onSelect(selectedResult);
      onClose();
    }
  };

  if (!isOpen) return null;

  const successfulResults = results.filter(r => !r.loading && !r.error);
  const hasResults = successfulResults.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Film className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Select Video Result</h2>
              <p className="text-sm text-gray-500">
                {results.length} model{results.length > 1 ? 's' : ''} generated
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirm}
              disabled={!selectedResult || isLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Use Selected
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isLoading}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Main Content: Two-column layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Results Grid (40%) */}
          <div className="w-[40%] flex flex-col bg-white border-r border-gray-200">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-600 uppercase">
                Generated Videos
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Film className="w-12 h-12 mb-2" />
                  <p className="text-sm">No results yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {results.map((result, index) => {
                    const modelDef = getVideoGenerationModelDefinition(result.model);
                    const isSelected = selectedResult?.model === result.model &&
                                     selectedResult?.videoUrl === result.videoUrl;

                    return (
                      <button
                        key={`${result.model}-${index}`}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => !result.loading && !result.error && setHoveredResult(result)}
                        onMouseLeave={() => setHoveredResult(null)}
                        disabled={result.loading || !!result.error}
                        className={`relative rounded-lg overflow-hidden transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSelected ? 'ring-2 ring-indigo-500' : 'hover:ring-2 hover:ring-gray-300'
                        }`}
                      >
                        {/* Thumbnail - 9:16 Portrait */}
                        <div className="relative aspect-[9/16] bg-gray-100">
                          {result.loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-2" />
                              <p className="text-xs text-gray-500">{modelDef.name}</p>
                            </div>
                          )}
                          {result.error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50">
                              <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                              <p className="text-xs text-red-600 px-2 text-center line-clamp-2">
                                {result.error}
                              </p>
                            </div>
                          )}
                          {!result.loading && !result.error && result.thumbnailDataUrl && (
                            <img
                              src={result.thumbnailDataUrl}
                              alt={modelDef.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                          {/* Selected Checkmark */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Model Info */}
                        <div className="p-3 bg-white border-t border-gray-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {modelDef.name}
                            </span>
                            {result.generationTime && (
                              <span className="text-xs text-gray-500">
                                {result.generationTime.toFixed(1)}s
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-1">
                            {modelDef.provider}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Video Preview (60%) */}
          <div className="w-[60%] flex flex-col bg-gray-50">
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
              {!selectedResult && !hoveredResult && !hasResults ? (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <Film className="w-16 h-16" />
                  <p className="text-sm">Generating videos...</p>
                </div>
              ) : selectedResult || hoveredResult ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Video Player - 9:16 Portrait */}
                  <div className="aspect-[9/16] max-h-full">
                    <video
                      key={
                        hoveredResult?.videoUrl || selectedResult?.videoUrl
                      }
                      src={
                        hoveredResult?.videoUrl || selectedResult?.videoUrl
                      }
                      controls
                      autoPlay
                      loop
                      className="w-full h-full rounded-lg shadow-lg object-cover"
                    />
                  </div>

                  {/* Model Badge Overlay */}
                  <div className="absolute top-3 left-3">
                    {hoveredResult ? (
                      <div className="px-3 py-1.5 bg-indigo-600/90 text-white text-sm rounded-lg font-medium">
                        Previewing: {getVideoGenerationModelDefinition(hoveredResult.model).name}
                      </div>
                    ) : selectedResult ? (
                      <div className="px-3 py-1.5 bg-black/70 text-white text-sm rounded-lg font-medium flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        {getVideoGenerationModelDefinition(selectedResult.model).name}
                      </div>
                    ) : null}
                  </div>

                  {/* Generation Time Badge */}
                  {(hoveredResult || selectedResult) && (
                    <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 text-white text-xs rounded-lg">
                      {(hoveredResult?.generationTime || selectedResult?.generationTime)?.toFixed(1)}s
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <AlertCircle className="w-16 h-16" />
                  <p className="text-sm">Select a video to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
