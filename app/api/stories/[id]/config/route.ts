/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { storyStorage } from '../../../../../services/storyStorage';

/**
 * PUT /api/stories/[id]/config - Update story config
 *
 * Request body:
 * {
 *   aspectRatio?: AspectRatio;
 *   defaultModel?: VeoModel;
 *   defaultResolution?: Resolution;
 *   characterReferences?: string[];
 *   generationSettings?: { temperature?: number; guidanceScale?: number };
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await request.json();

    await storyStorage.updateConfig(id, updates);

    return NextResponse.json({
      success: true,
      storyId: id,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const { id } = await params;
    console.error(`Error updating config for story ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update config' },
      { status: 500 }
    );
  }
}
