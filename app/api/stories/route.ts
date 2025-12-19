/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { storyStorage } from '../../../services/storyStorage';

/**
 * GET /api/stories - List all stories
 *
 * Query params:
 * - page: number (default: 1)
 * - pageSize: number (default: 20)
 * - status: 'draft' | 'in-progress' | 'completed' | 'published'
 * - type: 'short' | 'commercial' | 'long'
 * - tags: string (comma-separated)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const filters: any = {};
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('type')) {
      filters.type = searchParams.get('type');
    }
    if (searchParams.get('tags')) {
      filters.tags = searchParams.get('tags')!.split(',').map(t => t.trim());
    }

    const result = await storyStorage.listStories(filters, page, pageSize);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing stories:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list stories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stories - Create new story
 *
 * Request body:
 * {
 *   title: string,
 *   description: string,
 *   type: 'short' | 'commercial' | 'long',
 *   character?: string,
 *   script: { scenes: Scene[] },
 *   config: {
 *     aspectRatio: AspectRatio,
 *     defaultModel: VeoModel,
 *     defaultResolution: Resolution,
 *     characterReferences: string[]
 *   },
 *   tags?: string[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation
    if (!body.title || !body.description || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, type' },
        { status: 400 }
      );
    }

    if (!body.script || !body.script.scenes) {
      return NextResponse.json(
        { error: 'Missing required field: script with scenes' },
        { status: 400 }
      );
    }

    if (!body.config) {
      return NextResponse.json(
        { error: 'Missing required field: config' },
        { status: 400 }
      );
    }

    const story = await storyStorage.createStory({
      title: body.title,
      description: body.description,
      type: body.type,
      character: body.character,
      personaId: body.personaId, // Director persona for style
      script: body.script,
      config: body.config,
      tags: body.tags,
      generationMetadata: body.generationMetadata, // Include AI generation metadata
    });

    return NextResponse.json({
      success: true,
      story,
      paths: {
        root: `/stories/${story.metadata.id}`,
        metadata: `/stories/${story.metadata.id}/metadata.json`,
        script: `/stories/${story.metadata.id}/script.json`,
        config: `/stories/${story.metadata.id}/config.json`,
      },
    });
  } catch (error) {
    console.error('Error creating story:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create story' },
      { status: 500 }
    );
  }
}
