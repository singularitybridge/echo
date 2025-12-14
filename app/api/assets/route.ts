/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import type {
  Asset,
  AssetLibraryResponse,
  AssetFilters,
  CreateAssetRequest,
} from '@/types/asset';
import { AspectRatio } from '@/types';
import { generateAssetId } from '@/services/assetId';
import {
  saveAsset,
  listAssets,
  getAsset,
} from '@/services/assetStorage';
import {
  generateThumbnail,
  getImageDimensions,
} from '@/services/thumbnailGenerator';
import { generateImage } from '@/services/imageService';

// App Router configuration
export const maxDuration = 300; // 5 minutes for image generation
export const dynamic = 'force-dynamic';

/**
 * Sort assets based on query parameters
 */
function sortAssets(
  assets: Asset[],
  sortBy: string = 'createdAt',
  order: string = 'desc'
): Asset[] {
  const sorted = [...assets];

  sorted.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortBy) {
      case 'createdAt':
      case 'updatedAt':
        aVal = new Date(a[sortBy]).getTime();
        bVal = new Date(b[sortBy]).getTime();
        break;
      case 'name':
      case 'type':
        aVal = a[sortBy];
        bVal = b[sortBy];
        break;
      case 'usedCount':
        aVal = a.usedInScenes.length;
        bVal = b.usedInScenes.length;
        break;
      default:
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
    }

    if (order === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return sorted;
}

/**
 * GET - List assets for a project
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Parse filters
    const filters: AssetFilters = {
      projectId,
      type: searchParams.get('type') as any,
      tags: searchParams.getAll('tags'),
      // Hide intermediate AI-generated versions (only show root assets)
      parentAssetId: null,
    };

    // Load assets using the new storage service
    const assets = await listAssets(filters);

    // Parse sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    // Sort
    const sorted = sortAssets(assets, sortBy, order);

    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginated = sorted.slice(startIndex, endIndex);

    // Calculate summary
    const summary = {
      totalAssets: assets.length,
      byType: assets.reduce((acc, asset) => {
        acc[asset.type] = (acc[asset.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byProvider: assets.reduce((acc, asset) => {
        acc[asset.provider] = (acc[asset.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    const response: AssetLibraryResponse = {
      assets: paginated,
      pagination: {
        page,
        pageSize,
        total: sorted.length,
      },
      summary,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting assets:', error);
    return NextResponse.json(
      { error: 'Failed to get assets' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new asset
 */
export async function POST(request: NextRequest) {
  try {
    let body: CreateAssetRequest;

    try {
      // Read the entire body as text first to handle large payloads
      const textBody = await request.text();

      // Check size (50MB limit)
      const sizeInMB = textBody.length / (1024 * 1024);
      if (sizeInMB > 50) {
        return NextResponse.json(
          { error: `Request body too large: ${sizeInMB.toFixed(2)}MB (max 50MB)` },
          { status: 413 }
        );
      }

      // Parse JSON manually
      body = JSON.parse(textBody) as CreateAssetRequest;
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body. The request may be too large or malformed.' },
        { status: 400 }
      );
    }

    if (!body.projectId || !body.type || !body.name) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, type, name' },
        { status: 400 }
      );
    }

    let imageBuffer: Buffer;
    let format: 'png' | 'jpg' | 'webp' = 'png';

    // Generate or download image
    // Check imageUrl OR url first to avoid re-generating already saved images
    // (AssetLibrary passes 'url', while other callers pass 'imageUrl')
    const providedUrl = body.imageUrl || (body as any).url;
    if (providedUrl) {
      // Check if this is already a saved project asset
      const projectAssetPattern = /^\/assets\/([^/]+)\/([^/]+)\/(asset-[^.]+)\.(\w+)$/;
      const match = providedUrl.match(projectAssetPattern);

      if (match) {
        // This is already a saved project asset, use it directly
        const [, urlProjectId, urlType, existingAssetId, urlFormat] = match;

        console.log('✅ Using already-saved project asset:', {
          assetId: existingAssetId,
          projectId: urlProjectId,
          type: urlType,
          format: urlFormat,
          url: providedUrl
        });

        // Read the existing image file to get dimensions
        const { readFile, mkdir } = await import('fs/promises');
        const imagePath = join(process.cwd(), 'public', providedUrl);
        imageBuffer = await readFile(imagePath);
        format = urlFormat as 'png' | 'jpg' | 'webp';

        // Get image dimensions
        const { width, height } = await getImageDimensions(imageBuffer);

        // Generate thumbnail
        const thumbnailBuffer = await generateThumbnail(imageBuffer);

        // Create asset metadata using the existing asset ID and FLAT URL structure
        // (saveAsset expects flat URLs like /assets/asset-ID.ext)
        const asset: Asset = {
          id: existingAssetId,
          url: `/assets/${existingAssetId}.${format}`,
          thumbnailUrl: `/assets/${existingAssetId}.thumb.${format}`,

          type: body.type,
          category: body.type + 's',

          name: body.name,
          description: body.description || '',

          provider: body.provider || 'upload',
          generationPrompt: body.generationPrompt,

          projectId: body.projectId,
          tags: body.tags || [],

          relatedAssets: [],
          usedInScenes: [],

          version: 1,
          parentAssetId: null,
          editHistory: [],

          format,
          aspectRatio: body.aspectRatio || AspectRatio.PORTRAIT,
          width,
          height,
          fileSize: imageBuffer.length,

          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Use saveAsset to save both image and metadata
        // This will write the image to the flat location (/public/assets/)
        // The image already exists in project structure, but saveAsset will create
        // a duplicate in flat structure - this is OK for backward compatibility
        await saveAsset(asset, imageBuffer);

        // Save thumbnail to flat location
        const thumbnailPath = join(process.cwd(), 'public', 'assets', `${existingAssetId}.thumb.${format}`);
        const { writeFile } = await import('fs/promises');
        await writeFile(thumbnailPath, thumbnailBuffer);

        console.log('✅ Asset saved with existing ID:', existingAssetId);
        return NextResponse.json(asset, { status: 201 });
      } else {
        // Not a saved project asset, check if it's a story storage URL
        // Pattern: /api/stories/{projectId}/assets/{type}/{filename}
        const storyStoragePattern = /^\/api\/stories\/([^/]+)\/assets\/([^/]+)\/([^/]+)$/;
        const storyMatch = providedUrl.match(storyStoragePattern);

        if (storyMatch) {
          // Read directly from story storage filesystem
          const [, storyProjectId, assetType, filename] = storyMatch;
          const filePath = join(process.cwd(), 'stories', storyProjectId, 'assets', assetType, filename);

          console.log('Reading from story storage for asset:', body.name, filePath);

          const { readFile } = await import('fs/promises');
          const { existsSync } = await import('fs');

          if (!existsSync(filePath)) {
            throw new Error(`Story storage file not found: ${filePath}`);
          }

          imageBuffer = await readFile(filePath);

          // Detect format from filename
          if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
            format = 'jpg';
          } else if (filename.endsWith('.webp')) {
            format = 'webp';
          }
        } else {
          // Download from external URL
          console.log('Downloading image from URL for asset:', body.name);

          // Convert relative URLs to absolute URLs for server-side fetch
          let imageUrl = providedUrl;
          if (imageUrl.startsWith('/')) {
            const protocol = request.headers.get('x-forwarded-proto') || 'http';
            const host = request.headers.get('host') || 'localhost:3039';
            imageUrl = `${protocol}://${host}${imageUrl}`;
          }

          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to download image from ${imageUrl}`);
          }

          imageBuffer = Buffer.from(await response.arrayBuffer());

          // Detect format from URL
          if (providedUrl.endsWith('.jpg') || providedUrl.endsWith('.jpeg')) {
            format = 'jpg';
          } else if (providedUrl.endsWith('.webp')) {
            format = 'webp';
          }
        }
      }
    } else if (body.imageBase64) {
      // Upload from base64
      console.log('Uploading image from base64 for asset:', body.name);

      const base64Data = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');

      // Detect format from base64 prefix
      if (body.imageBase64.includes('image/jpeg') || body.imageBase64.includes('image/jpg')) {
        format = 'jpg';
      } else if (body.imageBase64.includes('image/webp')) {
        format = 'webp';
      }
    } else if (body.generationPrompt && body.provider) {
      // Generate new image using AI
      console.log('Generating image for asset:', body.name);

      const result = await generateImage({
        prompt: body.generationPrompt,
        aspectRatio: body.aspectRatio || '9:16',
      });

      imageBuffer = Buffer.from(await result.blob.arrayBuffer());
      format = 'png';
    } else {
      return NextResponse.json(
        { error: 'Must provide generationPrompt, imageBase64, or imageUrl' },
        { status: 400 }
      );
    }

    // Get image dimensions
    const { width, height } = await getImageDimensions(imageBuffer);

    // Generate thumbnail
    const thumbnailBuffer = await generateThumbnail(imageBuffer);

    // Generate asset ID
    const assetId = generateAssetId(body.name);

    // Create asset metadata
    const asset: Asset = {
      id: assetId,
      url: `/assets/${assetId}.${format}`,
      thumbnailUrl: `/assets/${assetId}.thumb.${format}`,

      type: body.type,
      category: body.type + 's', // e.g., "character" -> "characters"

      name: body.name,
      description: body.description || '',

      provider: body.provider || 'upload',
      generationPrompt: body.generationPrompt,

      projectId: body.projectId,
      tags: body.tags || [],

      relatedAssets: [],
      usedInScenes: [],

      version: 1,
      parentAssetId: null,
      editHistory: [],

      format,
      aspectRatio: body.aspectRatio || AspectRatio.PORTRAIT,
      width,
      height,
      fileSize: imageBuffer.length,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save asset (image + metadata)
    await saveAsset(asset, imageBuffer);

    // Save thumbnail
    const thumbnailPath = join(process.cwd(), 'public', 'assets', `${assetId}.thumb.${format}`);
    const { writeFile } = await import('fs/promises');
    await writeFile(thumbnailPath, thumbnailBuffer);

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Error creating asset:', error);
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    );
  }
}
