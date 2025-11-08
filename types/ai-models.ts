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
 * Model metadata and capabilities
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
