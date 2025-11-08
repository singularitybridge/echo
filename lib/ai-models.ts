/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelDefinition, ImageEditingModel } from '@/types/ai-models';

/**
 * Comprehensive model definitions for all supported AI image editing models
 */
export const MODEL_DEFINITIONS: Record<ImageEditingModel, ModelDefinition> = {
  'gemini-flash': {
    id: 'gemini-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    endpoint: 'fal-ai/gemini-25-flash-image/edit',
    icon: 'zap',
    speed: 'fast',
    tags: ['creative', 'multi-image'],
    description:
      'Fast generation with creative multi-image fusion. Designed for low-latency with rich editing capabilities.',
    useCases: [
      'Quick iterations and rapid prototyping',
      'Multi-image composition and blending',
      'Creative transformations with character consistency',
    ],
    estimatedTimeSeconds: 2.5,
    colorAccent: 'indigo',
  },
  'flux-kontext': {
    id: 'flux-kontext',
    name: 'FLUX Kontext Pro',
    provider: 'Black Forest Labs',
    endpoint: 'fal-ai/flux-pro/kontext',
    icon: 'target',
    speed: 'medium',
    tags: ['context-aware', 'local-edits'],
    description:
      'Strong context handling with targeted, local edits. Seamlessly handles both text and reference images.',
    useCases: [
      'Precise local modifications',
      'Context-aware editing with reference preservation',
      'Targeted object replacement or addition',
    ],
    estimatedTimeSeconds: 4.0,
    colorAccent: 'blue',
  },
  'qwen-edit': {
    id: 'qwen-edit',
    name: 'Qwen Image Edit',
    provider: 'Alibaba',
    endpoint: 'fal-ai/qwen-image-edit',
    icon: 'type',
    speed: 'medium',
    tags: ['text-precision'],
    description:
      'Superior text rendering and precise text edits. Achieves significant advances in complex text handling.',
    useCases: [
      'Text replacement or addition in images',
      'Sign editing and typography modifications',
      'Complex text rendering scenarios',
    ],
    estimatedTimeSeconds: 3.5,
    colorAccent: 'purple',
  },
  'seededit': {
    id: 'seededit',
    name: 'SeedEdit v3',
    provider: 'ByteDance',
    endpoint: 'fal-ai/bytedance/seededit/v3/edit-image',
    icon: 'palette',
    speed: 'medium',
    tags: ['content-preservation'],
    description:
      'Faithful instruction following with content preservation. Delivers improvements in following instructions while preserving content.',
    useCases: [
      'Edits requiring high fidelity to original content',
      'Style transfers while maintaining structure',
      'Modifications that respect existing composition',
    ],
    estimatedTimeSeconds: 3.8,
    colorAccent: 'pink',
  },
};

/**
 * Get model definition by ID
 */
export function getModelDefinition(
  modelId: ImageEditingModel
): ModelDefinition {
  return MODEL_DEFINITIONS[modelId];
}

/**
 * Get all available models
 */
export function getAllModels(): ModelDefinition[] {
  return Object.values(MODEL_DEFINITIONS);
}

/**
 * Get models filtered by speed
 */
export function getModelsBySpeed(speed: 'fast' | 'medium' | 'slow'): ModelDefinition[] {
  return getAllModels().filter((model) => model.speed === speed);
}

/**
 * Get models sorted by estimated generation time
 */
export function getModelsBySpeed_sorted(): ModelDefinition[] {
  return getAllModels().sort(
    (a, b) => a.estimatedTimeSeconds - b.estimatedTimeSeconds
  );
}
