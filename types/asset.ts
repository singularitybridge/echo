/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AspectRatio } from '../types';

/**
 * Asset types for visual elements in the project
 */
export type AssetType = 'character' | 'prop' | 'location' | 'background' | 'upload' | 'scene';

/**
 * AI providers that can generate or edit assets
 */
export type AssetProvider = 'fal-ai' | 'fal' | 'gemini' | 'upload' | 'ai-edited';

/**
 * Image format options
 */
export type ImageFormat = 'png' | 'jpg' | 'webp';

/**
 * Asset generation/edit status
 */
export type AssetStatus = 'generating' | 'complete' | 'error' | 'processing';

/**
 * Role of asset when placed in a scene
 */
export type AssetRole = 'character' | 'background' | 'prop' | 'storyboard-frame';

/**
 * History entry for asset edits
 */
export interface AssetEditHistory {
  timestamp: Date;
  editPrompt: string;
  previousAssetId: string;
}

/**
 * Main asset entity
 */
export interface Asset {
  // Core identification
  id: string;
  url: string;
  thumbnailUrl: string;

  // Classification
  type: AssetType;
  category: string;

  // Content
  name: string;
  description: string;

  // Generation metadata
  provider: AssetProvider;
  generationPrompt?: string;

  // Organization
  projectId: string;
  tags: string[];

  // Relations
  relatedAssets: string[];
  usedInScenes: string[];

  // Versioning
  version: number;
  parentAssetId: string | null;
  editHistory: AssetEditHistory[];

  // Technical details
  format: ImageFormat;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  fileSize: number;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Scene-Asset relationship (many-to-many)
 */
export interface SceneAsset {
  sceneId: string;
  assetId: string;
  role: AssetRole;
  order: number; // Display order (0, 1, 2 for 3-slot system)
}

/**
 * Asset generation batch for multi-select workflow
 */
export interface AssetGenerationBatch {
  id: string;
  projectId: string;
  type: AssetType;
  prompt: string;
  aspectRatio: AspectRatio;
  provider: AssetProvider;
  model: string;
  count: number; // Number of variations to generate
  options: Asset[]; // Generated options
  selected: string[]; // IDs of selected assets to save
  status: AssetStatus;
  error?: string;
  createdAt: Date;
}

/**
 * Asset generation request
 */
export interface AssetGenerationRequest {
  projectId: string;
  type: AssetType;
  prompt: string;
  aspectRatio: AspectRatio;
  provider: AssetProvider;
  model?: string;
  count?: number; // How many variations (default: 3)
  category?: string;
  tags?: string[];
}

/**
 * Asset edit request
 */
export interface EditAssetRequest {
  editPrompt: string;
  model?: string;
}

/**
 * Asset upload metadata
 */
export interface AssetUploadMetadata {
  projectId: string;
  type: AssetType;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  aspectRatio: AspectRatio;
}

/**
 * Asset filter options for library view
 */
export interface AssetFilters {
  projectId?: string;
  type?: AssetType;
  category?: string;
  tags?: string[];
  provider?: AssetProvider;
  search?: string; // Search in name/description
  usedInScene?: string; // Filter by scene ID
  parentAssetId?: string | null; // Filter by parent asset (null = root assets only)
}

/**
 * Asset library sort options
 */
export type AssetSortBy = 'createdAt' | 'updatedAt' | 'name' | 'type' | 'usedCount';
export type AssetSortOrder = 'asc' | 'desc';

export interface AssetSortOptions {
  sortBy: AssetSortBy;
  order: AssetSortOrder;
}

/**
 * Asset library pagination
 */
export interface AssetPagination {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Complete asset library query
 */
export interface AssetLibraryQuery {
  projectId: string;
  filters?: AssetFilters;
  sort?: AssetSortOptions;
  pagination?: Partial<AssetPagination>;
}

/**
 * Asset library response
 */
export interface AssetLibraryResponse {
  assets: Asset[];
  pagination: AssetPagination;
  summary: {
    totalAssets: number;
    byType: Record<AssetType, number>;
    byProvider: Record<AssetProvider, number>;
  };
}

/**
 * Asset metadata structure (stored in JSON)
 */
export interface AssetMetadata {
  assets: {
    [assetId: string]: Asset;
  };
  index: {
    byProject: {
      [projectId: string]: string[];
    };
    byType: {
      [type: string]: string[];
    };
    byTag: {
      [tag: string]: string[];
    };
  };
}

/**
 * Asset creation request
 */
export interface CreateAssetRequest {
  // Required
  projectId: string;
  type: AssetType;
  name: string;

  // Generation (one of these)
  generationPrompt?: string;
  aspectRatio?: AspectRatio;
  provider?: AssetProvider;

  // OR Upload
  imageBase64?: string;
  imageUrl?: string;

  // Optional
  description?: string;
  tags?: string[];
}

/**
 * Asset version history response
 */
export interface AssetVersionHistory {
  current: Asset;
  parent: Asset | null;
  children: Asset[];
  lineage: Asset[];
}
