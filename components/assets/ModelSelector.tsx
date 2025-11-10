/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { ImageEditingModel, ImageGenerationModel } from '@/types/ai-models';
import { getAllModels, getAllGenerationModels } from '@/lib/ai-models';
import { Zap, Clock, Hourglass } from 'lucide-react';

interface ModelSelectorProps {
  mode?: 'editing' | 'generation';
  selectedModels?: ImageEditingModel[] | ImageGenerationModel[];
  onModelsChange?: (models: ImageEditingModel[] | ImageGenerationModel[]) => void;
}

// Proper Tailwind class mappings (no dynamic string interpolation)
const BORDER_COLORS = {
  indigo: 'border-indigo-600',
  blue: 'border-blue-600',
  purple: 'border-purple-600',
  pink: 'border-pink-600',
  violet: 'border-violet-600',
  green: 'border-green-600',
  cyan: 'border-cyan-600',
  orange: 'border-orange-600',
};

const BG_COLORS = {
  indigo: 'bg-indigo-50',
  blue: 'bg-blue-50',
  purple: 'bg-purple-50',
  pink: 'bg-pink-50',
  violet: 'bg-violet-50',
  green: 'bg-green-50',
  cyan: 'bg-cyan-50',
  orange: 'bg-orange-50',
};

const TEXT_COLORS = {
  indigo: 'text-indigo-600',
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  pink: 'text-pink-600',
  violet: 'text-violet-600',
  green: 'text-green-600',
  cyan: 'text-cyan-600',
  orange: 'text-orange-600',
};

export function ModelSelector({
  mode = 'editing',
  selectedModels = [],
  onModelsChange,
}: ModelSelectorProps) {
  const allModels = mode === 'editing' ? getAllModels() : getAllGenerationModels();

  const toggleModelSelection = (modelId: ImageEditingModel | ImageGenerationModel) => {
    if (selectedModels.includes(modelId as any)) {
      onModelsChange?.(selectedModels.filter((m) => m !== modelId));
    } else {
      onModelsChange?.([...selectedModels, modelId] as any);
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

