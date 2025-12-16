/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest } from 'next/server';
import { generateWithModel } from '@/services/imageEditingService';
import { ImageEditingModel } from '@/types/ai-models';

/**
 * POST /api/edit-image-stream - Stream edited images as each model completes
 *
 * Uses Server-Sent Events to stream results one at a time
 */
export async function POST(request: NextRequest) {
  try {
    const { models, imageDataUrl, editPrompt, aspectRatio } =
      await request.json();

    // Validate required parameters
    if (!models || !Array.isArray(models) || models.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Missing or invalid required parameter: models (array)',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!imageDataUrl || !editPrompt) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameters: imageDataUrl and editPrompt',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate model IDs
    const validModels: ImageEditingModel[] = [
      'gemini-flash',
      'flux-kontext',
      'qwen-edit',
      'seededit',
      'seededit-v4',
      'nano-banana-pro',
    ];
    const invalidModels = models.filter(
      (model: string) => !validModels.includes(model as ImageEditingModel)
    );
    if (invalidModels.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Invalid model IDs: ${invalidModels.join(', ')}`,
          validModels,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return new Response(
        JSON.stringify({ error: 'FAL_KEY not configured on server' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `[Stream] Generating with ${models.length} models: ${models.join(', ')}`
    );

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send initial event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'start', models })}\n\n`
          )
        );

        // Process each model and stream results as they complete
        const promises = models.map(async (model: ImageEditingModel) => {
          try {
            const result = await generateWithModel(
              model,
              imageDataUrl,
              editPrompt,
              aspectRatio,
              falKey
            );

            // Send result for this model
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'result', result })}\n\n`
              )
            );

            console.log(`[Stream] Completed: ${model}`);
            return result;
          } catch (error) {
            console.error(`[Stream] Error for ${model}:`, error);
            const errorResult = {
              model,
              loading: false,
              error: error instanceof Error ? error.message : 'Generation failed',
            };
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'result', result: errorResult })}\n\n`
              )
            );
            return errorResult;
          }
        });

        // Wait for all to complete
        await Promise.all(promises);

        // Send completion event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        );

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in edit-image-stream API:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
