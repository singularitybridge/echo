/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {NextRequest, NextResponse} from 'next/server';
import {editStory} from '../../../../services/storyEditingService';
import {StoryDraft} from '../../../../types/story-creation';

/**
 * POST /api/story/edit
 * Story editing endpoint using Agent Hub story-editor agent
 *
 * Request body:
 * {
 *   storyDraft: StoryDraft,
 *   editRequest: string,
 *   currentShot?: { id, title, duration, prompt, cameraAngle, voiceover },
 *   referenceImageUrl?: string  // URL or base64 data URL of the reference image
 * }
 *
 * Response:
 * {
 *   updatedStory: StoryDraft,
 *   response: string,
 *   changesSummary: {
 *     scenesAdded: number,
 *     scenesRemoved: number,
 *     scenesModified: number,
 *     titleChanged: boolean
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Story Edit API] Request received');

    const {storyDraft, editRequest, currentShot, referenceImageUrl} = body;

    // Validate inputs
    if (!storyDraft || !storyDraft.projectMetadata || !storyDraft.scenes) {
      console.log('[Story Edit API] Validation failed - invalid story draft');
      return NextResponse.json(
        {error: 'Invalid or missing story draft'},
        {status: 400},
      );
    }

    if (!editRequest || typeof editRequest !== 'string' || editRequest.trim().length === 0) {
      console.log('[Story Edit API] Validation failed - invalid edit request');
      return NextResponse.json(
        {error: 'Invalid or missing edit request'},
        {status: 400},
      );
    }

    const originalStory: StoryDraft = storyDraft;
    const action = editRequest.trim();
    const personaId = originalStory.projectMetadata.personaId;

    console.log('[Story Edit API] Edit request:', action, personaId ? `with persona: ${personaId}` : '');
    if (referenceImageUrl) {
      console.log('[Story Edit API] Reference image provided:', referenceImageUrl.substring(0, 50) + '...');
    }

    // Call Agent Hub story-editor agent
    console.log('[Story Edit API] Calling Agent Hub story-editor...');
    const result = await editStory(originalStory, action, currentShot, personaId, referenceImageUrl);

    console.log('[Story Edit API] Edit complete:', result.changesSummary);

    // Return complete result
    return NextResponse.json({
      updatedStory: result.updatedStory,
      response: result.response,
      changesSummary: result.changesSummary,
    });
  } catch (error) {
    console.error('[Story Edit API] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to edit story',
      },
      {status: 500},
    );
  }
}
