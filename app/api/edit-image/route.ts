/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl, editPrompt, aspectRatio } = await request.json();

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

    // Configure fal client
    fal.config({ credentials: falKey });

    // Convert data URL to buffer for upload
    const base64Data = imageDataUrl.split(',')[1];
    const mimeType = imageDataUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload image buffer to fal.ai storage and get temporary URL
    console.log('Uploading image to fal.ai storage...');
    const uploadedImageUrl = await fal.storage.upload(buffer, {
      contentType: mimeType,
      fileName: 'image.png'
    });
    console.log('Image uploaded, temporary URL:', uploadedImageUrl);

    // Map aspect ratio to fal.ai image size format
    const aspectRatioMap: Record<string, string> = {
      '1:1': 'square',
      '16:9': 'landscape_16_9',
      '9:16': 'portrait_16_9',
      '4:3': 'landscape_4_3',
      '3:4': 'portrait_4_3',
    };

    const imageSize = aspectRatioMap[aspectRatio || '16:9'] || 'landscape_16_9';

    // Enhance prompt with character preservation instructions
    // The key is to emphasize maintaining exact visual identity
    const enhancedPrompt = `IMPORTANT: Keep the EXACT SAME character identity, facial features, age, skin tone, and overall appearance from the reference image. Only change: ${editPrompt}. The character must look identical in all aspects except for the specific changes requested.`;

    // Call fal.ai FLUX Pro Kontext for superior character consistency
    // Kontext is specifically designed for reference-aware editing with better identity preservation
    console.log('Calling fal.ai FLUX Pro Kontext with prompt:', editPrompt);
    const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
      input: {
        prompt: enhancedPrompt,
        image_url: uploadedImageUrl,
        // Kontext uses image as reference context, no strength parameter
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: false,
        image_size: imageSize,
      },
    });

    console.log('fal.ai response:', JSON.stringify(result, null, 2));

    // Extract image URL from SDK response
    const imageUrl = result.data?.images?.[0]?.url;
    if (!imageUrl) {
      console.error('Could not find image URL in response. Full response:', result);
      return NextResponse.json(
        { error: 'No image URL in fal.ai response', response: result },
        { status: 500 }
      );
    }

    // Fetch the generated image
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();

    // Convert to base64
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return NextResponse.json({
      imageBytes: base64,
      mimeType: imageBlob.type || 'image/png',
    });
  } catch (error) {
    console.error('Error in edit-image API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
