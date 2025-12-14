/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { storyStorage } from '../../../../../services/storyStorage';

/**
 * GET /api/stories/[id]/assets - List story assets
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const assets = await storyStorage.getAssets(id);

    return NextResponse.json({
      storyId: id,
      assets,
    });
  } catch (error) {
    const { id } = await params;
    console.error(`Error getting assets for story ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get assets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stories/[id]/assets - Upload asset to story
 *
 * Request body:
 * {
 *   type: 'character' | 'prop' | 'location' | 'effect',
 *   filename: string,
 *   imageBase64: string  // data:image/png;base64,...
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.type || !body.filename || !body.imageBase64) {
      return NextResponse.json(
        { error: 'Missing required fields: type, filename, imageBase64' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['character', 'prop', 'location', 'effect', 'storyboard'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Convert base64 to buffer
    const base64Data = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    console.log(`[ASSET UPLOAD DEBUG] Story ID: ${id}, Type: ${body.type}, Filename: ${body.filename}`);
    console.log(`[ASSET UPLOAD DEBUG] Base64 length: ${base64Data.length}, Buffer size: ${buffer.length} bytes`);

    const assetPath = await storyStorage.saveAsset(
      id,
      body.type,
      body.filename,
      buffer
    );

    // Return the API URL for serving the asset (not the static file path)
    const apiUrl = `/api/stories/${id}/assets/${body.type}s/${body.filename}`;

    return NextResponse.json({
      success: true,
      storyId: id,
      assetUrl: apiUrl,
      url: apiUrl, // API URL for fetching the asset
      assetPath: `stories/${id}/assets/${body.type}s/${body.filename}`,
    });
  } catch (error) {
    const { id } = await params;
    console.error(`Error uploading asset to story ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload asset' },
      { status: 500 }
    );
  }
}
