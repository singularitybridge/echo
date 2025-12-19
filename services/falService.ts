/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { fal } from "@fal-ai/client";
import { GenerateVideoParams, GenerationMode } from '../types';

/**
 * Generate video using Fal.ai Veo 3.1 API
 * This is the primary video generation service that replaces Gemini due to quota limits
 */
export const generateVideoWithFal = async (
  params: GenerateVideoParams,
): Promise<{ objectUrl: string; blob: Blob; url: string }> => {
  console.log('Starting Fal.ai video generation with params:', params);

  const falKey = process.env.NEXT_PUBLIC_FAL_KEY;
  if (!falKey) {
    throw new Error('NEXT_PUBLIC_FAL_KEY not found in environment');
  }

  // Configure Fal.ai client
  fal.config({ credentials: falKey });

  // Upload reference images to Fal.ai storage and get URLs
  const imageUrls: string[] = [];

  if (params.mode === GenerationMode.REFERENCES_TO_VIDEO && params.referenceImages) {
    // Fal.ai Veo 3.1 API supports maximum 3 reference images
    const maxReferenceImages = 3;
    const imagesToUpload = params.referenceImages.slice(0, maxReferenceImages);
    console.log(`Uploading ${imagesToUpload.length} reference images to Fal.ai (max ${maxReferenceImages})`);

    for (let i = 0; i < imagesToUpload.length; i++) {
      const img = imagesToUpload[i];
      try {
        // Convert base64 to blob
        const base64Data = img.base64.split(',')[1] || img.base64;
        const byteString = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);

        for (let j = 0; j < byteString.length; j++) {
          uint8Array[j] = byteString.charCodeAt(j);
        }

        const blob = new Blob([uint8Array], { type: img.file.type });

        // Upload to Fal.ai storage with unique filename
        const uniqueFilename = `reference-${i + 1}-${Date.now()}.png`;
        const file = new File([blob], uniqueFilename, { type: img.file.type });
        const uploadedUrl = await fal.storage.upload(file);
        imageUrls.push(uploadedUrl);
        console.log(`Uploaded reference image ${i + 1}/${imagesToUpload.length} to Fal.ai`);
      } catch (error) {
        console.error(`Failed to upload reference image ${i + 1}:`, error);
        throw error;
      }
    }
  } else if (params.mode === GenerationMode.FRAMES_TO_VIDEO && params.startFrame) {
    // For image-to-video mode, use the start frame as the reference image
    try {
      const base64Data = params.startFrame.base64.split(',')[1] || params.startFrame.base64;
      const byteString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);

      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }

      const blob = new Blob([uint8Array], { type: params.startFrame.file.type });

      // Upload to Fal.ai storage with unique filename
      const uniqueFilename = `start-frame-${Date.now()}.png`;
      const file = new File([blob], uniqueFilename, { type: params.startFrame.file.type });
      const uploadedUrl = await fal.storage.upload(file);
      imageUrls.push(uploadedUrl);
      console.log(`Uploaded start frame to Fal.ai`);
    } catch (error) {
      console.error('Failed to upload start frame:', error);
      throw error;
    }
  }

  if (imageUrls.length === 0) {
    throw new Error('No reference images provided for Fal.ai video generation');
  }

  // Map duration (default to 8 seconds)
  let duration: "4s" | "6s" | "8s" = "8s";

  // Determine endpoint and prepare request payload based on mode
  let endpoint: string;
  let input: any;

  // Build negative prompt for static camera if requested
  const negativePrompt = params.cameraMovement === 'static/fixed'
    ? 'camera movement, camera motion, camera pan, camera tilt, camera zoom, dolly, tracking shot, crane shot, shaky cam, handheld'
    : undefined;

  if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
    // Use image-to-video endpoint for single frame (supports aspect_ratio)
    endpoint = "fal-ai/veo3.1/image-to-video";
    input = {
      image_url: imageUrls[0], // Single image URL
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio === '9:16' ? '9:16' : '16:9',
      duration,
      resolution: (params.resolution === '1080p' ? '1080p' : '720p') as '720p' | '1080p',
      generate_audio: true,
      ...(negativePrompt && { negative_prompt: negativePrompt }),
    };
  } else {
    // Use reference-to-video endpoint for multiple references (no aspect_ratio support)
    endpoint = "fal-ai/veo3.1/reference-to-video";
    input = {
      image_urls: imageUrls,
      prompt: params.prompt,
      duration,
      resolution: (params.resolution === '1080p' ? '1080p' : '720p') as '720p' | '1080p',
      generate_audio: true,
      ...(negativePrompt && { negative_prompt: negativePrompt }),
    };
  }

  console.log('Submitting Fal.ai video generation request...');
  console.log('Endpoint:', endpoint);
  console.log('Prompt:', params.prompt);
  console.log('Duration:', duration);
  console.log('Resolution:', input.resolution);
  console.log('Aspect Ratio:', params.aspectRatio);
  console.log('Reference images:', imageUrls.length);
  console.log('Camera Movement:', params.cameraMovement || 'dynamic');
  if (negativePrompt) {
    console.log('Negative Prompt:', negativePrompt);
  }

  let result;
  try {
    // Use fal.subscribe for async operation with automatic polling
    result = await fal.subscribe(endpoint, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log('Fal.ai: Video generation in progress...');
        }
        if (update.status === 'IN_QUEUE') {
          console.log(`Fal.ai: Queued at position ${(update as any).position || 'unknown'}`);
        }
      },
    });

    console.log('Fal.ai video generation complete');
  } catch (error) {
    console.error('Failed to generate video with Fal.ai:', error);

    // Preserve Fal.ai error details for better error messages in UI
    if (error && typeof error === 'object' && 'body' in error) {
      const falError = error as any;
      const errorDetails = {
        name: falError.name || 'FalError',
        status: falError.status,
        message: falError.body?.detail?.[0]?.msg || 'Unknown error',
        type: falError.body?.detail?.[0]?.type,
        input: falError.body?.detail?.[0]?.input,
        url: falError.body?.detail?.[0]?.url,
      };

      const enhancedError = new Error(errorDetails.message);
      (enhancedError as any).falDetails = errorDetails;
      throw enhancedError;
    }

    if (error instanceof Error) {
      throw new Error(`Fal.ai video generation failed: ${error.message}`);
    }
    throw new Error('Fal.ai video generation failed with unknown error');
  }

  if (!result.data?.video?.url) {
    console.error('Fal.ai result:', result);
    throw new Error('Fal.ai video generation completed but no video URL returned');
  }

  const videoUrl = result.data.video.url;
  console.log('Fetching video from Fal.ai:', videoUrl);

  // Fetch the video from Fal.ai URL
  let res;
  try {
    res = await fetch(videoUrl);
  } catch (error) {
    console.error('Network error while fetching Fal.ai video:', error);
    throw new Error(`Network error fetching video: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch video from Fal.ai: ${res.status} ${res.statusText}`);
  }

  const videoBlob = await res.blob();
  const objectUrl = URL.createObjectURL(videoBlob);

  console.log('Fal.ai video generation successful, created blob URL');
  return { objectUrl, blob: videoBlob, url: videoUrl };
};
