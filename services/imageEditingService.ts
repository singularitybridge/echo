/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { fal } from '@fal-ai/client';
import { ImageEditingModel, ModelEditResult } from '@/types/ai-models';
import { getModelDefinition } from '@/lib/ai-models';

/**
 * Upload image to fal.ai storage and get temporary URL
 */
async function uploadImageToFal(imageDataUrl: string): Promise<string> {
  const base64Data = imageDataUrl.split(',')[1];
  const mimeType = imageDataUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
  const buffer = Buffer.from(base64Data, 'base64');
  const blob = new Blob([buffer], { type: mimeType });

  const uploadedImageUrl = await fal.storage.upload(blob);

  return uploadedImageUrl;
}

/**
 * Convert fal.ai aspect ratio format
 */
function mapAspectRatio(aspectRatio: string = '16:9'): string {
  const aspectRatioMap: Record<string, string> = {
    '1:1': 'square',
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_16_9',
    '4:3': 'landscape_4_3',
    '3:4': 'portrait_4_3',
  };

  return aspectRatioMap[aspectRatio] || 'landscape_16_9';
}

/**
 * Enhance prompt with character preservation instructions
 */
function enhancePrompt(prompt: string): string {
  return `Edit the image: ${prompt}. Preserve the character's identity and features, only apply the requested changes.`;
}

/**
 * Generate image using Gemini 2.5 Flash
 */
async function generateWithGemini(
  uploadedImageUrl: string,
  prompt: string,
  aspectRatio: string
): Promise<{ imageUrl: string }> {
  const enhancedPrompt = enhancePrompt(prompt);

  const result = await fal.subscribe('fal-ai/gemini-25-flash-image/edit', {
    input: {
      prompt: enhancedPrompt,
      image_urls: [uploadedImageUrl],
      num_images: 1,
      output_format: 'png',
      aspect_ratio: aspectRatio as "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9" | "3:2" | "2:3" | "5:4" | "4:5", // Gemini uses raw format: "9:16", "16:9", etc.
    },
  });

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error('No image URL in Gemini response');
  }

  return { imageUrl };
}

/**
 * Generate image using FLUX Kontext Pro
 */
async function generateWithFluxKontext(
  uploadedImageUrl: string,
  prompt: string,
  aspectRatio: string
): Promise<{ imageUrl: string }> {
  const enhancedPrompt = enhancePrompt(prompt);
  const imageSize = mapAspectRatio(aspectRatio);

  const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
    input: {
      prompt: enhancedPrompt,
      image_url: uploadedImageUrl,
      guidance_scale: 3.5,
      num_images: 1,
    },
  });

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error('No image URL in FLUX response');
  }

  return { imageUrl };
}

/**
 * Generate image using Qwen Image Edit
 */
async function generateWithQwen(
  uploadedImageUrl: string,
  prompt: string,
  aspectRatio: string
): Promise<{ imageUrl: string }> {
  const enhancedPrompt = enhancePrompt(prompt);
  const mappedAspectRatio = mapAspectRatio(aspectRatio);

  const result = await fal.subscribe('fal-ai/qwen-image-edit', {
    input: {
      prompt: enhancedPrompt,
      image_url: uploadedImageUrl,
      image_size: mappedAspectRatio as "square" | "landscape_16_9" | "portrait_16_9" | "landscape_4_3" | "portrait_4_3" | "square_hd",
      num_images: 1,
      output_format: 'png',
    },
  });

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error('No image URL in Qwen response');
  }

  return { imageUrl };
}

/**
 * Generate image using SeedEdit v3
 */
async function generateWithSeedEdit(
  uploadedImageUrl: string,
  prompt: string
): Promise<{ imageUrl: string }> {
  const enhancedPrompt = enhancePrompt(prompt);

  const result = await fal.subscribe(
    'fal-ai/bytedance/seededit/v3/edit-image',
    {
      input: {
        prompt: enhancedPrompt,
        image_url: uploadedImageUrl,
        guidance_scale: 0.5,
        enable_safety_checker: false,
        sync_mode: false,
      },
    }
  );

  const imageUrl = result.data?.image?.url;
  if (!imageUrl) {
    throw new Error('No image URL in SeedEdit response');
  }

  return { imageUrl };
}

/**
 * Generate image using SeedEdit v4 (SeeDream)
 */
async function generateWithSeedEditV4(
  uploadedImageUrl: string,
  prompt: string,
  aspectRatio: string
): Promise<{ imageUrl: string }> {
  const enhancedPrompt = enhancePrompt(prompt);
  const imageSize = mapAspectRatio(aspectRatio);

  const result = await fal.subscribe(
    'fal-ai/bytedance/seedream/v4/edit',
    {
      input: {
        image_urls: [uploadedImageUrl],
        prompt: enhancedPrompt,
        image_size: imageSize,
      },
    }
  );

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error('No image URL in SeedEdit v4 response');
  }

  return { imageUrl };
}

/**
 * Generate image using Nano Banana Pro
 */
async function generateWithNanoBananaPro(
  uploadedImageUrl: string,
  prompt: string
): Promise<{ imageUrl: string }> {
  const enhancedPrompt = enhancePrompt(prompt);

  const result = await fal.subscribe(
    'fal-ai/nano-banana-pro/edit',
    {
      input: {
        prompt: enhancedPrompt,
        image_urls: [uploadedImageUrl],
      },
    }
  );

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error('No image URL in Nano Banana Pro response');
  }

  return { imageUrl };
}

/**
 * Generate image with specified model
 */
export async function generateWithModel(
  model: ImageEditingModel,
  imageDataUrl: string,
  prompt: string,
  aspectRatio: string = '16:9',
  falKey: string
): Promise<ModelEditResult> {
  const startTime = Date.now();

  try {
    // Configure fal client
    fal.config({ credentials: falKey });

    // Upload image
    const uploadedImageUrl = await uploadImageToFal(imageDataUrl);

    // Generate based on model
    let imageUrl: string;

    switch (model) {
      case 'gemini-flash':
        const geminiResult = await generateWithGemini(
          uploadedImageUrl,
          prompt,
          aspectRatio
        );
        imageUrl = geminiResult.imageUrl;
        break;

      case 'flux-kontext':
        const fluxResult = await generateWithFluxKontext(
          uploadedImageUrl,
          prompt,
          aspectRatio
        );
        imageUrl = fluxResult.imageUrl;
        break;

      case 'qwen-edit':
        const qwenResult = await generateWithQwen(
          uploadedImageUrl,
          prompt,
          aspectRatio
        );
        imageUrl = qwenResult.imageUrl;
        break;

      case 'seededit':
        const seedEditResult = await generateWithSeedEdit(
          uploadedImageUrl,
          prompt
        );
        imageUrl = seedEditResult.imageUrl;
        break;

      case 'seededit-v4':
        const seedEditV4Result = await generateWithSeedEditV4(
          uploadedImageUrl,
          prompt,
          aspectRatio
        );
        imageUrl = seedEditV4Result.imageUrl;
        break;

      case 'nano-banana-pro':
        const nanoBananaResult = await generateWithNanoBananaPro(
          uploadedImageUrl,
          prompt
        );
        imageUrl = nanoBananaResult.imageUrl;
        break;

      default:
        throw new Error(`Unsupported model: ${model}`);
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
      console.error(`Error body for ${model}:`, JSON.stringify(body, null, 2));
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
export async function generateWithMultipleModels(
  models: ImageEditingModel[],
  imageDataUrl: string,
  prompt: string,
  aspectRatio: string = '16:9',
  falKey: string
): Promise<ModelEditResult[]> {
  const promises = models.map((model) =>
    generateWithModel(model, imageDataUrl, prompt, aspectRatio, falKey)
  );

  return Promise.all(promises);
}
