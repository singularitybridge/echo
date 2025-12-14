/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { AssetType, Asset } from '@/types/asset';
import { AspectRatio } from '@/types';
import { generateAssetId } from '@/services/assetId';
import { saveAsset } from '@/services/assetStorage';
import { generateThumbnail, getImageDimensions } from '@/services/thumbnailGenerator';

/**
 * POST - Upload an external image file as an asset
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const type = formData.get('type') as AssetType;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    if (!file || !projectId || !type || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: file, projectId, type, name' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Get image buffer
    const imageBuffer = Buffer.from(await file.arrayBuffer());

    // Detect format from file extension
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    let format: 'png' | 'jpg' | 'webp' = 'png';
    if (extension === 'jpg' || extension === 'jpeg') {
      format = 'jpg';
    } else if (extension === 'webp') {
      format = 'webp';
    }

    // Get image dimensions
    const { width, height } = await getImageDimensions(imageBuffer);

    // Generate thumbnail
    const thumbnailBuffer = await generateThumbnail(imageBuffer);

    // Generate asset ID
    const assetId = generateAssetId(name);

    // Create asset metadata
    const newAsset: Asset = {
      id: assetId,
      url: `/assets/${assetId}.${format}`,
      thumbnailUrl: `/assets/${assetId}.thumb.${format}`,

      type,
      category: type + 's', // e.g., "character" -> "characters"

      name,
      description: description || '',

      provider: 'upload',
      generationPrompt: '',

      projectId,
      tags: [],

      relatedAssets: [],
      usedInScenes: [],

      version: 1,
      parentAssetId: null,
      editHistory: [],

      format,
      aspectRatio: width > height ? AspectRatio.LANDSCAPE : AspectRatio.PORTRAIT, // Auto-detect from dimensions
      width,
      height,
      fileSize: imageBuffer.length,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save asset (image + metadata) using unified storage system
    await saveAsset(newAsset, imageBuffer);

    // Save thumbnail
    const thumbnailPath = join(process.cwd(), 'public', 'assets', `${assetId}.thumb.${format}`);
    await writeFile(thumbnailPath, thumbnailBuffer);

    return NextResponse.json(newAsset, { status: 201 });
  } catch (error) {
    console.error('Error uploading asset:', error);
    return NextResponse.json(
      { error: 'Failed to upload asset' },
      { status: 500 }
    );
  }
}
