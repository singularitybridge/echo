/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { generateWithModel } from '@/services/imageEditingService';
import { ImageEditingModel } from '@/types/ai-models';

/**
 * POST /api/edit-image - Generate edited image using a single AI model
 *
 * Request body:
 * {
 *   imageDataUrl: string;          // Base64 data URL of image
 *   editPrompt: string;            // Edit instructions
 *   aspectRatio?: string;          // Optional aspect ratio (default: "16:9")
 *   model?: ImageEditingModel;     // Optional model selection (default: "flux-kontext")
 * }
 *
 * Response:
 * {
 *   imageBytes: string;            // Base64 encoded result image
 *   mimeType: string;              // MIME type of result
 *   model: ImageEditingModel;      // Model used for generation
 *   generationTime?: number;       // Time taken in seconds
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl, editPrompt, aspectRatio, model } =
      await request.json();

    if (!imageDataUrl || !editPrompt) {
      return NextResponse.json(
        { error: 'Missing required parameters: imageDataUrl and editPrompt' },
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

    // Default to flux-kontext for backward compatibility
    const selectedModel: ImageEditingModel = model || 'flux-kontext';

    // Validate model ID
    const validModels: ImageEditingModel[] = [
      'gemini-flash',
      'flux-kontext',
      'flux-2-dev',
      'flux-2-pro',
      'flux-2-max',
      'flux-2-flex',
      'gpt-image-1',
      'gpt-image-1.5',
      'qwen-edit',
      'qwen-edit-2509',
      'seededit',
      'seededit-v4',
      'nano-banana-pro',
    ];
    if (!validModels.includes(selectedModel)) {
      return NextResponse.json(
        {
          error: `Invalid model ID: ${selectedModel}`,
          validModels,
        },
        { status: 400 }
      );
    }

    console.log(
      `Generating with model: ${selectedModel}, prompt: ${editPrompt}`
    );

    // Generate with selected model
    const result = await generateWithModel(
      selectedModel,
      imageDataUrl,
      editPrompt,
      aspectRatio,
      falKey
    );

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageBytes: result.imageBytes,
      mimeType: result.mimeType,
      model: result.model,
      generationTime: result.generationTime,
    });
  } catch (error) {
    console.error('Error in edit-image API:', error);

    // Extract detailed error message from FAL API errors
    let errorMessage = 'Internal server error';
    let errorDetails = String(error);

    // Check if it's a FAL API error with body
    if (error && typeof error === 'object' && 'body' in error) {
      const body = (error as any).body;
      if (body && typeof body === 'object') {
        // FAL errors often have a 'detail' field
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
