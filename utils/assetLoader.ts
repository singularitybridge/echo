/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Asset } from '@/types/asset';
import { assetStorage } from '@/services/assetStorage.server';

/**
 * Lightweight reference to an image asset
 * Contains just the URL and metadata, not the full blob data
 */
export interface AssetReference {
  objectUrl: string;
  id: string;
  aspectRatio?: string;
}

/**
 * Unified asset loading system
 * This replaces the fragmented loading logic scattered across components
 */
export class AssetLoader {
  /**
   * Load all assets for a project (from database)
   */
  static async loadProjectAssets(projectId: string): Promise<Asset[]> {
    try {
      const response = await assetStorage.getAssets({
        projectId,
        pagination: { page: 1, pageSize: 100 },
      });
      return response.assets || [];
    } catch (error) {
      console.warn('Failed to load project assets, returning empty array:', error);
      return [];
    }
  }

  /**
   * Load legacy character references (from static files)
   * This maintains backward compatibility with the old system
   */
  static async loadLegacyCharacterRefs(
    projectId: string,
    aspectRatio: '9:16' | '16:9' = '9:16'
  ): Promise<AssetReference[]> {
    const refs: AssetReference[] = [];
    const maxRefs = 10;
    const prefix = aspectRatio === '9:16' ? 'character-ref-portrait-' : 'character-ref-';

    for (let i = 1; i <= maxRefs; i++) {
      const refPath = `/generated-refs/${projectId}/${prefix}${i}.png`;

      try {
        const response = await fetch(refPath, { method: 'HEAD' });
        if (response.ok) {
          refs.push({
            objectUrl: refPath,
            id: `legacy-ref-${i}`,
            aspectRatio,
          });
        }
      } catch (error) {
        // File doesn't exist, stop checking
        break;
      }
    }

    return refs;
  }

  /**
   * Convert database assets to AssetReference format for UI components
   */
  static assetsToAssetReferences(assets: Asset[]): AssetReference[] {
    return assets
      .filter(asset => asset.imageUrl) // Only include assets with valid URLs
      .map(asset => ({
        objectUrl: asset.imageUrl,
        id: asset.id,
        aspectRatio: asset.aspectRatio,
      }));
  }

  /**
   * Load all available references for a project (unified approach)
   * Combines database assets with legacy static files
   */
  static async loadAllReferences(
    projectId: string,
    aspectRatio: '9:16' | '16:9' = '9:16'
  ): Promise<AssetReference[]> {
    // Load from both sources
    const [dbAssets, legacyRefs] = await Promise.all([
      this.loadProjectAssets(projectId),
      this.loadLegacyCharacterRefs(projectId, aspectRatio),
    ]);

    // Convert database assets to AssetReference format
    const assetRefs = this.assetsToAssetReferences(dbAssets);

    // Prioritize database assets, fallback to legacy
    return assetRefs.length > 0 ? assetRefs : legacyRefs;
  }

  /**
   * Load assets attached to a specific scene
   */
  static async loadSceneAssets(
    projectId: string,
    attachedAssetIds: string[]
  ): Promise<AssetReference[]> {
    if (!attachedAssetIds || attachedAssetIds.length === 0) {
      return [];
    }

    try {
      // Load all project assets
      const allAssets = await this.loadProjectAssets(projectId);

      // Filter to only attached assets
      const sceneAssets = allAssets.filter(asset =>
        attachedAssetIds.includes(asset.id)
      );

      return this.assetsToAssetReferences(sceneAssets);
    } catch (error) {
      console.error('Failed to load scene assets:', error);
      return [];
    }
  }
}
