/**
 * Asset Storage Service
 * Manages asset metadata and file storage
 */

import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
  Asset,
  AssetMetadata,
  AssetFilters,
  AssetVersionHistory,
} from '@/types/asset';

const METADATA_PATH = join(process.cwd(), 'data', 'assets-metadata.json');
const ASSETS_DIR = join(process.cwd(), 'public', 'assets');

/**
 * Initialize empty metadata structure
 */
function createEmptyMetadata(): AssetMetadata {
  return {
    assets: {},
    index: {
      byProject: {},
      byType: {},
      byTag: {},
    },
  };
}

/**
 * Load asset metadata from disk
 */
async function loadMetadata(): Promise<AssetMetadata> {
  try {
    if (!existsSync(METADATA_PATH)) {
      const emptyMetadata = createEmptyMetadata();
      await saveMetadata(emptyMetadata);
      return emptyMetadata;
    }

    const data = await readFile(METADATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading asset metadata:', error);
    return createEmptyMetadata();
  }
}

/**
 * Save asset metadata to disk
 */
async function saveMetadata(metadata: AssetMetadata): Promise<void> {
  try {
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    await writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving asset metadata:', error);
    throw error;
  }
}

/**
 * Update indexes when adding an asset
 */
function addToIndexes(metadata: AssetMetadata, asset: Asset): void {
  // Project index
  if (!metadata.index.byProject[asset.projectId]) {
    metadata.index.byProject[asset.projectId] = [];
  }
  if (!metadata.index.byProject[asset.projectId].includes(asset.id)) {
    metadata.index.byProject[asset.projectId].push(asset.id);
  }

  // Type index
  if (!metadata.index.byType[asset.type]) {
    metadata.index.byType[asset.type] = [];
  }
  if (!metadata.index.byType[asset.type].includes(asset.id)) {
    metadata.index.byType[asset.type].push(asset.id);
  }

  // Tag index
  asset.tags.forEach((tag) => {
    if (!metadata.index.byTag[tag]) {
      metadata.index.byTag[tag] = [];
    }
    if (!metadata.index.byTag[tag].includes(asset.id)) {
      metadata.index.byTag[tag].push(asset.id);
    }
  });
}

/**
 * Update indexes when removing an asset
 */
function removeFromIndexes(metadata: AssetMetadata, asset: Asset): void {
  // Project index
  if (metadata.index.byProject[asset.projectId]) {
    metadata.index.byProject[asset.projectId] = metadata.index.byProject[
      asset.projectId
    ].filter((id) => id !== asset.id);
  }

  // Type index
  if (metadata.index.byType[asset.type]) {
    metadata.index.byType[asset.type] = metadata.index.byType[
      asset.type
    ].filter((id) => id !== asset.id);
  }

  // Tag index
  asset.tags.forEach((tag) => {
    if (metadata.index.byTag[tag]) {
      metadata.index.byTag[tag] = metadata.index.byTag[tag].filter(
        (id) => id !== asset.id
      );
    }
  });
}

/**
 * Save asset to disk and metadata
 */
export async function saveAsset(
  asset: Asset,
  imageBuffer: Buffer
): Promise<Asset> {
  try {
    // Ensure assets directory exists
    if (!existsSync(ASSETS_DIR)) {
      await mkdir(ASSETS_DIR, { recursive: true });
    }

    // Save image file
    const filename = `${asset.id}.${asset.format}`;
    const imagePath = join(ASSETS_DIR, filename);
    await writeFile(imagePath, imageBuffer);

    // Update metadata
    const metadata = await loadMetadata();
    metadata.assets[asset.id] = asset;
    addToIndexes(metadata, asset);
    await saveMetadata(metadata);

    return asset;
  } catch (error) {
    console.error('Error saving asset:', error);
    throw error;
  }
}

/**
 * Get asset metadata by ID
 */
export async function getAsset(assetId: string): Promise<Asset | null> {
  try {
    const metadata = await loadMetadata();
    return metadata.assets[assetId] || null;
  } catch (error) {
    console.error('Error getting asset:', error);
    return null;
  }
}

/**
 * List assets with filters
 */
export async function listAssets(filters: AssetFilters): Promise<Asset[]> {
  try {
    const metadata = await loadMetadata();
    let assetIds: string[] = [];

    // Start with all assets
    assetIds = Object.keys(metadata.assets);

    // Apply project filter
    if (filters.projectId) {
      const projectAssets = metadata.index.byProject[filters.projectId] || [];
      assetIds = assetIds.filter((id) => projectAssets.includes(id));
    }

    // Apply type filter
    if (filters.type) {
      const typeAssets = metadata.index.byType[filters.type] || [];
      assetIds = assetIds.filter((id) => typeAssets.includes(id));
    }

    // Apply tags filter (match any tag)
    if (filters.tags && filters.tags.length > 0) {
      const taggedAssets = new Set<string>();
      filters.tags.forEach((tag) => {
        const assetsWithTag = metadata.index.byTag[tag] || [];
        assetsWithTag.forEach((id) => taggedAssets.add(id));
      });
      assetIds = assetIds.filter((id) => taggedAssets.has(id));
    }

    // Apply parentAssetId filter
    if (filters.parentAssetId !== undefined) {
      assetIds = assetIds.filter(
        (id) => metadata.assets[id].parentAssetId === filters.parentAssetId
      );
    }

    // Return asset objects
    return assetIds.map((id) => metadata.assets[id]);
  } catch (error) {
    console.error('Error listing assets:', error);
    return [];
  }
}

/**
 * Update asset metadata only (no file changes)
 */
export async function updateAsset(
  assetId: string,
  updates: Partial<Asset>
): Promise<Asset | null> {
  try {
    const metadata = await loadMetadata();
    const asset = metadata.assets[assetId];

    if (!asset) {
      return null;
    }

    // Remove from old indexes if changing indexed fields
    const oldAsset = { ...asset };
    removeFromIndexes(metadata, oldAsset);

    // Apply updates
    const updatedAsset = {
      ...asset,
      ...updates,
      updatedAt: new Date(),
    };

    // Update metadata
    metadata.assets[assetId] = updatedAsset;

    // Add to new indexes
    addToIndexes(metadata, updatedAsset);

    await saveMetadata(metadata);

    return updatedAsset;
  } catch (error) {
    console.error('Error updating asset:', error);
    return null;
  }
}

/**
 * Delete asset (file + metadata)
 */
export async function deleteAsset(assetId: string): Promise<boolean> {
  try {
    const metadata = await loadMetadata();
    const asset = metadata.assets[assetId];

    if (!asset) {
      return false;
    }

    // Delete image file
    const filename = `${assetId}.${asset.format}`;
    const imagePath = join(ASSETS_DIR, filename);
    if (existsSync(imagePath)) {
      await unlink(imagePath);
    }

    // Delete thumbnail if exists
    const thumbPath = join(ASSETS_DIR, `${assetId}.thumb.${asset.format}`);
    if (existsSync(thumbPath)) {
      await unlink(thumbPath);
    }

    // Remove from indexes
    removeFromIndexes(metadata, asset);

    // Remove from metadata
    delete metadata.assets[assetId];

    await saveMetadata(metadata);

    return true;
  } catch (error) {
    console.error('Error deleting asset:', error);
    return false;
  }
}

/**
 * Get asset version history
 */
export async function getVersionHistory(
  assetId: string
): Promise<AssetVersionHistory | null> {
  try {
    const metadata = await loadMetadata();
    const current = metadata.assets[assetId];

    if (!current) {
      return null;
    }

    // Get parent (previous version)
    const parent = current.parentAssetId
      ? metadata.assets[current.parentAssetId] || null
      : null;

    // Get children (assets that have this as parent)
    const children = Object.values(metadata.assets).filter(
      (asset) => asset.parentAssetId === assetId
    );

    // Build lineage (walk up the parent chain)
    const lineage: Asset[] = [current];
    let currentParentId = current.parentAssetId;

    while (currentParentId) {
      const parentAsset = metadata.assets[currentParentId];
      if (!parentAsset) break;

      lineage.unshift(parentAsset);
      currentParentId = parentAsset.parentAssetId;
    }

    return {
      current,
      parent,
      children,
      lineage,
    };
  } catch (error) {
    console.error('Error getting version history:', error);
    return null;
  }
}

/**
 * Get asset file path
 */
export function getAssetPath(assetId: string, format: string): string {
  return join(ASSETS_DIR, `${assetId}.${format}`);
}

/**
 * Get thumbnail file path
 */
export function getThumbnailPath(assetId: string, format: string): string {
  return join(ASSETS_DIR, `${assetId}.thumb.${format}`);
}
