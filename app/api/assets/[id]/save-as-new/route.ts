/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getAsset, saveAsset } from '@/services/assetStorage';
import { generateAssetId } from '@/services/assetId';
import type { Asset } from '@/types/asset';

/**
 * POST - Save edited asset as a new independent asset
 * Creates a new root asset (parentAssetId = null, version = 1) from the current edited version
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceAssetId } = await params;

    // Get the source asset (the edited version)
    const sourceAsset = await getAsset(sourceAssetId);

    if (!sourceAsset) {
      return NextResponse.json(
        { error: 'Source asset not found' },
        { status: 404 }
      );
    }

    // Generate new asset ID
    const newAssetId = generateAssetId(sourceAsset.name);

    // Read source image file
    const ASSETS_DIR = join(process.cwd(), 'public', 'assets');
    const sourceImagePath = join(ASSETS_DIR, `${sourceAssetId}.${sourceAsset.format}`);

    if (!existsSync(sourceImagePath)) {
      return NextResponse.json(
        { error: 'Source image file not found' },
        { status: 404 }
      );
    }

    const imageBuffer = await readFile(sourceImagePath);

    // Copy thumbnail file
    const sourceThumbnailPath = join(ASSETS_DIR, `${sourceAssetId}.thumb.${sourceAsset.format}`);
    const newThumbnailPath = join(ASSETS_DIR, `${newAssetId}.thumb.${sourceAsset.format}`);

    if (existsSync(sourceThumbnailPath)) {
      const thumbnailBuffer = await readFile(sourceThumbnailPath);
      await writeFile(newThumbnailPath, thumbnailBuffer);
    }

    // Create new asset metadata (fresh root asset)
    const newAsset: Asset = {
      ...sourceAsset,
      id: newAssetId,
      url: `/assets/${newAssetId}.${sourceAsset.format}`,
      thumbnailUrl: `/assets/${newAssetId}.thumb.${sourceAsset.format}`,

      // Reset lineage - this is now a new root asset
      parentAssetId: null,
      version: 1,
      editHistory: [],

      // Preserve generation context
      generationPrompt: sourceAsset.generationPrompt || '',
      provider: 'ai-edited',

      // Update timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save new asset to unified storage (writes image file and metadata)
    await saveAsset(newAsset, imageBuffer);

    return NextResponse.json(newAsset, { status: 201 });
  } catch (error) {
    console.error('Error saving asset as new:', error);
    return NextResponse.json(
      { error: 'Failed to save asset as new' },
      { status: 500 }
    );
  }
}
