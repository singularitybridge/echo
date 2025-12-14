/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const FRAMES_DIR = join(process.cwd(), 'public', 'frames');

// Ensure frames directory exists
async function ensureFramesDir(projectId: string) {
  const projectFramesDir = join(FRAMES_DIR, projectId);
  if (!existsSync(projectFramesDir)) {
    await mkdir(projectFramesDir, { recursive: true });
  }
  return projectFramesDir;
}

// POST - Save frame image
export async function POST(request: NextRequest) {
  try {
    const { projectId, sceneId, frameType, dataUrl } = await request.json();

    if (!projectId || !sceneId || !frameType || !dataUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['first', 'last'].includes(frameType)) {
      return NextResponse.json(
        { error: 'frameType must be "first" or "last"' },
        { status: 400 }
      );
    }

    // Extract base64 data from data URL
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: 'Invalid data URL format' },
        { status: 400 }
      );
    }

    const [, extension, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');

    // Save to public/frames/{projectId}/{sceneId}-{frameType}.{ext}
    const framesDir = await ensureFramesDir(projectId);
    const filename = `${sceneId}-${frameType}.${extension}`;
    const filepath = join(framesDir, filename);

    await writeFile(filepath, buffer);

    // Return public URL
    const publicUrl = `/frames/${projectId}/${filename}`;
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Error saving frame:', error);
    return NextResponse.json(
      { error: 'Failed to save frame' },
      { status: 500 }
    );
  }
}

// GET - Get frame image (returns file or 404)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const sceneId = searchParams.get('sceneId');
    const frameType = searchParams.get('frameType');

    if (!projectId || !sceneId || !frameType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Try different image extensions
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    const framesDir = join(FRAMES_DIR, projectId);

    for (const ext of extensions) {
      const filename = `${sceneId}-${frameType}.${ext}`;
      const filepath = join(framesDir, filename);

      if (existsSync(filepath)) {
        const publicUrl = `/frames/${projectId}/${filename}`;
        return NextResponse.json({ url: publicUrl });
      }
    }

    return NextResponse.json(
      { error: 'Frame not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error getting frame:', error);
    return NextResponse.json(
      { error: 'Failed to get frame' },
      { status: 500 }
    );
  }
}

// DELETE - Delete frame image
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const sceneId = searchParams.get('sceneId');
    const frameType = searchParams.get('frameType');

    if (!projectId || !sceneId || !frameType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Try to delete file with any extension
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    const framesDir = join(FRAMES_DIR, projectId);
    let deleted = false;

    for (const ext of extensions) {
      const filename = `${sceneId}-${frameType}.${ext}`;
      const filepath = join(framesDir, filename);

      if (existsSync(filepath)) {
        await unlink(filepath);
        deleted = true;
      }
    }

    if (!deleted) {
      return NextResponse.json(
        { error: 'Frame not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting frame:', error);
    return NextResponse.json(
      { error: 'Failed to delete frame' },
      { status: 500 }
    );
  }
}
