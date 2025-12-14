/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { storyStorage } from '../../../../services/storyStorage';

/**
 * GET /api/stories/[id] - Get story by ID
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

    return NextResponse.json(story);
  } catch (error) {
    const { id } = await params;
    console.error(`Error getting story ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get story' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/stories/[id] - Update story (script, config, or metadata)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if story exists
    const existingStory = await storyStorage.getStory(id);
    if (!existingStory) {
      return NextResponse.json(
        { error: 'Story not found' },
        { status: 404 }
      );
    }

    // Update script if provided
    if (body.script) {
      await storyStorage.updateScript(id, body.script);
    }

    // Update config if provided
    if (body.config) {
      await storyStorage.updateConfig(id, body.config);
    }

    // Update metadata if provided
    if (body.metadata) {
      await storyStorage.updateMetadata(id, body.metadata);
    }

    // Get updated story
    const updatedStory = await storyStorage.getStory(id);

    return NextResponse.json({
      success: true,
      story: updatedStory,
    });
  } catch (error) {
    const { id } = await params;
    console.error(`Error updating story ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update story' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stories/[id] - Delete story
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await storyStorage.deleteStory(id);

    return NextResponse.json(result);
  } catch (error) {
    const { id } = await params;
    console.error(`Error deleting story ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete story' },
      { status: 500 }
    );
  }
}
