/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fal from "@fal-ai/serverless-client";

export interface WanVideoGenerationParams {
  prompt: string;
  imageUrl: string; // Start frame image URL
  aspectRatio?: '16:9' | '9:16' | '1:1';
  duration?: number; // Duration in seconds (max 5 for wan-2.5-i2v)
}

export interface WanVideoGenerationResult {
  videoUrl: string; // URL to the generated video
  blob: Blob; // Video blob
  objectUrl: string; // Blob object URL for local playback
}

/**
 * Generate video using fal.ai's wan-2.5-i2v model
 *
 * This is an image-to-video model that animates a static image into a video.
 * Optimized for rapid iteration (30 seconds generation time).
 */
export async function generateVideoWithWan(
  params: WanVideoGenerationParams,
  apiKey: string
): Promise<WanVideoGenerationResult> {
  console.log('Starting wan-2.5-i2v video generation:', params);

  // Configure fal client
  fal.config({
    credentials: apiKey,
  });

  try {
    // Call fal.ai wan-i2v API
    // Based on the fal.ai documentation for wan-i2v model
    const result = await fal.subscribe("fal-ai/wan-i2v", {
      input: {
        image_url: params.imageUrl,
        prompt: params.prompt,
        // Note: aspect_ratio might not be supported, check fal.ai docs
        // duration: params.duration || 5, // Check if supported
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(`wan-2.5-i2v generation progress: ${update.logs?.map(l => l.message).join('\n')}`);
        }
      },
    });

    console.log('wan-2.5-i2v generation complete:', result);

    // Extract video URL from result
    // fal.ai returns { video: { url: string }, seed: number }
    const videoUrl = (result as any).video?.url;
    if (!videoUrl) {
      throw new Error('No video URL in wan-2.5-i2v result');
    }

    // Fetch the video blob
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch wan-2.5-i2v video: ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    const objectUrl = URL.createObjectURL(videoBlob);

    console.log('wan-2.5-i2v video ready:', { videoUrl, blobSize: videoBlob.size });

    return {
      videoUrl,
      blob: videoBlob,
      objectUrl,
    };
  } catch (error) {
    console.error('Error generating video with wan-2.5-i2v:', error);

    if (error && typeof error === 'object' && 'body' in error) {
      const body = (error as any).body;
      if (body && typeof body === 'object' && body.detail) {
        throw new Error(`wan-2.5-i2v generation failed: ${body.detail}`);
      }
    }

    throw new Error(`wan-2.5-i2v generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
