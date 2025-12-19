/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { generateVideoWithFal } from './falService';
import {
  GenerateVideoParams,
  GenerationMode,
  AspectRatio,
  Resolution,
  VeoModel,
  ImageFile,
} from '../types';
import { GeneratedImage } from './imageService';
import { trackVideoGeneration } from './costTrackingService';

export interface GeneratedVideo {
  objectUrl: string;
  blob: Blob;
  uri: string;
}

export interface VideoGenerationSettings {
  model?: VeoModel;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  isLooping?: boolean;
  camera_movement?: 'static/fixed' | 'dynamic' | string;
}

/**
 * Generate a video with optional character reference images, start/end frames, and custom settings
 * @param prompt - Text prompt for video generation
 * @param characterReferences - Optional character reference images for consistency
 * @param settings - Optional generation settings (model, aspect ratio, resolution, looping)
 * @param startFrameDataUrl - Optional data URL of start frame from previous scene (for shot continuity)
 * @param endFrameDataUrl - Optional data URL of end frame target (for transitions and controlled generation)
 */
export const generateVideo = async (
  prompt: string,
  characterReferences?: GeneratedImage[],
  settings?: VideoGenerationSettings,
  startFrameDataUrl?: string,
  endFrameDataUrl?: string,
): Promise<GeneratedVideo> => {
  console.log('Generating video with prompt:', prompt);
  console.log('Character references:', characterReferences?.length || 0);
  console.log('Start frame provided:', !!startFrameDataUrl);
  console.log('End frame provided:', !!endFrameDataUrl);
  console.log('Settings:', settings);

  const aspectRatio = settings?.aspectRatio || AspectRatio.LANDSCAPE;

  // Convert GeneratedImage to ImageFile format
  const referenceImages: ImageFile[] = characterReferences
    ? await Promise.all(
        characterReferences.map(async (img) => {
          return {
            file: new File([img.blob], 'reference.png', { type: img.mimeType }),
            base64: img.imageBytes,
          };
        })
      )
    : [];

  // Convert start frame data URL or file path to ImageFile if provided
  let startFrame: ImageFile | null = null;
  if (startFrameDataUrl) {
    let blob: Blob;
    let base64Data: string;
    let mimeType: string;

    // Check if it's a data URL or a file path
    if (startFrameDataUrl.startsWith('data:')) {
      // It's a data URL (legacy format)
      base64Data = startFrameDataUrl.split(',')[1];
      mimeType = startFrameDataUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
      blob = await fetch(startFrameDataUrl).then(r => r.blob());
    } else {
      // It's a file path (new format like /frames/project-id/scene-id-last.png)
      // Fetch the image from the public path
      const response = await fetch(startFrameDataUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch start frame from ${startFrameDataUrl}: ${response.statusText}`);
      }
      blob = await response.blob();
      mimeType = blob.type || 'image/png';

      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
      base64Data = btoa(binary);
    }

    startFrame = {
      file: new File([blob], 'start-frame.png', { type: mimeType }),
      base64: base64Data,
    };
    console.log('Converted start frame to ImageFile for shot continuity');
  }

  // Convert end frame data URL or file path to ImageFile if provided
  let endFrame: ImageFile | null = null;
  if (endFrameDataUrl) {
    let blob: Blob;
    let base64Data: string;
    let mimeType: string;

    // Check if it's a data URL or a file path
    if (endFrameDataUrl.startsWith('data:')) {
      // It's a data URL (legacy format)
      base64Data = endFrameDataUrl.split(',')[1];
      mimeType = endFrameDataUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
      blob = await fetch(endFrameDataUrl).then(r => r.blob());
    } else {
      // It's a file path (new format like /frames/project-id/scene-id-first.png or /assets/asset-id.png)
      // Fetch the image from the public path
      const response = await fetch(endFrameDataUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch end frame from ${endFrameDataUrl}: ${response.statusText}`);
      }
      blob = await response.blob();
      mimeType = blob.type || 'image/png';

      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
      base64Data = btoa(binary);
    }

    endFrame = {
      file: new File([blob], 'end-frame.png', { type: mimeType }),
      base64: base64Data,
    };
    console.log('Converted end frame to ImageFile for transition/target');
  }

  // Use FRAMES_TO_VIDEO mode when start frame is provided (shot continuity)
  // Use REFERENCES_TO_VIDEO mode when MULTIPLE references are provided (character consistency)
  // Use FRAMES_TO_VIDEO for single reference - user selected it as "Start Frame"
  // For portrait aspect ratio (9:16), always use FRAMES_TO_VIDEO with single reference
  // because reference-to-video doesn't support aspect_ratio parameter
  // Use TEXT_TO_VIDEO mode otherwise
  let mode: GenerationMode;
  if (startFrame) {
    mode = GenerationMode.FRAMES_TO_VIDEO;
  } else if (referenceImages.length > 0) {
    // For single reference image, treat it as a start frame (user explicitly selected it)
    // This ensures "Start Frame" selection in UI actually uses the image as starting frame
    if (referenceImages.length === 1) {
      mode = GenerationMode.FRAMES_TO_VIDEO;
      // Convert single reference to startFrame
      const firstRef = referenceImages[0];
      startFrame = {
        file: firstRef.file,
        base64: firstRef.base64,
      };
      console.log('Single reference: Using as start frame (user selected as Start Frame)');
    } else if (aspectRatio === AspectRatio.PORTRAIT) {
      // For portrait videos with multiple refs, use image-to-video with first reference only
      // This ensures correct aspect ratio at the cost of using only 1 reference image
      mode = GenerationMode.FRAMES_TO_VIDEO;
      // Convert first reference to startFrame for portrait mode
      const firstRef = referenceImages[0];
      startFrame = {
        file: firstRef.file,
        base64: firstRef.base64,
      };
      console.log('Portrait mode with multiple refs: Using first reference as start frame');
    } else {
      // Multiple references in non-portrait mode: use reference-to-video for character consistency
      mode = GenerationMode.REFERENCES_TO_VIDEO;
    }
  } else {
    mode = GenerationMode.TEXT_TO_VIDEO;
  }

  console.log(`Using generation mode: ${mode}`);

  const params: GenerateVideoParams = {
    mode,
    model: settings?.model || VeoModel.VEO,
    prompt,
    aspectRatio,
    resolution: settings?.resolution || Resolution.P720,
    startFrame,
    endFrame,
    referenceImages,
    styleImage: null,
    inputVideo: null,
    inputVideoObject: null,
    isLooping: settings?.isLooping || false,
    cameraMovement: settings?.camera_movement,
  };

  // Use Fal.ai for video generation (replaced Gemini due to quota limits)
  console.log('Using Fal.ai for video generation');
  const result = await generateVideoWithFal(params);

  // Track cost for this generation
  const duration = 8; // Fal.ai default is 8 seconds
  const resolutionKey = params.resolution === Resolution.P1080 ? '1080p' : '720p';
  const modelName = params.model === VeoModel.VEO ? 'veo-3.1' : 'veo-2';

  trackVideoGeneration(duration, resolutionKey, modelName);
  console.log('Video generation cost tracked:', { duration, resolution: resolutionKey, model: modelName });

  return {
    objectUrl: result.objectUrl,
    blob: result.blob,
    uri: result.url, // Fal.ai returns 'url' instead of 'uri'
  };
};
