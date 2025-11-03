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
   * Load character references from new story storage
   * Checks stories/{projectId}/assets/characters/ directory
   */
  static async loadStoryStorageCharacterRefs(
    projectId: string
  ): Promise<AssetReference[]> {
    const refs: AssetReference[] = [];

    try {
      // Try to fetch assets from story storage API
      const response = await fetch(`/api/stories/${projectId}/assets?type=character`);
      if (response.ok) {
        const data = await response.json();
        const characterAssets = data.assets?.characters || [];

        // Convert to AssetReference format with API URL
        for (let i = 0; i < characterAssets.length; i++) {
          const assetPath = characterAssets[i];
          // Story storage returns relative paths like "assets/characters/file.png"
          // Extract filename from path
          const filename = assetPath.split('/').pop();
          // Convert to API URL: /api/stories/{projectId}/assets/characters/{filename}
          const apiUrl = `/api/stories/${projectId}/assets/characters/${filename}`;

          // Extract asset ID from filename if it contains one
          // Filename format: character-ref-{assetId}.png
          let assetId = `story-ref-${i + 1}`; // Default fallback
          if (filename) {
            const match = filename.match(/character-ref-(.+)\.png$/);
            if (match && match[1]) {
              assetId = match[1]; // Extract the asset ID part
            }
          }

          refs.push({
            objectUrl: apiUrl,
            id: assetId,
          });
        }
      }
    } catch (error) {
      // Story storage not available or no assets
    }

    return refs;
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
      .filter(asset => asset.url) // Only include assets with valid URLs
      .map(asset => ({
        objectUrl: asset.url,
        id: asset.id,
        aspectRatio: asset.aspectRatio,
      }));
  }

  /**
   * Load all available references for a project (unified approach)
   * Checks story storage first, then database assets, then legacy static files
   */
  static async loadAllReferences(
    projectId: string,
    aspectRatio: '9:16' | '16:9' = '9:16'
  ): Promise<AssetReference[]> {
    // Load from all sources
    const [storyRefs, dbAssets, legacyRefs] = await Promise.all([
      this.loadStoryStorageCharacterRefs(projectId),
      this.loadProjectAssets(projectId),
      this.loadLegacyCharacterRefs(projectId, aspectRatio),
    ]);

    // Prioritize story storage, then database assets, then legacy
    if (storyRefs.length > 0) {
      return storyRefs;
    }

    // Convert database assets to AssetReference format
    const assetRefs = this.assetsToAssetReferences(dbAssets);
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

  /**
   * Sync legacy character refs to asset database
   * This ensures legacy refs show up in the asset library
   */
  static async syncLegacyRefsToDatabase(
    projectId: string,
    aspectRatio: '9:16' | '16:9' = '9:16'
  ): Promise<{ synced: number; skipped: number }> {
    let synced = 0;
    let skipped = 0;

    try {
      // Load legacy refs and existing database assets
      const [legacyRefs, existingAssets] = await Promise.all([
        this.loadLegacyCharacterRefs(projectId, aspectRatio),
        this.loadProjectAssets(projectId),
      ]);

      if (legacyRefs.length === 0) {
        return { synced: 0, skipped: 0 };
      }

      // Check which refs are already in database by checking tags
      const hasLegacyTag = existingAssets.some(a => a.tags.includes('legacy-ref'));
      if (hasLegacyTag) {
        // Already synced, skip all
        return { synced: 0, skipped: legacyRefs.length };
      }

      for (const ref of legacyRefs) {
        try {
          // Create asset entry for legacy ref
          // Use imageUrl to download and save the image
          const response = await fetch('/api/assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              type: 'character',
              name: `Character Reference ${ref.id.replace('legacy-ref-', '')}`,
              description: `Legacy character reference imported from /generated-refs`,
              aspectRatio: ref.aspectRatio || aspectRatio,
              imageUrl: ref.objectUrl, // API will download this URL
              tags: ['legacy-ref', 'character'],
            }),
          });

          if (response.ok) {
            synced++;
          } else {
            const error = await response.json();
            console.error(`Failed to sync legacy ref ${ref.id}:`, error);
          }
        } catch (error) {
          console.error(`Failed to sync legacy ref ${ref.id}:`, error);
        }
      }

      console.log(`Synced ${synced} legacy refs to database (${skipped} already existed)`);
    } catch (error) {
      console.error('Failed to sync legacy refs:', error);
    }

    return { synced, skipped };
  }

  /**
   * Sync story storage assets to asset database
   * This ensures story storage assets show up in the asset library
   */
  static async syncStoryStorageToDatabase(
    projectId: string,
    aspectRatio: '9:16' | '16:9' = '9:16'
  ): Promise<{ synced: number; skipped: number }> {
    let synced = 0;
    let skipped = 0;

    try {
      // Load story storage refs and existing database assets
      const [storyRefs, existingAssets] = await Promise.all([
        this.loadStoryStorageCharacterRefs(projectId),
        this.loadProjectAssets(projectId),
      ]);

      if (storyRefs.length === 0) {
        return { synced: 0, skipped: 0 };
      }

      // Check which specific refs are already synced by matching filenames in descriptions
      for (let i = 0; i < storyRefs.length; i++) {
        const ref = storyRefs[i];

        try {
          // Extract filename from asset path
          const filename = ref.objectUrl.split('/').pop() || '';

          // Check if this specific file is already synced
          const alreadySynced = existingAssets.some(
            a => a.tags.includes('story-storage') && a.description.includes(filename)
          );

          if (alreadySynced) {
            skipped++;
            continue;
          }

          // Create asset entry for story storage ref
          // Use imageUrl to download and save the image
          const response = await fetch('/api/assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              type: 'character',
              name: `Character ${i + 1}`,
              description: `Character reference from story storage: ${filename}`,
              aspectRatio,
              imageUrl: ref.objectUrl, // API will download this URL
              tags: ['story-storage', 'character'],
            }),
          });

          if (response.ok) {
            synced++;
          } else {
            const error = await response.json();
            console.error(`Failed to sync story storage ref ${ref.id}:`, error);
          }
        } catch (error) {
          console.error(`Failed to sync story storage ref ${ref.id}:`, error);
        }
      }

      console.log(`Synced ${synced} story storage refs to database (${skipped} already existed)`);
    } catch (error) {
      console.error('Failed to sync story storage refs:', error);
    }

    return { synced, skipped };
  }
}
