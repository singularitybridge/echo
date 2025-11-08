/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supported AI image editing models
 */
export type ImageEditingModel =
  | 'gemini-flash'
  | 'flux-kontext'
  | 'qwen-edit'
  | 'seededit';

/**
 * Supported AI image generation models
 */
export type ImageGenerationModel =
  | 'ideogram-v2'
  | 'flux-pro-ultra'
  | 'recraft-v3'
  | 'bria-v3'
  | 'imagen4-ultra'
  | 'flux-dev'
  | 'hidream-i1';

/**
 * Supported AI video generation models
 */
export type VideoGenerationModel =
  | 'veo-3.1'
  | 'wan-2.5-i2v';

/**
 * Model speed classification
 */
export type ModelSpeed = 'fast' | 'medium' | 'slow';

/**
 * Model capability tags
 */
export type ModelTag =
  | 'multi-image'
  | 'local-edits'
  | 'text-precision'
  | 'content-preservation'
  | 'creative'
  | 'context-aware';

/**
 * Model metadata and capabilities for editing
 */
export interface ModelDefinition {
  id: ImageEditingModel;
  name: string;
  provider: string;
  endpoint: string;
  icon: 'zap' | 'target' | 'type' | 'palette';
  speed: ModelSpeed;
  tags: ModelTag[];
  description: string;
  useCases: string[];
  estimatedTimeSeconds: number;
  colorAccent: string; // Tailwind color class for visual identification
}

/**
 * Model metadata and capabilities for generation
 */
export interface GenerationModelDefinition {
  id: ImageGenerationModel;
  name: string;
  provider: string;
  endpoint: string;
  icon: 'zap' | 'target' | 'type' | 'palette' | 'sparkles' | 'image';
  speed: ModelSpeed;
  tags: ModelTag[];
  description: string;
  useCases: string[];
  estimatedTimeSeconds: number;
  colorAccent: string; // Tailwind color class for visual identification
}

/**
 * Model generation request
 */
export interface ModelEditRequest {
  model: ImageEditingModel;
  prompt: string;
  imageDataUrl: string;
  aspectRatio?: string;
}

/**
 * Model generation result
 */
export interface ModelEditResult {
  model: ImageEditingModel;
  imageUrl?: string;
  imageBytes?: string;
  mimeType?: string;
  loading: boolean;
  error?: string;
  generationTime?: number;
}

/**
 * Multi-model edit request
 */
export interface MultiModelEditRequest {
  models: ImageEditingModel[];
  prompt: string;
  imageDataUrl: string;
  aspectRatio?: string;
}

/**
 * Multi-model edit response
 */
export interface MultiModelEditResponse {
  results: ModelEditResult[];
}

/**
 * Model generation request
 */
export interface ModelGenerationRequest {
  model: ImageGenerationModel;
  prompt: string;
  aspectRatio?: string;
  numImages?: number;
}

/**
 * Model generation result
 */
export interface ModelGenerationResult {
  model: ImageGenerationModel;
  imageUrl?: string;
  imageBytes?: string;
  mimeType?: string;
  loading: boolean;
  error?: string;
  generationTime?: number;
}

/**
 * Multi-model generation request
 */
export interface MultiModelGenerationRequest {
  models: ImageGenerationModel[];
  prompt: string;
  aspectRatio?: string;
  numImages?: number;
}

/**
 * Multi-model generation response
 */
export interface MultiModelGenerationResponse {
  results: ModelGenerationResult[];
}

/**
 * Video generation model metadata and capabilities
 */
export interface VideoGenerationModelDefinition {
  id: VideoGenerationModel;
  name: string;
  provider: string;
  icon: 'zap' | 'target' | 'film' | 'video';
  speed: ModelSpeed;
  description: string;
  useCases: string[];
  estimatedTimeSeconds: number;
  colorAccent: string;
  supportedAspectRatios: string[]; // e.g., ['16:9', '9:16', '1:1']
  maxDuration: number; // Max video duration in seconds
}

/**
 * Video generation result from a specific model
 */
export interface VideoGenerationResult {
  model: VideoGenerationModel;
  videoUrl?: string; // Blob URL or server URL
  videoBytes?: string; // Base64 encoded video data
  mimeType?: string;
  blob?: Blob; // Video blob
  loading: boolean;
  error?: string;
  generationTime?: number;
  thumbnailDataUrl?: string; // First frame thumbnail
}

/**
 * Multi-model video generation request
 */
export interface MultiModelVideoGenerationRequest {
  models: VideoGenerationModel[];
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  referenceImages?: Array<{base64: string; mimeType: string}>;
  startFrameDataUrl?: string;
}

/**
 * Multi-model video generation response
 */
export interface MultiModelVideoGenerationResponse {
  results: VideoGenerationResult[];
}
