/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {NextRequest, NextResponse} from 'next/server';

/**
 * POST /api/generate-image
 * Generate a single image using various Fal.ai models based on model parameter
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {prompt, model = 'flux-dev', aspectRatio = '9:16'} = body;

    if (!prompt) {
      return NextResponse.json(
        {error: 'Missing required field: prompt'},
        {status: 400},
      );
    }

    console.log(`[Generate Image] Generating with model: ${model}`);
    console.log(`[Generate Image] Prompt:`, prompt);
    console.log(`[Generate Image] Aspect ratio:`, aspectRatio);

    // Map aspect ratios to Fal.ai dimensions
    const dimensions: Record<string, {width: number; height: number}> = {
      '16:9': {width: 1792, height: 1024},
      '9:16': {width: 1024, height: 1792},
      '1:1': {width: 1024, height: 1024},
      '4:3': {width: 1024, height: 768},
      '3:4': {width: 768, height: 1024},
    };

    const imageSize = dimensions[aspectRatio] || dimensions['9:16'];

    // Map model IDs to Fal.ai endpoints
    const modelEndpoints: Record<string, string> = {
      'flux-dev': 'fal-ai/flux/dev',
      'flux-context-pro': 'fal-ai/flux-pro/v1.1-ultra',
      'fal-instant-character': 'fal-ai/fast-sdxl',
    };

    const endpoint = modelEndpoints[model] || modelEndpoints['flux-dev'];

    // Generate image using fal.ai
    const response = await fetch(`https://fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: imageSize,
        num_inference_steps: model === 'flux-context-pro' ? 40 : 28,
        guidance_scale: model === 'flux-context-pro' ? 7.5 : 3.5,
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Generate Image] Fal.ai API error:`, errorText);
      throw new Error(`Fal.ai API error: ${response.statusText}`);
    }

    const result = await response.json();
    const imageUrl = result.images[0].url;

    // Download the generated image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const base64Image = imageBuffer.toString('base64');

    console.log(`[Generate Image] Image generated successfully with ${model}`);

    return NextResponse.json({
      success: true,
      imageBytes: base64Image,
      mimeType: 'image/png',
    });
  } catch (error) {
    console.error('[Generate Image] Error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate image',
      },
      {status: 500},
    );
  }
}
