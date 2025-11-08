/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const ASSETS_DIR = join(process.cwd(), 'public', 'assets');

/**
 * POST - Save an asset image blob to the file system
 *
 * @deprecated This endpoint is deprecated. Use POST /api/assets with imageBase64 instead.
 * This endpoint uses the old project-based folder structure and will be removed in a future version.
 */
export async function POST(request: NextRequest) {
  console.warn('[DEPRECATED] /api/assets/save-image endpoint is deprecated. Use POST /api/assets with imageBase64 instead.');

  try {
    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const assetId = formData.get('assetId') as string;
    const type = formData.get('type') as string;
    const image = formData.get('image') as Blob;

    if (!projectId || !assetId || !type || !image) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, assetId, type, image' },
        { status: 400 }
      );
    }

    // Create directory structure: /public/assets/{projectId}/{type}/
    const assetDir = join(ASSETS_DIR, projectId, type);
    if (!existsSync(assetDir)) {
      await mkdir(assetDir, { recursive: true });
    }

    // Detect file extension from the uploaded file name
    const fileName = (image as File).name || `${assetId}.png`;
    const fileExt = fileName.split('.').pop() || 'png';

    // Save image file
    const imagePath = join(assetDir, `${assetId}.${fileExt}`);
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    await writeFile(imagePath, imageBuffer);

    // Return URL to the saved image (relative to public directory)
    const imageUrl = `/assets/${projectId}/${type}/${assetId}.${fileExt}`;

    return NextResponse.json({
      url: imageUrl,
      imageUrl: imageUrl,
      thumbnailUrl: imageUrl // Use same URL for thumbnail for now
    });
  } catch (error) {
    console.error('Error saving asset image:', error);
    return NextResponse.json(
      { error: 'Failed to save asset image' },
      { status: 500 }
    );
  }
}
