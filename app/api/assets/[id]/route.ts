/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { unlink, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getAsset, updateAsset, deleteAsset } from '@/services/assetStorage';
import type { Project } from '@/types/project';

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

    // If this is a story-storage asset, track it as deleted to prevent re-import
    if (asset.tags.includes('story-storage')) {
      try {
        // Extract filename from description (format: "Character reference from story storage: filename.png")
        const match = asset.description.match(/story storage: (.+)$/);
        if (match && match[1]) {
          const filename = match[1];

          // Try story storage first (most projects are here)
          const STORY_SCRIPT_PATH = join(process.cwd(), 'stories', asset.projectId, 'script.json');

          if (existsSync(STORY_SCRIPT_PATH)) {
            // Project is in story storage
            const scriptContent = await readFile(STORY_SCRIPT_PATH, 'utf-8');
            const script = JSON.parse(scriptContent);

            const deletedAssets = script.deletedStoryStorageAssets || [];
            if (!deletedAssets.includes(filename)) {
              deletedAssets.push(filename);
              script.deletedStoryStorageAssets = deletedAssets;

              // Save updated script
              await writeFile(STORY_SCRIPT_PATH, JSON.stringify(script, null, 2), 'utf-8');
              console.log(`✅ Tracked deleted story storage asset in story storage: ${filename}`);
            }
          } else {
            // Try legacy projects database
            const DB_PATH = join(process.cwd(), 'data', 'projects.db.json');

            if (existsSync(DB_PATH)) {
              const dbContent = await readFile(DB_PATH, 'utf-8');
              const db = JSON.parse(dbContent);

              const project = db.projects[asset.projectId] as Project;
              if (project) {
                const deletedAssets = project.deletedStoryStorageAssets || [];
                if (!deletedAssets.includes(filename)) {
                  deletedAssets.push(filename);
                  project.deletedStoryStorageAssets = deletedAssets;

                  // Save updated database
                  await writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
                  console.log(`✅ Tracked deleted story storage asset in projects.db: ${filename}`);
                }
              }
            }
          }
        }
      } catch (error) {
        // Don't fail the deletion if tracking fails
        console.error('❌ Failed to track deleted story storage asset:', error);
      }
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
