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
