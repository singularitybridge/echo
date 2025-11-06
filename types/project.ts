/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { VideoEvaluation } from '../services/evaluationService';
import { VeoModel, AspectRatio, Resolution } from '../types';
import { GenerationMetadata } from './story-creation';

export type ProjectType = 'movie' | 'short' | 'commercial';

export interface GenerationSettings {
  model: VeoModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  isLooping: boolean;
}

export interface SceneAssetAttachment {
  assetId: string;
  role: 'character' | 'background' | 'prop'; // Role of asset in the scene
  order: number; // Display/reference order (0-based)
}

export interface Scene {
  id: string;
  title: string;
  duration: number;
  prompt: string;
  cameraAngle: string;
  voiceover?: string;

  // Asset attachments
  attachedAssets?: SceneAssetAttachment[]; // Assets used in this scene

  // Rendering data
  generated: boolean;
  videoUrl?: string;
  videoBlob?: Blob;
  settings?: GenerationSettings;
  firstFrameDataUrl?: string; // First frame of video - used for thumbnails
  lastFrameDataUrl?: string; // For shot continuity - used as start frame for next scene
  referenceMode?: 'previous' | number; // 'previous' = use previous shot, number = use specific ref (1-based)

  // Evaluation data
  evaluation?: VideoEvaluation;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  type: ProjectType;
  character?: string;

  // Project-level generation settings
  aspectRatio: AspectRatio; // Applied to all scenes in project
  defaultModel: VeoModel; // Default for new scenes
  defaultResolution: Resolution; // Default for new scenes

  createdAt: number;
  updatedAt: number;
  scenes: Scene[];

  // Generation metadata (optional, for AI-generated stories)
  generationMetadata?: GenerationMetadata;

  // Track story storage assets that have been explicitly deleted by user
  // Stores filenames (e.g., "character-ref-design-1762267856949.png")
  // to prevent auto-sync from re-importing them
  deletedStoryStorageAssets?: string[];
}
