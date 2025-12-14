/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {NextRequest, NextResponse} from 'next/server';
import {
  generateQuickPathStory,
  generateCustomPathStory,
  refineStory,
} from '../../../../services/storyGenerationService';
import {
  GenerateStoryRequest,
  GenerateStoryResponse,
  QuickPathParams,
  CustomPathParams,
} from '../../../../types/story-creation';

/**
 * POST /api/story/generate
 * Generate a complete story using Quick Path or Custom Path, or refine an existing story
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateStoryRequest = await request.json();

    console.log('Story generation request received:', body.mode, body.refinement ? 'with refinement' : '');

    let story;

    let changesSummary: string | undefined;

    // If refinement feedback is provided, refine the existing story
    if (body.refinement && body.existingStory) {
      console.log('Refining story with feedback:', body.refinement);
      const result = await refineStory(body.existingStory, body.refinement);
      story = result.story;
      changesSummary = result.changesSummary;
    } else if (body.mode === 'quick') {
      // Quick Path: Genre + Type + Energy + Persona + Story Guidance
      story = await generateQuickPathStory(body.params as QuickPathParams, body.personaId, body.storyGuidance);
    } else if (body.mode === 'custom') {
      // Custom Path: User Concept + Persona
      story = await generateCustomPathStory(body.params as CustomPathParams, body.personaId);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid mode. Must be "quick" or "custom"',
        } as GenerateStoryResponse,
        {status: 400},
      );
    }

    return NextResponse.json({
      success: true,
      story,
      changesSummary,
    } as GenerateStoryResponse);
  } catch (error) {
    console.error('Error generating story:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to generate story',
      } as GenerateStoryResponse,
      {status: 500},
    );
  }
}
