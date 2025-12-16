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
    const body = await request.json();

    // Get the source asset (the edited version or original)
    // If sourceAssetId is a temp ID, it won't exist in storage
    // In that case, we'll use the imageBase64 from request
    let sourceAsset = await getAsset(sourceAssetId);

    if (!sourceAsset) {
      // If no source asset found (e.g., temp ID), we need imageBase64
      if (!body.imageBase64 || !body.metadata) {
        return NextResponse.json(
          { error: 'Source asset not found and no image data provided' },
          { status: 404 }
        );
      }

      // Use metadata from request
      sourceAsset = body.metadata;
    }

    // Generate new asset ID
    const newAssetId = generateAssetId(sourceAsset.name);

    let imageBuffer: Buffer;

    // Check if imageBase64 was provided in request body (for temp assets)
    if (body.imageBase64) {
      // Decode base64 image
      const base64Data = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // Read from existing file
      const ASSETS_DIR = join(process.cwd(), 'public', 'assets');
      const sourceImagePath = join(ASSETS_DIR, `${sourceAssetId}.${sourceAsset.format}`);

      if (!existsSync(sourceImagePath)) {
        return NextResponse.json(
          { error: 'Source image file not found' },
          { status: 404 }
        );
      }

      imageBuffer = await readFile(sourceImagePath);
    }

    // Get the edit prompt used to create this version
    // Check for editPrompt in request body first, then fall back to editHistory or generationPrompt
    let editPromptUsed = body.editPrompt || '';
    if (!editPromptUsed && sourceAsset.editHistory?.length > 0) {
      editPromptUsed = sourceAsset.editHistory[sourceAsset.editHistory.length - 1].editPrompt || '';
    }
    if (!editPromptUsed) {
      editPromptUsed = sourceAsset.generationPrompt || '';
    }

    // Create new asset metadata (fresh root asset)
    const newAsset: Asset = {
      ...sourceAsset,
      id: newAssetId,
      url: `/assets/${newAssetId}.${sourceAsset.format}`,
      thumbnailUrl: `/assets/${newAssetId}.thumb.${sourceAsset.format}`,
      fileSize: imageBuffer.length,

      // Reset lineage - this is now a new root asset
      parentAssetId: null,
      version: 1,
      editHistory: [],

      // Store the edit prompt that created this image for future reference
      generationPrompt: editPromptUsed,
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
