/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { ImageEditingModel } from '@/types/ai-models';
import { getAllModels } from '@/lib/ai-models';
import { Zap, Clock, Hourglass } from 'lucide-react';

interface ModelSelectorProps {
  selectedModels?: ImageEditingModel[];
  onModelsChange?: (models: ImageEditingModel[]) => void;
}

// Proper Tailwind class mappings (no dynamic string interpolation)
const BORDER_COLORS = {
  indigo: 'border-indigo-600',
  blue: 'border-blue-600',
  purple: 'border-purple-600',
  pink: 'border-pink-600',
};

const BG_COLORS = {
  indigo: 'bg-indigo-50',
  blue: 'bg-blue-50',
  purple: 'bg-purple-50',
  pink: 'bg-pink-50',
};

const TEXT_COLORS = {
  indigo: 'text-indigo-600',
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  pink: 'text-pink-600',
};

export function ModelSelector({
  selectedModels = [],
  onModelsChange,
}: ModelSelectorProps) {
  const allModels = getAllModels();

  const toggleModelSelection = (modelId: ImageEditingModel) => {
    if (selectedModels.includes(modelId)) {
      onModelsChange?.(selectedModels.filter((m) => m !== modelId));
    } else {
      onModelsChange?.([...selectedModels, modelId]);
    }
  };

  const getSpeedIcon = (speed: 'fast' | 'medium' | 'slow') => {
    if (speed === 'fast') return <Zap className="w-3.5 h-3.5" />;
    if (speed === 'medium') return <Clock className="w-3.5 h-3.5" />;
    return <Hourglass className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {allModels.map((model) => {
          const isSelected = selectedModels.includes(model.id);

          // Get proper Tailwind classes from mappings
          const borderColor = BORDER_COLORS[model.colorAccent as keyof typeof BORDER_COLORS] || 'border-gray-300';
          const bgColor = BG_COLORS[model.colorAccent as keyof typeof BG_COLORS] || 'bg-gray-50';
          const textColor = TEXT_COLORS[model.colorAccent as keyof typeof TEXT_COLORS] || 'text-gray-700';

          return (
            <button
              key={model.id}
              onClick={() => toggleModelSelection(model.id)}
              title={`${model.description} • ${model.tags.join(', ')}`}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all flex items-center gap-2 ${
                isSelected
                  ? `${borderColor} ${bgColor} ${textColor}`
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span>{model.name}</span>
              {getSpeedIcon(model.speed)}
            </button>
          );
        })}
      </div>
      {selectedModels.length > 0 && (
        <div className="text-xs text-gray-500">
          {selectedModels.length} selected
        </div>
      )}
    </div>
  );
}

