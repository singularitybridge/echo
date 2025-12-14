/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {NextRequest, NextResponse} from 'next/server';

/**
 * POST /api/generate-image-fal
 * Generate a single image using Fal.ai Nano Banana Pro model
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {prompt, aspectRatio = '16:9'} = body;

    if (!prompt) {
      return NextResponse.json(
        {error: 'Missing required field: prompt'},
        {status: 400},
      );
    }

    console.log(`[Generate Image FAL] Generating image with Nano Banana Pro`);
    console.log(`[Generate Image FAL] Prompt:`, prompt);
    console.log(`[Generate Image FAL] Aspect ratio:`, aspectRatio);

    // Generate image using fal.ai Nano Banana Pro model
    const response = await fetch('https://fal.run/fal-ai/nano-banana-pro', {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio: aspectRatio,
        resolution: '2K',
        num_images: 1,
        output_format: 'png',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Generate Image FAL] API error:`, errorText);
      throw new Error(`Fal.ai API error: ${response.statusText}`);
    }

    const result = await response.json();
    const imageUrl = result.images[0].url;

    // Download the generated image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const base64Image = imageBuffer.toString('base64');

    console.log(`[Generate Image FAL] Image generated successfully with Nano Banana Pro`);

    return NextResponse.json({
      success: true,
      imageBytes: base64Image,
      mimeType: 'image/png',
    });
  } catch (error) {
    console.error('[Generate Image FAL] Error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate image',
      },
      {status: 500},
    );
  }
}
