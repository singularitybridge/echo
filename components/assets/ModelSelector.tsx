/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { ImageEditingModel, ImageGenerationModel } from '@/types/ai-models';
import { getAllModels, getAllGenerationModels } from '@/lib/ai-models';

interface ModelSelectorProps {
  mode?: 'editing' | 'generation';
  selectedModels?: ImageEditingModel[] | ImageGenerationModel[];
  onModelsChange?: (models: ImageEditingModel[] | ImageGenerationModel[]) => void;
}

export function ModelSelector({
  mode = 'editing',
  selectedModels = [],
  onModelsChange,
}: ModelSelectorProps) {
  const allModels = mode === 'editing' ? getAllModels() : getAllGenerationModels();

  const toggleModelSelection = (modelId: ImageEditingModel | ImageGenerationModel) => {
    if ((selectedModels as any[]).includes(modelId)) {
      onModelsChange?.(selectedModels.filter((m) => m !== modelId) as any);
    } else {
      onModelsChange?.([...selectedModels, modelId] as any);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {allModels.map((model) => {
        const isSelected = (selectedModels as any[]).includes(model.id);

        return (
          <button
            key={model.id}
            onClick={() => toggleModelSelection(model.id)}
            title={`${model.description} • ${model.tags.join(', ')}`}
            className={`px-2 py-1 text-xs font-medium rounded border transition-all ${
              isSelected
                ? 'border-gray-800 bg-gray-800 text-white'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {model.name}
          </button>
        );
      })}
    </div>
  );
}

