/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';

const FAL_API_KEY = process.env.FAL_KEY;
const FAL_ENDPOINT = 'https://queue.fal.run/fal-ai/instant-character';

export async function POST(request: NextRequest) {
  try {
    if (!FAL_API_KEY) {
      return NextResponse.json(
        { error: 'FAL_KEY not configured in environment variables' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { image_url, prompt, scale = 0.8, guidance_scale = 3.5, num_inference_steps = 20 } = body;

    if (!image_url || !prompt) {
      return NextResponse.json(
        { error: 'Missing required parameters: image_url and prompt are required' },
        { status: 400 }
      );
    }

    // Submit job to FAL AI
    const submitResponse = await fetch(FAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url,
        prompt,
        scale, // Identity preservation strength (0-1, recommend 0.7-0.85)
        guidance_scale, // Prompt adherence (default 3.5)
        num_inference_steps, // Quality vs speed tradeoff (default 20)
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error('FAL API submission failed:', errorText);
      return NextResponse.json(
        { error: `FAL API error: ${submitResponse.statusText}` },
        { status: submitResponse.status }
      );
    }

    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;

    if (!requestId) {
      return NextResponse.json(
        { error: 'No request_id returned from FAL API' },
        { status: 500 }
      );
    }

    // Poll for completion (FAL typically completes in 2-5 seconds)
    const statusUrl = `${FAL_ENDPOINT}/requests/${requestId}/status`;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(statusUrl, {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.statusText}`);
      }

      const statusData = await statusResponse.json();

      if (statusData.status === 'COMPLETED') {
        console.log('FAL job completed. Full status response:', JSON.stringify(statusData, null, 2));

        // Try to get image URL from status data first (may already be present)
        let imageUrl = statusData.images?.[0]?.url ||
                      statusData.image?.url ||
                      statusData.data?.images?.[0]?.url;

        // If not in status data, fetch from response_url
        if (!imageUrl && statusData.response_url) {
          console.log('Image not in status data, fetching from response_url...');
          const resultResponse = await fetch(statusData.response_url, {
            headers: {
              'Authorization': `Key ${FAL_API_KEY}`,
            },
          });

          if (!resultResponse.ok) {
            console.error('Failed to fetch result:', resultResponse.status, resultResponse.statusText);
            throw new Error(`Failed to fetch result: ${resultResponse.statusText}`);
          }

          const resultData = await resultResponse.json();
          console.log('FAL result data:', JSON.stringify(resultData, null, 2));

          imageUrl = resultData.images?.[0]?.url ||
                    resultData.image?.url ||
                    resultData.data?.images?.[0]?.url;
        }

        if (!imageUrl) {
          console.error('No image URL found. Status data:', JSON.stringify(statusData, null, 2));
          throw new Error('No image URL in result data');
        }

        console.log('Image URL from FAL:', imageUrl);

        // Fetch the image and convert to base64
        // FAL returns signed URLs that don't require additional auth
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          console.error('Failed to fetch image. Status:', imageResponse.status, imageResponse.statusText);
          console.error('Response headers:', Object.fromEntries(imageResponse.headers.entries()));
          throw new Error(`Failed to fetch generated image: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');

        return NextResponse.json({
          success: true,
          image: {
            data: base64Image,
            mimeType: 'image/png',
          },
        });
      }

      if (statusData.status === 'FAILED') {
        throw new Error(`FAL job failed: ${statusData.error || 'Unknown error'}`);
      }

      // Wait 1 second before next poll
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    return NextResponse.json(
      { error: 'Request timed out after 30 seconds' },
      { status: 408 }
    );
  } catch (error) {
    console.error('FAL Instant Character API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
