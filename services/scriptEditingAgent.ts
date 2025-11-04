/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {generateText} from './geminiService';
import {StoryDraft} from '../types/story-creation';

/**
 * JSON Schema for StoryDraft - ensures Gemini returns valid JSON structure
 */
const storyDraftSchema = {
  type: 'OBJECT' as const,
  properties: {
    projectMetadata: {
      type: 'OBJECT' as const,
      properties: {
        id: {type: 'STRING' as const},
        title: {type: 'STRING' as const},
        description: {type: 'STRING' as const},
        type: {type: 'STRING' as const},
        character: {type: 'STRING' as const},
        aspectRatio: {type: 'STRING' as const},
        defaultModel: {type: 'STRING' as const},
        defaultResolution: {type: 'STRING' as const},
      },
      required: ['title', 'description', 'type', 'aspectRatio', 'defaultModel', 'defaultResolution'],
    },
    scenes: {
      type: 'ARRAY' as const,
      items: {
        type: 'OBJECT' as const,
        properties: {
          id: {type: 'STRING' as const},
          title: {type: 'STRING' as const},
          duration: {type: 'NUMBER' as const},
          prompt: {type: 'STRING' as const},
          cameraAngle: {type: 'STRING' as const},
          voiceover: {type: 'STRING' as const},
          generated: {type: 'BOOLEAN' as const},
          settings: {
            type: 'OBJECT' as const,
            properties: {
              model: {type: 'STRING' as const},
              resolution: {type: 'STRING' as const},
              isLooping: {type: 'BOOLEAN' as const},
            },
            required: ['model', 'resolution', 'isLooping'],
          },
        },
        required: ['id', 'title', 'duration', 'prompt', 'cameraAngle', 'voiceover', 'generated', 'settings'],
      },
    },
  },
  required: ['projectMetadata', 'scenes'],
};

/**
 * Parse JSON response from AI, handling markdown code blocks and malformed quotes
 */
const parseAIResponse = (response: string): any => {
  let cleaned = response.trim();

  // Remove ```json and ``` markers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }

  cleaned = cleaned.trim();

  // Try to parse first
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('[parseAIResponse] Initial JSON parse failed, attempting to fix malformed quotes...');

    // Common issue: voiceover fields with unescaped single quotes like:
    // "voiceover":"'Eleanor says, \"dialogue\""
    // Fix by removing leading single quotes in voiceover fields
    const fixedJson = cleaned.replace(
      /"voiceover"\s*:\s*"'([^"]+)"/g,
      '"voiceover":"$1"'
    );

    try {
      return JSON.parse(fixedJson);
    } catch (secondError) {
      console.error('[parseAIResponse] Second parse attempt failed');
      console.error('[parseAIResponse] Original response (first 500 chars):', cleaned.substring(0, 500));
      throw new Error(
        `AI returned malformed JSON: ${error instanceof Error ? error.message : 'Parse error'}`
      );
    }
  }
};

/**
 * Script Editing Agent
 *
 * Uses Gemini 2.0 Flash Thinking Exp for precise, logical story modifications.
 *
 * @param existingStory - Current story structure
 * @param userFeedback - User's modification request
 * @returns Promise<StoryDraft> - Updated story structure
 */
export const editScript = async (
  existingStory: StoryDraft,
  userFeedback: string,
): Promise<StoryDraft> => {
  console.log('[Script Editing Agent] Processing request:', userFeedback);

  // Strip out large data fields to reduce token count
  // Only include fields needed for script editing
  const sanitizedStory = {
    projectMetadata: existingStory.projectMetadata,
    scenes: existingStory.scenes.map(scene => ({
      id: scene.id,
      title: scene.title,
      duration: scene.duration,
      prompt: scene.prompt,
      cameraAngle: scene.cameraAngle,
      voiceover: scene.voiceover,
      generated: scene.generated,
      settings: scene.settings,
      // Exclude: videoUrl, evaluation, lastFrameDataUrl, assets - not needed for editing
    })),
  };

  // Safely stringify the sanitized story
  let storyJson: string;
  try {
    storyJson = JSON.stringify(sanitizedStory, null, 2);
    console.log('[Script Editing Agent] Story JSON size:', storyJson.length, 'characters');
  } catch (error) {
    console.error('[Script Editing Agent] Error stringifying input story:', error);
    throw new Error('Invalid story format - unable to serialize story data');
  }

  const prompt = `You are a precise script editing agent. Your job is to modify a story structure based on user feedback.

CURRENT STORY:
${storyJson}

USER FEEDBACK:
"${userFeedback}"

INSTRUCTIONS:
1. Apply ONLY the changes explicitly requested by the user
2. Preserve the story structure with projectMetadata and scenes array
3. Keep all scene IDs unchanged unless adding/removing scenes
4. When adding scenes, generate new unique IDs (scene-N format)
5. When removing scenes, delete from array completely
6. When modifying scenes, only change the requested properties
7. Support any number of scenes (1 or more)
8. Maintain narrative coherence when reordering or adding scenes

IMPORTANT RULES:
- If user says "remove last scene" → delete the last scene from scenes array
- If user says "add a scene where..." → insert new scene with all required fields
- If user says "change character name" → update everywhere (title, description, character field, all prompts, all voiceovers)
- If user says "make scene X darker" → modify that scene's prompt and voiceover
- If user says "swap scene 2 and 3" → reorder the scenes in the array
- Keep projectMetadata.id and all original scene IDs unless creating new scenes

REQUIRED SCENE STRUCTURE:
{
  "id": "scene-N",
  "title": "Scene Title",
  "duration": 8,
  "prompt": "Visual description for video generation",
  "cameraAngle": "Medium shot | Close-up | Wide shot | etc.",
  "voiceover": "Character says, \\"dialogue\\" (no subtitles)" or "",
  "generated": false,
  "settings": {
    "model": "Veo 3.1",
    "resolution": "720p",
    "isLooping": false
  }
}

Return ONLY the complete modified story as JSON, with no markdown code blocks or additional text.`;

  try {
    const response = await generateText({
      prompt,
      temperature: 0.2, // Very low temperature for precise edits
      maxTokens: 3000,
      model: 'gemini-2.0-flash', // Use stable Gemini 2.0 Flash
      responseSchema: storyDraftSchema, // Enforce valid JSON structure
    });

    console.log('[Script Editing Agent] Raw response length:', response.length);

    // Parse JSON response (should be valid with schema enforcement)
    const refinedStory = JSON.parse(response) as StoryDraft;

    // Validate story structure
    if (!refinedStory.projectMetadata || !refinedStory.scenes || refinedStory.scenes.length === 0) {
      throw new Error('Invalid story structure returned by editing agent');
    }

    // Validate all scenes have required fields
    for (const scene of refinedStory.scenes) {
      if (!scene.id || !scene.title || !scene.prompt || !scene.cameraAngle) {
        throw new Error(`Invalid scene structure: missing required fields in ${scene.id || 'unknown scene'}`);
      }
    }

    // Merge back the stripped data (videoUrl, evaluation, etc.) from original scenes
    // This preserves data that wasn't sent to the agent
    const mergedScenes = refinedStory.scenes.map(refinedScene => {
      const originalScene = existingStory.scenes.find(s => s.id === refinedScene.id);
      if (originalScene) {
        // Scene was modified - merge with original data
        return {
          ...refinedScene,
          videoUrl: originalScene.videoUrl, // Preserve video URL
          evaluation: originalScene.evaluation, // Preserve evaluation
          lastFrameDataUrl: originalScene.lastFrameDataUrl, // Preserve last frame
        };
      }
      // New scene - return as is
      return refinedScene;
    });

    console.log('[Script Editing Agent] Edit complete:', {
      scenesCount: refinedStory.scenes.length,
      title: refinedStory.projectMetadata.title,
    });

    return {
      ...refinedStory,
      scenes: mergedScenes,
    };
  } catch (error) {
    console.error('[Script Editing Agent] Error:', error);
    throw new Error(
      `Failed to edit script: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
