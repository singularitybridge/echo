/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SoraVideoGenerationParams {
  prompt: string;
  imageUrl?: string; // Optional start frame image URL for image-to-video
  aspectRatio?: '16:9' | '9:16' | '1:1';
  duration?: number; // Duration in seconds (max 5 for sora-turbo)
}

export interface SoraVideoGenerationResult {
  videoUrl: string; // URL to the generated video
  blob: Blob; // Video blob
  objectUrl: string; // Blob object URL for local playback
}

/**
 * Generate video using OpenAI's Sora Turbo model
 *
 * Supports both text-to-video and image-to-video generation.
 * Fast generation (45 seconds) with strong motion quality.
 */
export async function generateVideoWithSora(
  params: SoraVideoGenerationParams,
  apiKey: string
): Promise<SoraVideoGenerationResult> {
  console.log('Starting sora-turbo video generation:', params);

  try {
    // Prepare request body for OpenAI video generation
    const requestBody: any = {
      model: 'sora-turbo-latest',
      prompt: params.prompt,
    };

    // Add image if provided (image-to-video mode)
    if (params.imageUrl) {
      requestBody.image = params.imageUrl;
    }

    // Map aspect ratio to Sora format
    if (params.aspectRatio) {
      const aspectRatioMap: Record<string, string> = {
        '16:9': '1920x1080',
        '9:16': '1080x1920',
        '1:1': '1080x1080',
      };
      requestBody.size = aspectRatioMap[params.aspectRatio] || '1920x1080';
    }

    // Call OpenAI video generation API
    // Using the REST API endpoint directly
    const response = await fetch('https://api.openai.com/v1/videos/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('sora-turbo generation response:', result);

    // Get video URL from response
    // OpenAI returns: { id, object, created, data: [{ url, revised_prompt }] }
    const videoUrl = result.data?.[0]?.url;
    if (!videoUrl) {
      throw new Error('No video URL in sora-turbo response');
    }

    // Fetch the video blob
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch sora-turbo video: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    const objectUrl = URL.createObjectURL(videoBlob);

    console.log('sora-turbo video ready:', { videoUrl, blobSize: videoBlob.size });

    return {
      videoUrl,
      blob: videoBlob,
      objectUrl,
    };
  } catch (error) {
    console.error('Error generating video with sora-turbo:', error);

    if (error && typeof error === 'object' && 'error' in error) {
      const apiError = (error as any).error;
      if (apiError && typeof apiError === 'object' && apiError.message) {
        throw new Error(`sora-turbo generation failed: ${apiError.message}`);
      }
    }

    throw new Error(`sora-turbo generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
