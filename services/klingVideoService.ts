/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fal from "@fal-ai/serverless-client";

export interface KlingVideoGenerationParams {
  prompt: string;
  imageUrl: string; // Start frame image URL
  aspectRatio?: '16:9' | '9:16' | '1:1';
  duration?: number; // Duration in seconds (5 or 10 for kling)
}

export interface KlingVideoGenerationResult {
  videoUrl: string; // URL to the generated video
  blob: Blob; // Video blob
  objectUrl: string; // Blob object URL for local playback
}

/**
 * Generate video using fal.ai's kling-v2.5-turbo-pro model
 *
 * This is an image-to-video model that animates a static image into a video.
 * Balanced speed and quality (60 seconds generation time).
 */
export async function generateVideoWithKling(
  params: KlingVideoGenerationParams,
  apiKey: string
): Promise<KlingVideoGenerationResult> {
  console.log('Starting kling-v2.5-turbo-pro video generation:', params);

  // Configure fal client
  fal.config({
    credentials: apiKey,
  });

  try {
    // Call fal.ai kling-video API
    // Using kling-video/v1/standard/image-to-video endpoint
    const result = await fal.subscribe("fal-ai/kling-video/v1/standard/image-to-video", {
      input: {
        image_url: params.imageUrl,
        prompt: params.prompt,
        aspect_ratio: params.aspectRatio || '16:9',
        duration: params.duration || 5, // 5 or 10 seconds
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(`kling-v2.5-turbo-pro generation progress: ${update.logs?.map(l => l.message).join('\n')}`);
        }
      },
    });

    console.log('kling-v2.5-turbo-pro generation complete:', result);

    // Extract video URL from result
    // fal.ai returns { video: { url: string } }
    const videoUrl = (result as any).video?.url;
    if (!videoUrl) {
      throw new Error('No video URL in kling-v2.5-turbo-pro result');
    }

    // Fetch the video blob
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch kling-v2.5-turbo-pro video: ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    const objectUrl = URL.createObjectURL(videoBlob);

    console.log('kling-v2.5-turbo-pro video ready:', { videoUrl, blobSize: videoBlob.size });

    return {
      videoUrl,
      blob: videoBlob,
      objectUrl,
    };
  } catch (error) {
    console.error('Error generating video with kling-v2.5-turbo-pro:', error);

    if (error && typeof error === 'object' && 'body' in error) {
      const body = (error as any).body;
      if (body && typeof body === 'object' && body.detail) {
        throw new Error(`kling-v2.5-turbo-pro generation failed: ${body.detail}`);
      }
    }

    throw new Error(`kling-v2.5-turbo-pro generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
