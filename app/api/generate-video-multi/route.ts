/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { VideoGenerationModel, VideoGenerationResult } from '@/types/ai-models';
import { generateVideoWithFal } from '@/services/falService';
import { generateVideoWithWan } from '@/services/wanVideoService';
import { generateVideoWithKling } from '@/services/klingVideoService';
import { generateVideoWithSora } from '@/services/soraVideoService';
import {
  GenerateVideoParams,
  GenerationMode,
  AspectRatio,
  Resolution,
  VeoModel,
  ImageFile,
} from '@/types';

// App Router configuration
export const maxDuration = 300; // 5 minutes for video generation
export const dynamic = 'force-dynamic';

/**
 * POST /api/generate-video-multi - Generate videos using multiple AI models in parallel
 *
 * Request body:
 * {
 *   models: VideoGenerationModel[];  // Array of model IDs to use
 *   prompt: string;                   // Video generation prompt
 *   aspectRatio?: string;             // Aspect ratio (default: "16:9")
 *   resolution?: string;              // Resolution (default: "720p")
 *   referenceImages?: Array<{base64: string; mimeType: string}>;  // Character references
 *   startFrameDataUrl?: string;       // Start frame for shot continuity
 *   endFrameDataUrl?: string;         // End frame for transitions and controlled generation
 * }
 *
 * Response:
 * {
 *   results: VideoGenerationResult[];  // Array of results, one per model
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { models, prompt, aspectRatio, resolution, referenceImages, startFrameDataUrl, endFrameDataUrl } = await request.json();

    // Validate required parameters
    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid required parameter: models (array)' },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing required parameter: prompt' },
        { status: 400 }
      );
    }

    // Validate model IDs
    const validModels: VideoGenerationModel[] = ['veo-3.1', 'wan-2.5-i2v', 'kling-v2.5-turbo-pro', 'sora-turbo'];
    const invalidModels = models.filter(
      (model) => !validModels.includes(model as VideoGenerationModel)
    );
    if (invalidModels.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid model IDs: ${invalidModels.join(', ')}`,
          validModels,
        },
        { status: 400 }
      );
    }

    const falKey = process.env.FAL_KEY || process.env.NEXT_PUBLIC_FAL_KEY;
    const openaiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    // Check if any model is requested but API key is missing
    if ((models.includes('veo-3.1') || models.includes('wan-2.5-i2v') || models.includes('kling-v2.5-turbo-pro')) && !falKey) {
      return NextResponse.json(
        { error: 'FAL_KEY or NEXT_PUBLIC_FAL_KEY not configured' },
        { status: 500 }
      );
    }

    if (models.includes('sora-turbo') && !openaiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log(`Generating videos with ${models.length} models: ${models.join(', ')}`);

    // Generate with multiple models in parallel
    const results = await Promise.allSettled(
      models.map(async (modelId): Promise<VideoGenerationResult> => {
        const startTime = Date.now();

        try {
          if (modelId === 'veo-3.1') {
            // Generate with Veo 3.1 (fal.ai)
            const aspectRatioEnum = aspectRatio === '9:16' ? AspectRatio.PORTRAIT :
                                    aspectRatio === '1:1' ? AspectRatio.SQUARE :
                                    AspectRatio.LANDSCAPE;
            const resolutionEnum = resolution === '1080p' ? Resolution.P1080 : Resolution.P720;

            // Convert reference images to ImageFile format
            const refImages: ImageFile[] = referenceImages
              ? referenceImages.map((img: any) => ({
                  file: new File([Buffer.from(img.base64, 'base64')], 'reference.png', { type: img.mimeType }),
                  base64: img.base64,
                }))
              : [];

            // Convert start frame data URL to ImageFile if provided
            let startFrame: ImageFile | null = null;
            if (startFrameDataUrl) {
              const base64Data = startFrameDataUrl.split(',')[1];
              const mimeType = startFrameDataUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
              const blob = await fetch(startFrameDataUrl).then(r => r.blob());
              startFrame = {
                file: new File([blob], 'start-frame.png', { type: mimeType }),
                base64: base64Data,
              };
            }

            // Convert end frame data URL to ImageFile if provided
            let endFrame: ImageFile | null = null;
            if (endFrameDataUrl) {
              const base64Data = endFrameDataUrl.split(',')[1];
              const mimeType = endFrameDataUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
              const blob = await fetch(endFrameDataUrl).then(r => r.blob());
              endFrame = {
                file: new File([blob], 'end-frame.png', { type: mimeType }),
                base64: base64Data,
              };
            }

            // Determine generation mode
            let mode: GenerationMode;
            if (startFrame) {
              mode = GenerationMode.FRAMES_TO_VIDEO;
            } else if (refImages.length > 0) {
              mode = GenerationMode.REFERENCES_TO_VIDEO;
            } else {
              throw new Error('Veo 3.1 requires either a start frame or reference images');
            }

            const params: GenerateVideoParams = {
              mode,
              model: VeoModel.VEO,
              prompt,
              aspectRatio: aspectRatioEnum,
              resolution: resolutionEnum,
              startFrame,
              endFrame,
              referenceImages: refImages,
              styleImage: null,
              inputVideo: null,
              inputVideoObject: null,
              isLooping: false,
            };

            // Use fal.ai instead of Gemini to avoid 429 rate limiting
            const result = await generateVideoWithFal(params);

            const generationTime = (Date.now() - startTime) / 1000;

            // Convert blob to base64 for client-side reconstruction
            const arrayBuffer = await result.blob.arrayBuffer();
            const base64Video = Buffer.from(arrayBuffer).toString('base64');

            return {
              model: 'veo-3.1',
              videoUrl: result.url, // Remote URL from fal.ai
              videoBytes: base64Video, // Base64 video data for client
              mimeType: 'video/mp4',
              loading: false,
              generationTime,
              // Thumbnail will be extracted client-side
            };

          } else if (modelId === 'wan-2.5-i2v') {
            // Generate with wan-2.5-i2v (fal.ai)
            // wan requires a start frame image, so we need to ensure one is provided
            if (!startFrameDataUrl && (!referenceImages || referenceImages.length === 0)) {
              throw new Error('wan-2.5-i2v requires a start frame or reference image');
            }

            // Use start frame if provided, otherwise use first reference image
            const imageDataUrl = startFrameDataUrl || `data:${referenceImages[0].mimeType};base64,${referenceImages[0].base64}`;

            // Upload image to temporary URL (wan needs a URL, not base64)
            // For now, we'll use a base64 data URL directly
            // TODO: Upload to temporary storage and get URL
            const result = await generateVideoWithWan(
              {
                prompt,
                imageUrl: imageDataUrl,
                aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
              },
              falKey!
            );

            const generationTime = (Date.now() - startTime) / 1000;

            // Convert blob to base64 for client-side reconstruction
            const arrayBuffer = await result.blob.arrayBuffer();
            const base64Video = Buffer.from(arrayBuffer).toString('base64');

            return {
              model: 'wan-2.5-i2v',
              videoUrl: result.videoUrl, // Remote URL from fal.ai (not blob URL)
              videoBytes: base64Video, // Base64 video data for client
              mimeType: 'video/mp4',
              loading: false,
              generationTime,
              // Thumbnail will be extracted client-side
            };

          } else if (modelId === 'kling-v2.5-turbo-pro') {
            // Generate with kling-v2.5-turbo-pro (fal.ai)
            // kling requires a start frame image, so we need to ensure one is provided
            if (!startFrameDataUrl && (!referenceImages || referenceImages.length === 0)) {
              throw new Error('kling-v2.5-turbo-pro requires a start frame or reference image');
            }

            // Use start frame if provided, otherwise use first reference image
            const imageDataUrl = startFrameDataUrl || `data:${referenceImages[0].mimeType};base64,${referenceImages[0].base64}`;

            const result = await generateVideoWithKling(
              {
                prompt,
                imageUrl: imageDataUrl,
                aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
                duration: 5, // kling supports 5 or 10 seconds
              },
              falKey!
            );

            const generationTime = (Date.now() - startTime) / 1000;

            // Convert blob to base64 for client-side reconstruction
            const arrayBuffer = await result.blob.arrayBuffer();
            const base64Video = Buffer.from(arrayBuffer).toString('base64');

            return {
              model: 'kling-v2.5-turbo-pro',
              videoUrl: result.videoUrl, // Remote URL from fal.ai
              videoBytes: base64Video, // Base64 video data for client
              mimeType: 'video/mp4',
              loading: false,
              generationTime,
              // Thumbnail will be extracted client-side
            };

          } else if (modelId === 'sora-turbo') {
            // Generate with sora-turbo (OpenAI)
            // Sora supports both text-to-video and image-to-video
            let imageUrl: string | undefined;

            // Use start frame if provided, otherwise use first reference image (if any)
            if (startFrameDataUrl) {
              imageUrl = startFrameDataUrl;
            } else if (referenceImages && referenceImages.length > 0) {
              imageUrl = `data:${referenceImages[0].mimeType};base64,${referenceImages[0].base64}`;
            }

            const result = await generateVideoWithSora(
              {
                prompt,
                imageUrl, // Optional for text-to-video
                aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
                duration: 5, // Sora supports up to 5 seconds for turbo
              },
              openaiKey!
            );

            const generationTime = (Date.now() - startTime) / 1000;

            // Convert blob to base64 for client-side reconstruction
            const arrayBuffer = await result.blob.arrayBuffer();
            const base64Video = Buffer.from(arrayBuffer).toString('base64');

            return {
              model: 'sora-turbo',
              videoUrl: result.videoUrl, // Remote URL from OpenAI
              videoBytes: base64Video, // Base64 video data for client
              mimeType: 'video/mp4',
              loading: false,
              generationTime,
              // Thumbnail will be extracted client-side
            };
          }

          throw new Error(`Unsupported model: ${modelId}`);

        } catch (error) {
          console.error(`Error generating video with ${modelId}:`, error);

          const errorMessage = error instanceof Error ? error.message : String(error);

          return {
            model: modelId as VideoGenerationModel,
            loading: false,
            error: errorMessage,
          };
        }
      })
    );

    // Convert Promise results to VideoGenerationResult[]
    const finalResults: VideoGenerationResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          model: models[index] as VideoGenerationModel,
          loading: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
      }
    });

    console.log(`Successfully generated ${finalResults.filter(r => !r.error).length} videos`);

    return NextResponse.json({
      results: finalResults,
    });
  } catch (error) {
    console.error('Error in generate-video-multi API:', error);

    let errorMessage = 'Internal server error';
    let errorDetails = String(error);

    if (error && typeof error === 'object' && 'body' in error) {
      const body = (error as any).body;
      if (body && typeof body === 'object') {
        if (body.detail) {
          errorMessage = body.detail;
        } else if (body.message) {
          errorMessage = body.message;
        }
        errorDetails = JSON.stringify(body);
      }
    }

    return NextResponse.json(
      { error: errorMessage, details: errorDetails },
      { status: 500 }
    );
  }
}
