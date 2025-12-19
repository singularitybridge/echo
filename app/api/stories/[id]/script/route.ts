/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { storyStorage } from '../../../../../services/storyStorage';

/**
 * GET /api/stories/[id]/script - Get story script (scenes)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const story = await storyStorage.getStory(id);

    if (!story) {
      return NextResponse.json(
        { error: 'Story not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      scenes: story.script.scenes,
      deletedStoryStorageAssets: story.script.deletedStoryStorageAssets || [],
    });
  } catch (error) {
    const { id } = await params;
    console.error(`Error getting script for story ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get script' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/stories/[id]/script - Update story script
 *
 * This is the primary endpoint for AI agents to edit scripts.
 *
 * Request body:
 * {
 *   scenes: Scene[]
 *   deletedStoryStorageAssets?: string[]
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.scenes || !Array.isArray(body.scenes)) {
      return NextResponse.json(
        { error: 'Missing required field: scenes (array)' },
        { status: 400 }
      );
    }

    const changesSummary = await storyStorage.updateScript(id, {
      scenes: body.scenes,
      deletedStoryStorageAssets: body.deletedStoryStorageAssets || [],
    });

    return NextResponse.json({
      success: true,
      storyId: id,
      updatedAt: new Date().toISOString(),
      changesSummary,
    });
  } catch (error) {
    const { id } = await params;
    console.error(`Error updating script for story ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update script' },
      { status: 500 }
    );
  }
}
