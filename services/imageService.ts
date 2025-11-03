/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from '@google/genai';

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

/**
 * Generate an image using Gemini 2.5 Flash Image (Nano Banana)
 */
export const generateImage = async (
  params: GenerateImageParams,
): Promise<GeneratedImage> => {
  console.log('Starting image generation with params:', params);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_GEMINI_API_KEY not found in environment');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [params.prompt],
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: params.aspectRatio || '16:9',
      },
    },
  });

  console.log('Image generation response:', response);
  console.log('Response type:', typeof response);
  console.log('Response keys:', Object.keys(response));

  // Try different possible response structures
  let imageBytes: string | undefined;
  let mimeType = 'image/png';

  // Check if response has parts array
  if (response.parts && Array.isArray(response.parts)) {
    console.log('Response has parts array, length:', response.parts.length);

    // Try camelCase naming (inlineData)
    const imagePartCamel = response.parts.find((part: any) => part.inlineData);
    if (imagePartCamel?.inlineData) {
      console.log('Found image with inlineData (camelCase)');
      imageBytes = imagePartCamel.inlineData.data;
      mimeType = imagePartCamel.inlineData.mimeType || mimeType;
    } else {
      // Try snake_case naming (inline_data)
      const imagePartSnake = response.parts.find((part: any) => part.inline_data);
      if (imagePartSnake?.inline_data) {
        console.log('Found image with inline_data (snake_case)');
        imageBytes = imagePartSnake.inline_data.data;
        mimeType = imagePartSnake.inline_data.mime_type || imagePartSnake.inline_data.mimeType || mimeType;
      }
    }
  }

  // Check if response has direct data property
  if (!imageBytes && (response as any).data) {
    console.log('Found response.data');
    imageBytes = (response as any).data;
  }

  // Check if response has direct image property
  if (!imageBytes && (response as any).image) {
    console.log('Found response.image');
    imageBytes = (response as any).image;
  }

  if (!imageBytes) {
    console.error('Failed to find image in response. Full response structure:', JSON.stringify(response, null, 2));
    throw new Error('No image was generated in the response');
  }

  console.log('Successfully extracted image bytes, length:', imageBytes.length);

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
};

/**
 * Generate multiple character reference images
 */
export const generateCharacterReferences = async (
  characterDescription: string,
  numberOfImages: number = 2,
  aspectRatio: '16:9' | '9:16' = '16:9',
): Promise<GeneratedImage[]> => {
  const prompts = [
    `Portrait of ${characterDescription}, front-facing, neutral friendly expression, high quality photorealistic, professional lighting`,
    `Portrait of ${characterDescription}, smiling and gesturing expressively, high quality photorealistic, professional lighting`,
    `Full body shot of ${characterDescription}, casual pose, high quality photorealistic, professional lighting`,
  ].slice(0, numberOfImages);

  const images: GeneratedImage[] = [];

  for (const prompt of prompts) {
    try {
      const image = await generateImage({ prompt, aspectRatio });
      images.push(image);
    } catch (error) {
      console.error('Failed to generate image for prompt:', prompt, error);
      throw error;
    }
  }

  return images;
};

export interface EditImageParams {
  baseImageBlob?: Blob;
  baseImageUrl?: string;
  originalDescription?: string;
  editPrompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
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

/**
 * Generate image using Gemini 2.5 Flash Image (Nano Banana) with reference
 * Ultra-fast (1-2s) with strong semantic understanding
 */
export async function generateWithNanoBanana(params: {
  referenceImageUrl?: string;
  prompt: string;
  aspectRatio?: string;
}): Promise<GeneratedImage> {
  console.log('Using Gemini Nano Banana (2.5 Flash Image)');

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_GEMINI_API_KEY not found in environment');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Build content array with reference image if provided
  const contents: any[] = [];

  if (params.referenceImageUrl) {
    // Fetch reference image and convert to inline data
    const response = await fetch(params.referenceImageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    contents.push({
      inlineData: {
        data: base64,
        mimeType: 'image/png',
      },
    });
  }

  // Add prompt
  contents.push(params.prompt);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents,
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: params.aspectRatio || '9:16',
      },
    },
  });

  const imageParts = response.candidates?.[0]?.content?.parts?.filter(
    (part: any) => part.inlineData
  );

  if (!imageParts || imageParts.length === 0) {
    throw new Error('No image generated by Gemini Nano Banana');
  }

  const imagePart = imageParts[0];
  const imageBytes = imagePart.inlineData.data;
  const mimeType = imagePart.inlineData.mimeType;

  // Convert base64 to blob
  const byteCharacters = atob(imageBytes);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  return {
    imageBytes,
    mimeType,
    objectUrl,
    blob,
  };
}
