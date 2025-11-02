/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getAsset, updateAsset, deleteAsset } from '@/services/assetStorage';

/**
 * GET - Get a single asset by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params;

    const asset = await getAsset(assetId);

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Error getting asset:', error);
    return NextResponse.json(
      { error: 'Failed to get asset' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update asset metadata and optionally replace image
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params;
    const updates = await request.json();

    const asset = await getAsset(assetId);

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // If imageBase64 is provided, replace the image file
    if (updates.imageBase64) {
      const { writeFile } = await import('fs/promises');
      const { generateThumbnail } = await import('@/services/thumbnailGenerator');

      // Decode base64 image
      const base64Data = updates.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Write new image file (keeping original filename)
      const ASSETS_DIR = join(process.cwd(), 'public', 'assets');
      const imagePath = join(ASSETS_DIR, `${assetId}.${asset.format}`);
      await writeFile(imagePath, imageBuffer);

      // Generate and save new thumbnail
      const thumbnailBuffer = await generateThumbnail(imageBuffer);
      const thumbnailPath = join(ASSETS_DIR, `${assetId}.thumb.${asset.format}`);
      await writeFile(thumbnailPath, thumbnailBuffer);

      // Update file size
      updates.fileSize = imageBuffer.length;

      // Remove imageBase64 from updates (don't store in metadata)
      delete updates.imageBase64;
    }

    // Update asset with new data
    const updatedAsset = await updateAsset(assetId, {
      ...updates,
      updatedAt: new Date(),
    });

    return NextResponse.json(updatedAsset);
  } catch (error) {
    console.error('Error updating asset:', error);
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete an asset
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params;

    const asset = await getAsset(assetId);

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Delete image file if it exists
    const ASSETS_DIR = join(process.cwd(), 'public', 'assets');
    const imagePath = join(ASSETS_DIR, `${assetId}.${asset.format}`);

    if (existsSync(imagePath)) {
      await unlink(imagePath);
    }

    // Delete thumbnail if it exists
    const thumbnailPath = join(ASSETS_DIR, `${assetId}.thumb.${asset.format}`);
    if (existsSync(thumbnailPath)) {
      await unlink(thumbnailPath);
    }

    // Remove from metadata using unified storage
    await deleteAsset(assetId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    );
  }
}
