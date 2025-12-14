/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fal from '@fal-ai/serverless-client';
import { ImageGenerationModel, ModelGenerationResult } from '@/types/ai-models';
import { getGenerationModelDefinition } from '@/lib/ai-models';

/**
 * Generate image with a single model
 */
export async function generateWithGenerationModel(
  model: ImageGenerationModel,
  prompt: string,
  aspectRatio: string = '16:9',
  falKey: string
): Promise<ModelGenerationResult> {
  const startTime = Date.now();

  try {
    // Configure fal client
    fal.config({ credentials: falKey });

    const modelDef = getGenerationModelDefinition(model);
    let imageUrl: string;

    // Map aspect ratio to dimensions
    const aspectRatioMap: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1024, height: 576 },
      '9:16': { width: 576, height: 1024 },
      '1:1': { width: 1024, height: 1024 },
    };
    const dimensions = aspectRatioMap[aspectRatio] || aspectRatioMap['16:9'];

    // Generate based on model
    switch (model) {
      case 'ideogram-v2': {
        const result = await fal.subscribe(modelDef.endpoint, {
          input: {
            prompt,
            image_size: { width: dimensions.width, height: dimensions.height },
            aspect_ratio: aspectRatio,
          },
        }) as any;
        imageUrl = result.images[0].url;
        break;
      }

      case 'flux-pro-ultra': {
        const result = await fal.subscribe(modelDef.endpoint, {
          input: {
            prompt,
            image_size: { width: dimensions.width, height: dimensions.height },
            aspect_ratio: aspectRatio,
          },
        }) as any;
        imageUrl = result.images[0].url;
        break;
      }

      case 'recraft-v3': {
        // Map aspect ratio to recraft-v3 size constants
        const recraftSizeMap: Record<string, string> = {
          '16:9': 'landscape_16_9',
          '9:16': 'portrait_16_9',
          '1:1': 'square_hd',
        };
        const recraftSize = recraftSizeMap[aspectRatio] || 'landscape_16_9';

        const result = await fal.subscribe(modelDef.endpoint, {
          input: {
            prompt,
            image_size: recraftSize,
          },
        }) as any;
        imageUrl = result.images[0].url;
        break;
      }

      case 'imagen4-ultra': {
        const result = await fal.subscribe(modelDef.endpoint, {
          input: {
            prompt,
            image_size: { width: dimensions.width, height: dimensions.height },
            aspect_ratio: aspectRatio,
          },
        }) as any;
        imageUrl = result.images[0].url;
        break;
      }

      case 'flux-dev': {
        const result = await fal.subscribe(modelDef.endpoint, {
          input: {
            prompt,
            image_size: { width: dimensions.width, height: dimensions.height },
          },
        }) as any;
        imageUrl = result.images[0].url;
        break;
      }

      case 'hidream-i1': {
        const result = await fal.subscribe(modelDef.endpoint, {
          input: {
            prompt,
            image_size: { width: dimensions.width, height: dimensions.height },
          },
        }) as any;
        imageUrl = result.images[0].url;
        break;
      }

      case 'nano-banana-pro': {
        // nano-banana-pro uses aspect_ratio and resolution instead of image_size
        const result = await fal.subscribe(modelDef.endpoint, {
          input: {
            prompt,
            aspect_ratio: aspectRatio,
            resolution: '2K', // Use 2K for good quality
          },
        }) as any;
        imageUrl = result.images[0].url;
        break;
      }

      default:
        throw new Error(`Unsupported generation model: ${model}`);
    }

    // Fetch the generated image
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();

    // Convert to base64
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const generationTime = (Date.now() - startTime) / 1000;

    return {
      model,
      imageBytes: base64,
      mimeType: imageBlob.type || 'image/png',
      loading: false,
      generationTime,
    };
  } catch (error) {
    console.error(`Error generating with ${model}:`, error);

    let errorMessage = 'Generation failed';
    if (error && typeof error === 'object' && 'body' in error) {
      const body = (error as any).body;
      if (body && typeof body === 'object') {
        if (body.detail) {
          errorMessage = body.detail;
        } else if (body.message) {
          errorMessage = body.message;
        }
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      model,
      loading: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate images with multiple models in parallel
 */
export async function generateWithMultipleGenerationModels(
  models: ImageGenerationModel[],
  prompt: string,
  aspectRatio: string = '16:9',
  falKey: string
): Promise<ModelGenerationResult[]> {
  const promises = models.map((model) =>
    generateWithGenerationModel(model, prompt, aspectRatio, falKey)
  );

  return Promise.all(promises);
}
