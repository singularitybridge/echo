/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Asset,
  AssetLibraryQuery,
  AssetLibraryResponse,
  AssetGenerationRequest,
  AssetGenerationBatch,
  AssetEditRequest,
  AssetUploadMetadata,
} from '../types/asset';

/**
 * Client-side service for asset storage operations
 * Communicates with API routes for asset CRUD and generation
 */
class AssetStorageServer {
  /**
   * Create a new asset
   */
  async createAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    const response = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asset),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create asset');
    }

    return response.json();
  }

  /**
   * Get all assets for a project with optional filtering/sorting
   */
  async getAssets(query: AssetLibraryQuery): Promise<AssetLibraryResponse> {
    const params = new URLSearchParams({ projectId: query.projectId });

    if (query.filters) {
      if (query.filters.type) params.append('type', query.filters.type);
      if (query.filters.category) params.append('category', query.filters.category);
      if (query.filters.provider) params.append('provider', query.filters.provider);
      if (query.filters.search) params.append('search', query.filters.search);
      if (query.filters.usedInScene) params.append('usedInScene', query.filters.usedInScene);
      if (query.filters.tags) {
        query.filters.tags.forEach(tag => params.append('tags', tag));
      }
    }

    if (query.sort) {
      params.append('sortBy', query.sort.sortBy);
      params.append('order', query.sort.order);
    }

    if (query.pagination) {
      if (query.pagination.page) params.append('page', query.pagination.page.toString());
      if (query.pagination.pageSize) params.append('pageSize', query.pagination.pageSize.toString());
    }

    const response = await fetch(`/api/assets?${params}`);

    if (!response.ok) {
      throw new Error('Failed to get assets');
    }

    return response.json();
  }

  /**
   * Get a single asset by ID
   */
  async getAsset(assetId: string): Promise<Asset> {
    const response = await fetch(`/api/assets/${assetId}`);

    if (!response.ok) {
      throw new Error('Failed to get asset');
    }

    return response.json();
  }

  /**
   * Update asset metadata
   */
  async updateAsset(assetId: string, updates: Partial<Asset>): Promise<Asset> {
    const response = await fetch(`/api/assets/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update asset');
    }

    return response.json();
  }

  /**
   * Delete an asset
   */
  async deleteAsset(assetId: string): Promise<void> {
    const response = await fetch(`/api/assets/${assetId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete asset');
    }
  }

  /**
   * Generate multiple asset variations (multi-select workflow)
   */
  async generateAssets(request: AssetGenerationRequest): Promise<AssetGenerationBatch> {
    const response = await fetch('/api/assets/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate assets');
    }

    return response.json();
  }

  /**
   * Save selected assets from a generation batch
   */
  async saveGeneratedAssets(batchId: string, selectedAssetIds: string[]): Promise<Asset[]> {
    const response = await fetch(`/api/assets/generate/${batchId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds: selectedAssetIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save generated assets');
    }

    return response.json();
  }

  /**
   * Edit an existing asset with AI
   */
  async editAsset(request: AssetEditRequest): Promise<Asset> {
    const response = await fetch(`/api/assets/${request.assetId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to edit asset');
    }

    return response.json();
  }

  /**
   * Upload an asset image
   */
  async uploadAsset(file: File, metadata: AssetUploadMetadata): Promise<Asset> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await fetch('/api/assets/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload asset');
    }

    return response.json();
  }

  /**
   * Get assets used in a specific scene
   */
  async getSceneAssets(sceneId: string): Promise<Asset[]> {
    const response = await fetch(`/api/scenes/${sceneId}/assets`);

    if (!response.ok) {
      throw new Error('Failed to get scene assets');
    }

    return response.json();
  }

  /**
   * Attach assets to a scene
   */
  async attachAssetsToScene(
    sceneId: string,
    assetIds: string[],
    roles: Array<{ assetId: string; role: 'character' | 'background' | 'prop'; order: number }>
  ): Promise<void> {
    const response = await fetch(`/api/scenes/${sceneId}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds, roles }),
    });

    if (!response.ok) {
      throw new Error('Failed to attach assets to scene');
    }
  }

  /**
   * Remove an asset from a scene
   */
  async removeAssetFromScene(sceneId: string, assetId: string): Promise<void> {
    const response = await fetch(`/api/scenes/${sceneId}/assets/${assetId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to remove asset from scene');
    }
  }

  /**
   * Save asset blob to server
   */
  async saveAssetImage(
    projectId: string,
    assetId: string,
    type: string,
    blob: Blob,
    fileExt: string = 'png'
  ): Promise<string> {
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('assetId', assetId);
    formData.append('type', type);
    formData.append('image', blob, `${assetId}.${fileExt}`);

    const response = await fetch('/api/assets/save-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to save asset image');
    }

    const data = await response.json();
    return data.url;
  }
}

export const assetStorage = new AssetStorageServer();
