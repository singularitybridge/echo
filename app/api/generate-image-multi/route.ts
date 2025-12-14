/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateWithMultipleGenerationModels } from '@/services/imageGenerationService';
import { ImageGenerationModel } from '@/types/ai-models';

/**
 * POST /api/generate-image-multi - Generate images using multiple AI models in parallel
 *
 * Request body:
 * {
 *   models: ImageGenerationModel[];  // Array of model IDs to use
 *   prompt: string;                   // Image generation prompt
 *   aspectRatio?: string;             // Optional aspect ratio (default: "16:9")
 * }
 *
 * Response:
 * {
 *   results: ModelGenerationResult[];  // Array of results, one per model
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { models, prompt, aspectRatio } = await request.json();

    // Validate required parameters
    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid required parameter: models (array)' },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing required parameter: prompt' },
        { status: 400 }
      );
    }

    // Validate model IDs
    const validModels: ImageGenerationModel[] = [
      'ideogram-v2',
      'flux-pro-ultra',
      'recraft-v3',
      'imagen4-ultra',
      'flux-dev',
      'hidream-i1',
      'nano-banana-pro',
    ];
    const invalidModels = models.filter(
      (model) => !validModels.includes(model as ImageGenerationModel)
    );
    if (invalidModels.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid model IDs: ${invalidModels.join(', ')}`,
          validModels,
        },
        { status: 400 }
      );
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { error: 'FAL_KEY not configured on server' },
        { status: 500 }
      );
    }

    console.log(
      `Generating with ${models.length} models: ${models.join(', ')}`
    );

    // Generate with multiple models in parallel
    const results = await generateWithMultipleGenerationModels(
      models as ImageGenerationModel[],
      prompt,
      aspectRatio,
      falKey
    );

    console.log(`Successfully generated ${results.length} results`);

    return NextResponse.json({
      results,
    });
  } catch (error) {
    console.error('Error in generate-image-multi API:', error);

    let errorMessage = 'Internal server error';
    let errorDetails = String(error);

    if (error && typeof error === 'object' && 'body' in error) {
      const body = (error as any).body;
      if (body && typeof body === 'object') {
        if (body.detail) {
          errorMessage = body.detail;
        } else if (body.message) {
          errorMessage = body.message;
        }
        errorDetails = JSON.stringify(body);
      }
    }

    return NextResponse.json(
      { error: errorMessage, details: errorDetails },
      { status: 500 }
    );
  }
}
