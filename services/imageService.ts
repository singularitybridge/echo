/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GenerateImageParams {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
}

export interface GeneratedImage {
  imageBytes: string;
  mimeType: string;
  objectUrl: string;
  blob: Blob;
  assetId?: string; // Asset ID for assets loaded from database
}

// Global lock to prevent duplicate generations
let generationInProgress = false;
let lastGenerationKey = '';

/**
 * Generate an image using Fal.ai Flux model
 */
export const generateImage = async (
  params: GenerateImageParams,
): Promise<GeneratedImage> => {
  const timestamp = new Date().toISOString();
  console.log(`\n[generateImage] ${timestamp} - API CALL START`);
  console.log('[generateImage] Params:', params);

  // Call our Fal.ai image generation API
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3039';
  const response = await fetch(`${baseUrl}/api/generate-image-fal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio || '16:9',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !data.imageBytes) {
    throw new Error('No image was generated in the response');
  }

  const imageBytes = data.imageBytes;
  const mimeType = data.mimeType || 'image/png';

  console.log('[generateImage] ✅ Successfully received image bytes, length:', imageBytes.length);

  // Convert base64 to blob
  const byteString = atob(imageBytes);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  const completionTime = new Date().toISOString();
  console.log(`[generateImage] ${completionTime} - API CALL COMPLETE\n`);

  return {
    imageBytes,
    mimeType,
    objectUrl,
    blob,
  };
};

/**
 * Generate multiple character reference images
 */
export const generateCharacterReferences = async (
  characterDescription: string,
  numberOfImages: number = 2,
  aspectRatio: '16:9' | '9:16' = '16:9',
): Promise<GeneratedImage[]> => {
  // Log function call with timestamp and stack trace
  const timestamp = new Date().toISOString();
  const callStack = new Error().stack?.split('\n').slice(2, 5).join('\n') || 'no stack';
  console.log(`\n[imageService] ${timestamp} - generateCharacterReferences CALLED`);
  console.log('[imageService] Parameters:', { characterDescription, numberOfImages, aspectRatio });
  console.log('[imageService] Current lock state:', { generationInProgress, lastGenerationKey });
  console.log('[imageService] Call stack:\n', callStack);

  // Create a unique key for this generation request
  const generationKey = `${characterDescription}-${numberOfImages}-${aspectRatio}`;

  // Check if this exact generation is already in progress or was just completed
  if (generationInProgress && lastGenerationKey === generationKey) {
    console.log('[imageService] ❌ BLOCKED - Generation already in progress for this request');
    throw new Error('Generation already in progress');
  }

  console.log('[imageService] ✅ PROCEEDING - Starting generation with key:', generationKey);
  generationInProgress = true;
  lastGenerationKey = generationKey;

  try {
    const prompts = [
      `Portrait of ${characterDescription}, front-facing, neutral friendly expression, high quality photorealistic, professional lighting`,
      `Portrait of ${characterDescription}, smiling and gesturing expressively, high quality photorealistic, professional lighting`,
      `Full body shot of ${characterDescription}, casual pose, high quality photorealistic, professional lighting`,
    ].slice(0, numberOfImages);

    const images: GeneratedImage[] = [];

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      console.log(`[imageService] 🎨 Generating image ${i + 1}/${prompts.length}`);
      try {
        const image = await generateImage({ prompt, aspectRatio });
        images.push(image);
        console.log(`[imageService] ✅ Image ${i + 1}/${prompts.length} complete`);
      } catch (error) {
        console.error(`[imageService] ❌ Failed to generate image ${i + 1}:`, error);
        throw error;
      }
    }

    console.log('[imageService] 🎉 All images generated, releasing lock');
    return images;
  } finally {
    // Release lock after a short delay to prevent immediate re-calls
    setTimeout(() => {
      generationInProgress = false;
      console.log('[imageService] Lock released');
    }, 1000);
  }
};

export interface EditImageParams {
  baseImageBlob?: Blob;
  baseImageUrl?: string;
  originalDescription?: string;
  editPrompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  model?: string; // Optional AI model to use for editing
}

/**
 * Edit an existing image using instruction-based image editing via fal.ai
 */
export const editImage = async (
  params: EditImageParams,
): Promise<GeneratedImage> => {
  console.log('Starting image editing with params:', params);

  // If we have a base image, use true image editing
  if (params.baseImageBlob || params.baseImageUrl) {
    return editImageWithFal(params);
  }

  // Fallback: regenerate from text description
  const combinedPrompt = `${params.originalDescription || ''}. ${params.editPrompt}. High quality photorealistic, professional lighting.`;
  console.log('No base image provided, generating from text:', combinedPrompt);

  return generateImage({
    prompt: combinedPrompt,
    aspectRatio: params.aspectRatio || '16:9',
  });
};

/**
 * Edit an image using fal.ai's image editing endpoint via server-side API
 * Uses flux-pro/v1.1-ultra for high quality instruction-based editing
 */
async function editImageWithFal(
  params: EditImageParams,
): Promise<GeneratedImage> {
  console.log('Using fal.ai image editing with base image (via API)');

  // Convert blob to base64 data URL if provided
  let imageDataUrl: string;

  if (params.baseImageBlob) {
    const reader = new FileReader();
    const dataUrlPromise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
    });
    reader.readAsDataURL(params.baseImageBlob);
    imageDataUrl = await dataUrlPromise;
  } else if (params.baseImageUrl) {
    // Fetch image from URL and convert to data URL
    const response = await fetch(params.baseImageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/png';
    imageDataUrl = `data:${mimeType};base64,${base64}`;
  } else {
    throw new Error('No base image provided for editing');
  }

  // Call our server-side API route instead of calling fal.ai directly
  // Use full URL for server-side fetch calls
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3039';
  const response = await fetch(`${baseUrl}/api/edit-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageDataUrl,
      editPrompt: params.editPrompt,
      aspectRatio: params.aspectRatio || '16:9',
      model: params.model, // Pass through the model parameter
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Image editing API error: ${errorData.error || response.status}`);
  }

  const result = await response.json();
  console.log('Image edit API response received');

  const imageBytes = result.imageBytes;
  const mimeType = result.mimeType || 'image/png';

  // Convert base64 to blob
  const byteString = atob(imageBytes);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  return {
    imageBytes,
    mimeType,
    objectUrl,
    blob,
  };
}

/**
 * Generate image with character reference using FAL AI Instant Character
 * Maintains character consistency across different poses and expressions
 */
export async function generateWithFalInstantCharacter(params: {
  referenceImageUrl: string;
  prompt: string;
  aspectRatio?: string;
}): Promise<GeneratedImage> {
  console.log('Using FAL Instant Character with reference image');

  const response = await fetch('/api/fal-instant-character', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: params.referenceImageUrl,
      prompt: params.prompt,
      scale: 0.8, // Identity preservation strength
      guidance_scale: 3.5,
      num_inference_steps: 20,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`FAL Instant Character failed: ${error}`);
  }

  const data = await response.json();

  if (!data.success || !data.image) {
    throw new Error('No image returned from FAL Instant Character');
  }

  // Convert base64 to blob
  const base64Data = data.image.data;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: data.image.mimeType });
  const objectUrl = URL.createObjectURL(blob);

  return {
    imageBytes: base64Data,
    mimeType: data.image.mimeType,
    objectUrl,
    blob,
  };
}

/**
 * Generate image with character reference using FAL AI Flux Context Pro
 * Industry-leading 99.7% character consistency accuracy
 */
export async function generateWithFluxContextPro(params: {
  referenceImageUrl: string;
  prompt: string;
  aspectRatio?: string;
}): Promise<GeneratedImage> {
  console.log('Using Flux Context Pro with reference image');

  const response = await fetch('/api/fal-flux-context-pro', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: params.referenceImageUrl,
      prompt: params.prompt,
      guidance_scale: 3.5,
      num_inference_steps: 28,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Flux Context Pro failed: ${error}`);
  }

  const data = await response.json();

  if (!data.success || !data.image) {
    throw new Error('No image returned from Flux Context Pro');
  }

  // Convert base64 to blob
  const base64Data = data.image.data;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: data.image.mimeType });
  const objectUrl = URL.createObjectURL(blob);

  return {
    imageBytes: base64Data,
    mimeType: data.image.mimeType,
    objectUrl,
    blob,
  };
}

