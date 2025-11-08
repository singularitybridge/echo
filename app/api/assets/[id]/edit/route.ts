/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { Asset, EditAssetRequest } from '@/types/asset';
import { editImage } from '@/services/imageService';
import { getAsset, saveAsset } from '@/services/assetStorage';
import { generateAssetId } from '@/services/assetId';
import {
  generateThumbnail,
  getImageDimensions,
} from '@/services/thumbnailGenerator';

/**
 * POST - Edit an asset using AI image generation
 * Creates a new version of the asset with immutable versioning
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params;
    const body = (await request.json()) as EditAssetRequest;
    const { editPrompt, model } = body;

    if (!editPrompt || !editPrompt.trim()) {
      return NextResponse.json(
        { error: 'Edit prompt is required' },
        { status: 400 }
      );
    }

    // Get the original asset using unified storage
    const originalAsset = await getAsset(assetId);

    if (!originalAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Generate edited image using AI
    console.log('Editing asset:', originalAsset.id, 'with prompt:', editPrompt);

    // Construct full URL to the asset image
    const baseImageUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3039'}${originalAsset.url}`;
    console.log('Using base image URL:', baseImageUrl);

    const editedImage = await editImage({
      baseImageUrl,
      originalDescription: originalAsset.description || originalAsset.generationPrompt || originalAsset.name,
      editPrompt: editPrompt.trim(),
      aspectRatio: originalAsset.aspectRatio,
      model, // Pass through the model parameter
    });

    // Convert blob to buffer
    const imageBuffer = Buffer.from(await editedImage.blob.arrayBuffer());

    // Get image dimensions
    const { width, height } = await getImageDimensions(imageBuffer);

    // Generate thumbnail
    const thumbnailBuffer = await generateThumbnail(imageBuffer);

    // Generate new asset ID for the edited version
    const newAssetId = generateAssetId(`${originalAsset.name}_edited`);

    // Create new asset (immutable versioning)
    const newAsset: Asset = {
      id: newAssetId,
      url: `/assets/${newAssetId}.${originalAsset.format}`,
      thumbnailUrl: `/assets/${newAssetId}.thumb.${originalAsset.format}`,

      type: originalAsset.type,
      category: originalAsset.category,

      name: originalAsset.name,
      description: originalAsset.description,

      provider: originalAsset.provider,
      generationPrompt: originalAsset.generationPrompt,

      projectId: originalAsset.projectId,
      tags: originalAsset.tags,

      relatedAssets: originalAsset.relatedAssets,
      usedInScenes: originalAsset.usedInScenes,

      version: originalAsset.version + 1,
      parentAssetId: originalAsset.id,
      editHistory: [
        ...originalAsset.editHistory,
        {
          timestamp: new Date(),
          editPrompt: editPrompt.trim(),
          previousAssetId: originalAsset.id,
        },
      ],

      format: originalAsset.format,
      aspectRatio: originalAsset.aspectRatio,
      width,
      height,
      fileSize: imageBuffer.length,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save new asset (image + metadata)
    await saveAsset(newAsset, imageBuffer);

    // Save thumbnail
    const thumbnailPath = join(
      process.cwd(),
      'public',
      'assets',
      `${newAssetId}.thumb.${originalAsset.format}`
    );
    await writeFile(thumbnailPath, thumbnailBuffer);

    return NextResponse.json(newAsset, { status: 201 });
  } catch (error) {
    console.error('Error editing asset:', error);
    return NextResponse.json(
      { error: 'Failed to edit asset' },
      { status: 500 }
    );
  }
}
