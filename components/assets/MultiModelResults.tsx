/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { ModelEditResult } from '@/types/ai-models';
import { getModelDefinition } from '@/lib/ai-models';
import {
  Check,
  X,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface MultiModelResultsProps {
  results: ModelEditResult[];
  onSelectResult: (result: ModelEditResult) => void;
  onDiscardResult?: (result: ModelEditResult) => void;
}

export function MultiModelResults({
  results,
  onSelectResult,
  onDiscardResult,
}: MultiModelResultsProps) {
  const [hoveredResult, setHoveredResult] = React.useState<string | null>(null);

  if (results.length === 0) return null;

  const downloadImage = (result: ModelEditResult) => {
    if (!result.imageBytes || !result.mimeType) return;

    const dataUrl = `data:${result.mimeType};base64,${result.imageBytes}`;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${result.model}-edit.${result.mimeType.split('/')[1]}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Results</h3>

      <div className="grid grid-cols-2 gap-3">
        {results.map((result) => {
          const modelDef = getModelDefinition(result.model);
          const isHovered = hoveredResult === result.model;

          return (
            <div
              key={result.model}
              className="relative border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Image Container */}
              <div
                className="relative aspect-square bg-gray-50 cursor-pointer"
                onMouseEnter={() => setHoveredResult(result.model)}
                onMouseLeave={() => setHoveredResult(null)}
              >
                {result.loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mb-2" />
                    <p className="text-xs text-gray-500">{modelDef.name}</p>
                  </div>
                )}

                {result.error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
                    <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
                    <p className="text-xs text-red-500 text-center">{result.error}</p>
                  </div>
                )}

                {!result.loading && !result.error && result.imageBytes && (
                  <>
                    {/* Small thumbnail or large preview based on hover */}
                    <img
                      src={`data:${result.mimeType};base64,${result.imageBytes}`}
                      alt={modelDef.name}
                      className={`w-full h-full transition-all duration-200 ${
                        isHovered
                          ? 'fixed inset-8 z-50 object-contain max-w-4xl max-h-[80vh] mx-auto my-auto rounded-lg shadow-2xl border-4 border-purple-500'
                          : 'object-cover'
                      }`}
                    />

                    {/* Action buttons overlay (only on small view) */}
                    {!isHovered && (
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/50 transition-all flex items-center justify-center opacity-0 hover:opacity-100 gap-2">
                        <button
                          onClick={() => onSelectResult(result)}
                          className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors shadow-lg"
                          title="Use this image"
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </button>
                        <button
                          onClick={() => downloadImage(result)}
                          className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors shadow-lg"
                          title="Download"
                        >
                          <Download className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{modelDef.name}</span>
                {!result.loading && !result.error && result.generationTime && (
                  <span className="text-xs text-gray-500">{result.generationTime.toFixed(1)}s</span>
                )}
              </div>

              {/* Action Bar */}
              {!result.loading && !result.error && result.imageBytes && (
                <div className="flex gap-1.5 p-2 border-t">
                  <button
                    onClick={() => onSelectResult(result)}
                    className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Use
                  </button>
                  {onDiscardResult && (
                    <button
                      onClick={() => onDiscardResult(result)}
                      className="p-1.5 border border-gray-300 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                      title="Discard"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
