/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { storyStorage } from '../../../../../services/storyStorage';

/**
 * PUT /api/stories/[id]/script - Update story script
 *
 * This is the primary endpoint for AI agents to edit scripts.
 *
 * Request body:
 * {
 *   scenes: Scene[]
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (!body.scenes || !Array.isArray(body.scenes)) {
      return NextResponse.json(
        { error: 'Missing required field: scenes (array)' },
        { status: 400 }
      );
    }

    const changesSummary = await storyStorage.updateScript(params.id, {
      scenes: body.scenes,
    });

    return NextResponse.json({
      success: true,
      storyId: params.id,
      updatedAt: new Date().toISOString(),
      changesSummary,
    });
  } catch (error) {
    console.error(`Error updating script for story ${params.id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update script' },
      { status: 500 }
    );
  }
}
