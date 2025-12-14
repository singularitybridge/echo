import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string; filename: string }> }
) {
  try {
    const { id, type, filename } = await params;

    // Validate type
    const validTypes = ['characters', 'props', 'locations', 'effects', 'storyboards'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Construct file path
    const filePath = join(process.cwd(), 'stories', id, 'assets', type, filename);

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Read file
    const buffer = await readFile(filePath);

    // Determine content type based on file extension
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentType = ext === 'png' ? 'image/png' :
                        ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                        ext === 'webp' ? 'image/webp' :
                        'application/octet-stream';

    // Return file with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    const { id } = await params;
    console.error(`Error serving asset for story ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to serve asset' },
      { status: 500 }
    );
  }
}
