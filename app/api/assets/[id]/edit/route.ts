/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Asset } from '@/types/asset';
import { editImage } from '@/services/imageService';

const ASSETS_DIR = join(process.cwd(), 'public', 'assets');
const ASSETS_METADATA_DIR = join(process.cwd(), 'data', 'assets');

/**
 * Get the path to the assets metadata file for a project
 */
function getMetadataPath(projectId: string): string {
  return join(ASSETS_METADATA_DIR, `${projectId}.json`);
}

/**
 * Load assets metadata for a project
 */
async function loadAssets(projectId: string): Promise<Asset[]> {
  const metadataPath = getMetadataPath(projectId);

  if (!existsSync(metadataPath)) {
    return [];
  }

  const data = await readFile(metadataPath, 'utf-8');
  return JSON.parse(data);
}

/**
 * Save assets metadata for a project
 */
async function saveAssets(projectId: string, assets: Asset[]): Promise<void> {
  const metadataPath = getMetadataPath(projectId);

  // Ensure metadata directory exists
  if (!existsSync(ASSETS_METADATA_DIR)) {
    await mkdir(ASSETS_METADATA_DIR, { recursive: true });
  }

  await writeFile(metadataPath, JSON.stringify(assets, null, 2), 'utf-8');
}

/**
 * POST - Edit an asset using AI image generation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params;
    const body = await request.json();
    const { editPrompt } = body;

    if (!editPrompt || !editPrompt.trim()) {
      return NextResponse.json(
        { error: 'Edit prompt is required' },
        { status: 400 }
      );
    }

    // Find the asset across all projects
    let asset: Asset | null = null;
    let projectAssets: Asset[] = [];
    let projectId = '';

    // Search through all project metadata files
    if (existsSync(ASSETS_METADATA_DIR)) {
      const metadataFiles = await readdir(ASSETS_METADATA_DIR);

      for (const filename of metadataFiles.filter(f => f.endsWith('.json'))) {
        const pid = filename.replace('.json', '');
        const assets = await loadAssets(pid);
        const found = assets.find(a => a.id === assetId);

        if (found) {
          asset = found;
          projectAssets = assets;
          projectId = pid;
          break;
        }
      }
    }

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Generate edited image using AI
    console.log('Editing asset:', asset.id, 'with prompt:', editPrompt);

    // Construct full URL to the asset image
    const baseImageUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3039'}${asset.imageUrl}`;
    console.log('Using base image URL:', baseImageUrl);

    const editedImage = await editImage({
      baseImageUrl,  // Pass the actual image to edit
      originalDescription: asset.description || asset.generationPrompt || asset.name,
      editPrompt: editPrompt.trim(),
      aspectRatio: asset.aspectRatio === '16:9' ? '16:9' : '9:16',
    });

    // Save the edited image
    const assetDir = join(ASSETS_DIR, projectId, asset.type);
    if (!existsSync(assetDir)) {
      await mkdir(assetDir, { recursive: true });
    }

    // Generate new filename for edited version
    const timestamp = Date.now();
    const editedAssetId = `${asset.id}-edit-${timestamp}`;
    const extension = 'png';
    const imagePath = join(assetDir, `${editedAssetId}.${extension}`);

    // Convert blob to buffer and save
    const imageBuffer = Buffer.from(await editedImage.blob.arrayBuffer());
    await writeFile(imagePath, imageBuffer);

    // Generate URL
    const imageUrl = `/assets/${projectId}/${asset.type}/${editedAssetId}.${extension}`;

    // Update asset metadata
    const updatedAsset: Asset = {
      ...asset,
      imageUrl,
      thumbnailUrl: imageUrl,
      editHistory: [
        ...(asset.editHistory || []),
        {
          timestamp: new Date(),
          prompt: editPrompt.trim(),
          previousImageUrl: asset.imageUrl,
        },
      ],
      updatedAt: new Date(),
    };

    // Update in project assets array
    const assetIndex = projectAssets.findIndex(a => a.id === assetId);
    if (assetIndex !== -1) {
      projectAssets[assetIndex] = updatedAsset;
      await saveAssets(projectId, projectAssets);
    }

    return NextResponse.json({
      ...updatedAsset,
      imageUrl, // Return the new image URL
    });
  } catch (error) {
    console.error('Error editing asset:', error);
    return NextResponse.json(
      { error: 'Failed to edit asset' },
      { status: 500 }
    );
  }
}
