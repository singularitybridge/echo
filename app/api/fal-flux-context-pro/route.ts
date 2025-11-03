/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';

const FAL_API_KEY = process.env.FAL_KEY;
const FAL_ENDPOINT = 'https://queue.fal.run/fal-ai/flux-pro/kontext';

export async function POST(request: NextRequest) {
  try {
    if (!FAL_API_KEY) {
      return NextResponse.json(
        { error: 'FAL_KEY not configured in environment variables' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { image_url, prompt, guidance_scale = 3.5, num_inference_steps = 28 } = body;

    if (!image_url || !prompt) {
      return NextResponse.json(
        { error: 'Missing required parameters: image_url and prompt are required' },
        { status: 400 }
      );
    }

    // Submit job to FAL AI Flux Context Pro
    console.log('Submitting to FAL endpoint:', FAL_ENDPOINT);
    console.log('Request body:', JSON.stringify({ image_url, prompt, guidance_scale, num_inference_steps }));

    const submitResponse = await fetch(FAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url,
        prompt,
        guidance_scale, // Prompt adherence (default 3.5)
        num_inference_steps, // Quality (default 28)
        enable_safety_checker: false, // Disable for creative content
      }),
    });

    console.log('Submit response status:', submitResponse.status);
    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error('FAL API submission failed:', errorText);
      return NextResponse.json(
        { error: `FAL API error: ${submitResponse.statusText}` },
        { status: submitResponse.status }
      );
    }

    const submitData = await submitResponse.json();
    console.log('Submit response data:', JSON.stringify(submitData, null, 2));
    const requestId = submitData.request_id;
    const statusUrl = submitData.status_url;

    if (!requestId || !statusUrl) {
      return NextResponse.json(
        { error: 'No request_id or status_url returned from FAL API' },
        { status: 500 }
      );
    }

    // Poll for completion (Flux Context Pro typically completes in 3-6 seconds)
    console.log('Status check URL:', statusUrl);
    let attempts = 0;
    const maxAttempts = 40; // 40 seconds max wait

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(statusUrl, {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
        },
      });

      console.log(`Status check attempt ${attempts + 1}: ${statusResponse.status}`);
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('Status check error:', errorText);
        throw new Error(`Status check failed: ${statusResponse.statusText}`);
      }

      const statusData = await statusResponse.json();

      if (statusData.status === 'COMPLETED') {
        console.log('Flux Context Pro job completed. Full status response:', JSON.stringify(statusData, null, 2));

        // For Flux Pro Kontext, we need to fetch the result using the correct endpoint
        // The response_url points to the base request, we need to append /result or use a different approach
        const resultUrl = statusData.response_url || `https://queue.fal.run/fal-ai/flux-pro/requests/${requestId}`;
        console.log('Fetching result from:', resultUrl);

        const resultResponse = await fetch(resultUrl, {
          headers: {
            'Authorization': `Key ${FAL_API_KEY}`,
          },
        });

        if (!resultResponse.ok) {
          console.error('Failed to fetch result:', resultResponse.status, resultResponse.statusText);
          const errorText = await resultResponse.text();
          console.error('Error response body:', errorText);
          throw new Error(`Failed to fetch result: ${resultResponse.statusText}`);
        }

        const resultData = await resultResponse.json();
        console.log('Flux Context Pro result data:', JSON.stringify(resultData, null, 2));

        // Extract image URL from various possible locations in the response
        let imageUrl = resultData.images?.[0]?.url ||
                      resultData.image?.url ||
                      resultData.data?.images?.[0]?.url ||
                      resultData.output?.images?.[0]?.url ||
                      resultData.output?.image?.url;

        if (!imageUrl) {
          console.error('No image URL found. Result data:', JSON.stringify(resultData, null, 2));
          throw new Error('No image URL in result data');
        }

        console.log('Image URL from Flux Context Pro:', imageUrl);

        // Fetch the image and convert to base64
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
        throw new Error(`Flux Context Pro job failed: ${statusData.error || 'Unknown error'}`);
      }

      // Wait 1 second before next poll
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    return NextResponse.json(
      { error: 'Request timed out after 40 seconds' },
      { status: 408 }
    );
  } catch (error) {
    console.error('Flux Context Pro API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
