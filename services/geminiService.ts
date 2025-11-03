/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Video,
  VideoGenerationReferenceImage,
  VideoGenerationReferenceType,
} from '@google/genai';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {GenerateVideoParams, GenerationMode} from '../types';

/**
 * Text generation parameters for story creation
 */
export interface GenerateTextParams {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string; // Model to use (default: gemini-2.0-flash-exp)
  responseSchema?: any; // JSON schema for structured output
}

// Fix: API key is now handled by process.env.API_KEY, so it's removed from parameters.
export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video}> => {
  console.log('Starting video generation with params:', params);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_GEMINI_API_KEY not found in environment');
  }

  const ai = new GoogleGenAI({apiKey});

  const config: any = {
    numberOfVideos: 1,
    resolution: params.resolution,
  };

  // Conditionally add aspect ratio. It's not used for extending videos.
  if (params.mode !== GenerationMode.EXTEND_VIDEO) {
    config.aspectRatio = params.aspectRatio;
  }

  const generateVideoPayload: any = {
    model: params.model,
    config: config,
  };

  // Only add the prompt if it's not empty, as an empty prompt might interfere with other parameters.
  if (params.prompt) {
    generateVideoPayload.prompt = params.prompt;
  }

  if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
    if (params.startFrame) {
      generateVideoPayload.image = {
        imageBytes: params.startFrame.base64,
        mimeType: params.startFrame.file.type,
      };
      console.log(
        `Generating with start frame: ${params.startFrame.file.name}`,
      );
    }

    const finalEndFrame = params.isLooping
      ? params.startFrame
      : params.endFrame;
    if (finalEndFrame) {
      generateVideoPayload.config.lastFrame = {
        imageBytes: finalEndFrame.base64,
        mimeType: finalEndFrame.file.type,
      };
      if (params.isLooping) {
        console.log(
          `Generating a looping video using start frame as end frame: ${finalEndFrame.file.name}`,
        );
      } else {
        console.log(`Generating with end frame: ${finalEndFrame.file.name}`);
      }
    }
  } else if (params.mode === GenerationMode.REFERENCES_TO_VIDEO) {
    // Portrait mode (9:16) does NOT support config.referenceImages
    // Workaround: Use first reference image as starting frame (image parameter)
    const isPortrait = params.aspectRatio === '9:16';

    if (isPortrait && params.referenceImages && params.referenceImages.length > 0) {
      // Portrait mode: Use first reference image as starting frame
      const firstRef = params.referenceImages[0];
      generateVideoPayload.image = {
        imageBytes: firstRef.base64,
        mimeType: firstRef.file.type,
      };
      console.log(
        `Portrait mode detected: Using first reference image as starting frame: ${firstRef.file.name}`,
      );
      console.log(
        'Note: Portrait mode does not support character references. Using image-to-video instead.',
      );
    } else {
      // Landscape mode: Use config.referenceImages (normal character references)
      const referenceImagesPayload: VideoGenerationReferenceImage[] = [];

      if (params.referenceImages) {
        for (const img of params.referenceImages) {
          console.log(`Adding reference image: ${img.file.name}`);
          referenceImagesPayload.push({
            image: {
              imageBytes: img.base64,
              mimeType: img.file.type,
            },
            referenceType: VideoGenerationReferenceType.ASSET,
          });
        }
      }

      if (params.styleImage) {
        console.log(
          `Adding style image as a reference: ${params.styleImage.file.name}`,
        );
        referenceImagesPayload.push({
          image: {
            imageBytes: params.styleImage.base64,
            mimeType: params.styleImage.file.type,
          },
          referenceType: VideoGenerationReferenceType.STYLE,
        });
      }

      if (referenceImagesPayload.length > 0) {
        generateVideoPayload.config.referenceImages = referenceImagesPayload;
      }
    }
  } else if (params.mode === GenerationMode.EXTEND_VIDEO) {
    if (params.inputVideoObject) {
      generateVideoPayload.video = params.inputVideoObject;
      console.log(`Generating extension from input video object.`);
    } else {
      throw new Error('An input video object is required to extend a video.');
    }
  }

  console.log('Submitting video generation request...', generateVideoPayload);

  let operation;
  try {
    operation = await ai.models.generateVideos(generateVideoPayload);
    console.log('Video generation operation started:', operation);
  } catch (error) {
    console.error('Failed to submit video generation request:', error);
    console.error('Request payload:', JSON.stringify(generateVideoPayload, null, 2));

    // Provide detailed error information
    if (error instanceof Error) {
      throw new Error(`Video generation API call failed: ${error.message}`);
    }
    throw new Error('Video generation API call failed with unknown error');
  }

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log('...Generating...');
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  if (operation?.response) {
    const videos = operation.response.generatedVideos;

    if (!videos || videos.length === 0) {
      console.error('Operation completed but no videos generated:', JSON.stringify(operation, null, 2));

      // Check if there's an error in the operation
      if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message || JSON.stringify(operation.error)}`);
      }

      // Check for RAI (Responsible AI) filtering
      if (operation.response.raiMediaFilteredCount && operation.response.raiMediaFilteredCount > 0) {
        const reasons = operation.response.raiMediaFilteredReasons || [];
        const reasonText = reasons.join(' ');
        throw new Error(`Content filtered by safety systems: ${reasonText}`);
      }

      throw new Error('No videos were generated. The operation completed but returned no videos.');
    }

    const firstVideo = videos[0];
    if (!firstVideo?.video?.uri) {
      throw new Error('Generated video is missing a URI.');
    }
    const videoObject = firstVideo.video;

    const url = decodeURIComponent(videoObject.uri);
    console.log('Fetching video from:', url);

    let res;
    try {
      res = await fetch(`${url}&key=${apiKey}`);
    } catch (error) {
      console.error('Network error while fetching generated video:', error);
      throw new Error(`Network error fetching video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch video: ${res.status} ${res.statusText}`);
    }

    const videoBlob = await res.blob();
    const objectUrl = URL.createObjectURL(videoBlob);

    return {objectUrl, blob: videoBlob, uri: url, video: videoObject};
  } else {
    console.error('Operation failed:', operation);
    throw new Error('No videos generated.');
  }
};

/**
 * Generate text using Gemini 2.0 Flash Exp
 * Used for story generation with JSON output
 */
export const generateText = async (
  params: GenerateTextParams,
): Promise<string> => {
  const modelName = params.model ?? 'gemini-2.0-flash';
  console.log(`Starting text generation with ${modelName}`);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_GEMINI_API_KEY not found in environment');
  }

  // Use @google/generative-ai SDK for text generation
  const genAI = new GoogleGenerativeAI(apiKey);

  const generationConfig: any = {
    temperature: params.temperature ?? 0.7,
    maxOutputTokens: params.maxTokens ?? 2048,
  };

  // Add structured JSON output if schema provided
  if (params.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = params.responseSchema;
    console.log('Using structured JSON output with response schema');
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });

  console.log('Submitting text generation request...');
  const result = await model.generateContent(params.prompt);
  const response = result.response;
  const text = response.text();

  if (text) {
    console.log('Text generation complete');
    return text;
  } else {
    console.error('Text generation failed:', response);
    throw new Error('No text generated');
  }
};
