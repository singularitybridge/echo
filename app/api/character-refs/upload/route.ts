/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { storyStorage } from '../../../../services/storyStorage';

/**
 * POST /api/character-refs/upload - Upload character reference or storyboard frame
 *
 * FormData:
 * - file: File (the image)
 * - projectId: string (story/project ID)
 * - sceneId?: string (scene ID for storyboard frames)
 * - index?: string (reference index)
 * - type?: 'character' | 'storyboard' (default: 'character')
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const sceneId = formData.get('sceneId') as string | null;
    const index = formData.get('index') as string | null;
    const type = (formData.get('type') as string) || 'character';

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'Missing required fields: file, projectId' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine filename based on type
    let filename: string;
    if (type === 'storyboard' && sceneId) {
      // Storyboard frame: storyboard-{sceneId}.png
      filename = `storyboard-${sceneId}.png`;
    } else {
      // Character reference: character-ref-{index}.png or use original filename
      filename = index ? `character-ref-${index}.png` : file.name;
    }

    // Determine asset type for storage
    const assetType = type === 'storyboard' ? 'storyboard' : 'character';

    console.log(`[CHARACTER-REFS UPLOAD] Project: ${projectId}, Type: ${assetType}, Filename: ${filename}`);

    // Save to story storage
    const assetPath = await storyStorage.saveAsset(
      projectId,
      assetType,
      filename,
      buffer
    );

    // Return the API URL for serving the asset
    const apiUrl = `/api/stories/${projectId}/assets/${assetType}s/${filename}`;

    return NextResponse.json({
      success: true,
      url: apiUrl,
      assetPath,
      projectId,
      filename,
      type: assetType,
    });
  } catch (error) {
    console.error('Error uploading character ref:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload reference' },
      { status: 500 }
    );
  }
}
