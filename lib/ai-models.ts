/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ModelDefinition,
  ImageEditingModel,
  GenerationModelDefinition,
  ImageGenerationModel,
  VideoGenerationModelDefinition,
  VideoGenerationModel
} from '@/types/ai-models';

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
  'seededit-v4': {
    id: 'seededit-v4',
    name: 'SeedEdit v4',
    provider: 'ByteDance',
    endpoint: 'fal-ai/bytedance/seedream/v4/edit',
    icon: 'palette',
    speed: 'medium',
    tags: ['content-preservation'],
    description:
      'Latest version with enhanced instruction following and content preservation. Improved quality and fidelity in image editing.',
    useCases: [
      'High-quality edits with precise content preservation',
      'Advanced style transfers maintaining structure',
      'Complex modifications respecting composition',
    ],
    estimatedTimeSeconds: 4.0,
    colorAccent: 'violet',
  },
  'nano-banana-pro': {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    provider: 'fal.ai',
    endpoint: 'fal-ai/nano-banana-pro/edit',
    icon: 'zap',
    speed: 'fast',
    tags: ['creative', 'local-edits'],
    description:
      'Fast and efficient image editing with strong natural language understanding. Great for quick iterations and creative edits.',
    useCases: [
      'Quick creative edits and iterations',
      'Natural language-guided modifications',
      'Efficient image transformations',
    ],
    estimatedTimeSeconds: 3.0,
    colorAccent: 'yellow',
  },
};

/**
 * Comprehensive model definitions for all supported AI image generation models
 */
export const GENERATION_MODEL_DEFINITIONS: Record<ImageGenerationModel, GenerationModelDefinition> = {
  'ideogram-v2': {
    id: 'ideogram-v2',
    name: 'Ideogram v2',
    provider: 'Ideogram AI',
    endpoint: 'fal-ai/ideogram/v2',
    icon: 'type',
    speed: 'fast',
    tags: ['text-precision'],
    description:
      'State-of-the-art text rendering in images. Excels at creating images with clear, readable text and typography.',
    useCases: [
      'Posters and marketing materials with text',
      'Logos and branding assets',
      'Images requiring precise text integration',
    ],
    estimatedTimeSeconds: 3.0,
    colorAccent: 'blue',
  },
  'flux-pro-ultra': {
    id: 'flux-pro-ultra',
    name: 'FLUX Pro Ultra',
    provider: 'Black Forest Labs',
    endpoint: 'fal-ai/flux-pro/v1.1-ultra',
    icon: 'sparkles',
    speed: 'slow',
    tags: ['creative'],
    description:
      'Ultra-high quality image generation with exceptional detail and realism. Best-in-class for professional creative work.',
    useCases: [
      'High-resolution marketing assets',
      'Professional photography-style images',
      'Detailed character artwork and portraits',
    ],
    estimatedTimeSeconds: 8.0,
    colorAccent: 'purple',
  },
  'recraft-v3': {
    id: 'recraft-v3',
    name: 'Recraft v3',
    provider: 'Recraft AI',
    endpoint: 'fal-ai/recraft/v3/text-to-image',
    icon: 'palette',
    speed: 'medium',
    tags: ['creative', 'text-precision'],
    description:
      'Balanced model with strong text rendering and creative flexibility. Great for design-focused applications.',
    useCases: [
      'Graphic design and illustrations',
      'Brand assets with text and imagery',
      'Creative concept visualization',
    ],
    estimatedTimeSeconds: 4.5,
    colorAccent: 'pink',
  },
  'imagen4-ultra': {
    id: 'imagen4-ultra',
    name: 'Imagen 4 Ultra',
    provider: 'Google',
    endpoint: 'fal-ai/imagen4/preview/ultra',
    icon: 'sparkles',
    speed: 'medium',
    tags: ['creative'],
    description:
      'Google\'s latest image generation model with enhanced photorealism and creative control.',
    useCases: [
      'Photorealistic imagery',
      'Concept art and visualization',
      'High-quality creative content',
    ],
    estimatedTimeSeconds: 5.0,
    colorAccent: 'indigo',
  },
  'flux-dev': {
    id: 'flux-dev',
    name: 'FLUX Dev',
    provider: 'Black Forest Labs',
    endpoint: 'fal-ai/flux/dev',
    icon: 'zap',
    speed: 'fast',
    tags: ['creative'],
    description:
      'Developer-focused FLUX model optimized for rapid iteration and experimentation.',
    useCases: [
      'Quick prototyping and testing',
      'Rapid iteration workflows',
      'Development and experimentation',
    ],
    estimatedTimeSeconds: 2.5,
    colorAccent: 'cyan',
  },
  'hidream-i1': {
    id: 'hidream-i1',
    name: 'HiDream i1',
    provider: 'HiDream AI',
    endpoint: 'fal-ai/hidream-i1-full',
    icon: 'image',
    speed: 'medium',
    tags: ['creative'],
    description:
      'High-fidelity image generation with strong prompt following and aesthetic quality.',
    useCases: [
      'Creative artwork and illustrations',
      'Aesthetic visual content',
      'Detailed prompt interpretation',
    ],
    estimatedTimeSeconds: 4.0,
    colorAccent: 'orange',
  },
  'nano-banana-pro': {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    provider: 'fal.ai',
    endpoint: 'fal-ai/nano-banana-pro',
    icon: 'zap',
    speed: 'fast',
    tags: ['creative'],
    description:
      'Fast and efficient image generation with strong natural language understanding. Great for quick iterations and creative generation.',
    useCases: [
      'Quick creative generation and iterations',
      'Natural language-guided image creation',
      'Efficient image generation workflows',
    ],
    estimatedTimeSeconds: 3.0,
    colorAccent: 'yellow',
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

/**
 * Get generation model definition by ID
 */
export function getGenerationModelDefinition(
  modelId: ImageGenerationModel
): GenerationModelDefinition {
  return GENERATION_MODEL_DEFINITIONS[modelId];
}

/**
 * Get all available generation models
 */
export function getAllGenerationModels(): GenerationModelDefinition[] {
  return Object.values(GENERATION_MODEL_DEFINITIONS);
}

/**
 * Get generation models filtered by speed
 */
export function getGenerationModelsBySpeed(speed: 'fast' | 'medium' | 'slow'): GenerationModelDefinition[] {
  return getAllGenerationModels().filter((model) => model.speed === speed);
}

/**
 * Get generation models sorted by estimated generation time
 */
export function getGenerationModelsBySpeed_sorted(): GenerationModelDefinition[] {
  return getAllGenerationModels().sort(
    (a, b) => a.estimatedTimeSeconds - b.estimatedTimeSeconds
  );
}

/**
 * Comprehensive model definitions for all supported AI video generation models
 */
export const VIDEO_GENERATION_MODEL_DEFINITIONS: Record<VideoGenerationModel, VideoGenerationModelDefinition> = {
  'veo-3.1': {
    id: 'veo-3.1',
    name: 'Veo 3.1',
    provider: 'Google',
    icon: 'film',
    speed: 'slow',
    description:
      'Google\'s state-of-the-art video generation model with exceptional quality and character consistency.',
    useCases: [
      'High-quality cinematic videos',
      'Character-consistent storytelling',
      'Professional video content',
    ],
    estimatedTimeSeconds: 120, // ~2 minutes
    colorAccent: 'indigo',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 8,
  },
  'wan-2.5-i2v': {
    id: 'wan-2.5-i2v',
    name: 'Wan 2.5 I2V',
    provider: 'Wantai Technology (via fal.ai)',
    icon: 'video',
    speed: 'fast',
    description:
      'Fast image-to-video generation with good motion quality. Optimized for rapid iteration and experimentation.',
    useCases: [
      'Quick video prototyping',
      'Image animation',
      'Rapid iteration workflows',
    ],
    estimatedTimeSeconds: 30, // ~30 seconds
    colorAccent: 'cyan',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 5,
  },
  'kling-v2.5-turbo-pro': {
    id: 'kling-v2.5-turbo-pro',
    name: 'Kling v2.5 Turbo Pro',
    provider: 'Kuaishou (via fal.ai)',
    icon: 'video',
    speed: 'medium',
    description:
      'High-quality video generation with balanced speed and quality. Excellent for creating dynamic, cinematic videos with strong motion.',
    useCases: [
      'Dynamic video content',
      'Cinematic motion sequences',
      'Balanced quality/speed workflows',
    ],
    estimatedTimeSeconds: 60, // ~1 minute
    colorAccent: 'purple',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 5,
  },
  'sora-turbo': {
    id: 'sora-turbo',
    name: 'Sora Turbo',
    provider: 'OpenAI',
    icon: 'film',
    speed: 'fast',
    description:
      'OpenAI\'s fast video generation model with strong text-to-video and image-to-video capabilities. Optimized for quick turnaround.',
    useCases: [
      'Quick video generation from text',
      'Image-to-video animation',
      'Rapid prototyping and iteration',
    ],
    estimatedTimeSeconds: 45, // ~45 seconds
    colorAccent: 'green',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 5,
  },
};

/**
 * Get video generation model definition by ID
 */
export function getVideoGenerationModelDefinition(
  modelId: VideoGenerationModel
): VideoGenerationModelDefinition {
  return VIDEO_GENERATION_MODEL_DEFINITIONS[modelId];
}

/**
 * Get all available video generation models
 */
export function getAllVideoGenerationModels(): VideoGenerationModelDefinition[] {
  return Object.values(VIDEO_GENERATION_MODEL_DEFINITIONS);
}

/**
 * Get video generation models filtered by speed
 */
export function getVideoGenerationModelsBySpeed(speed: 'fast' | 'medium' | 'slow'): VideoGenerationModelDefinition[] {
  return getAllVideoGenerationModels().filter((model) => model.speed === speed);
}

/**
 * Get video generation models sorted by estimated generation time
 */
export function getVideoGenerationModelsBySpeed_sorted(): VideoGenerationModelDefinition[] {
  return getAllVideoGenerationModels().sort(
    (a, b) => a.estimatedTimeSeconds - b.estimatedTimeSeconds
  );
}
