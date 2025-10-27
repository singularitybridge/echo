/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { storyStorage } from '../../../../../services/storyStorage';

/**
 * PUT /api/stories/[id]/metadata - Update story metadata
 *
 * Request body (partial update):
 * {
 *   title?: string,
 *   description?: string,
 *   status?: 'draft' | 'in-progress' | 'completed' | 'published',
 *   tags?: string[],
 *   character?: string
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    await storyStorage.updateMetadata(params.id, body);

    return NextResponse.json({
      success: true,
      storyId: params.id,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Error updating metadata for story ${params.id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update metadata' },
      { status: 500 }
    );
  }
}
