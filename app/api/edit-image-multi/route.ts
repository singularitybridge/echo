/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateWithMultipleModels } from '@/services/imageEditingService';
import { ImageEditingModel } from '@/types/ai-models';

/**
 * POST /api/edit-image-multi - Generate edited images using multiple AI models in parallel
 *
 * Request body:
 * {
 *   models: ImageEditingModel[];  // Array of model IDs to use
 *   imageDataUrl: string;          // Base64 data URL of image
 *   editPrompt: string;            // Edit instructions
 *   aspectRatio?: string;          // Optional aspect ratio (default: "16:9")
 * }
 *
 * Response:
 * {
 *   results: ModelEditResult[];    // Array of results, one per model
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { models, imageDataUrl, editPrompt, aspectRatio } =
      await request.json();

    // Validate required parameters
    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid required parameter: models (array)' },
        { status: 400 }
      );
    }

    if (!imageDataUrl || !editPrompt) {
      return NextResponse.json(
        { error: 'Missing required parameters: imageDataUrl and editPrompt' },
        { status: 400 }
      );
    }

    // Validate model IDs
    const validModels: ImageEditingModel[] = [
      'gemini-flash',
      'flux-kontext',
      'qwen-edit',
      'seededit',
      'seededit-v4',
    ];
    const invalidModels = models.filter(
      (model) => !validModels.includes(model as ImageEditingModel)
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
    const results = await generateWithMultipleModels(
      models as ImageEditingModel[],
      imageDataUrl,
      editPrompt,
      aspectRatio,
      falKey
    );

    console.log(`Successfully generated ${results.length} results`);

    return NextResponse.json({
      results,
    });
  } catch (error) {
    console.error('Error in edit-image-multi API:', error);

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
