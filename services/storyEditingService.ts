/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Story Editing Service - Agent Hub Integration
 * Uses Agent Hub story-editor agent instead of direct Gemini API calls
 */

import { StoryDraft } from '../types/story-creation';
import { executeStoryEditorAgent, AgentHubAttachment } from './agentHubService';
import { PersonaService } from './personaService';
import type { PersonaId } from '@/types/persona';

export interface StoryEditResult {
  updatedStory: StoryDraft;
  response: string;
  changesSummary: {
    scenesAdded: number;
    scenesRemoved: number;
    scenesModified: number;
    titleChanged: boolean;
  };
}

/**
 * Create a condensed version of the story for editing
 * Removes large data like videos, images, evaluations to stay under token limits
 */
const createCondensedStory = (story: StoryDraft): any => {
  return {
    projectMetadata: story.projectMetadata,
    scenes: story.scenes.map(scene => ({
      id: scene.id,
      title: scene.title,
      duration: scene.duration,
      prompt: scene.prompt,
      cameraAngle: scene.cameraAngle,
      voiceover: scene.voiceover,
      generated: scene.generated,
      settings: scene.settings,
      // Exclude: videoUrl, evaluation, lastFrameDataUrl, and other large data
    })),
    // Exclude: generationMetadata with large aiPrompt strings
  };
};

/**
 * Merge edited scenes back into the full story
 * Preserves all the data we excluded from the condensed version
 */
const mergeEditedStory = (
  originalStory: StoryDraft,
  editedStory: any,
): StoryDraft => {
  return {
    ...originalStory,
    projectMetadata: editedStory.projectMetadata,
    scenes: editedStory.scenes.map((editedScene: any) => {
      // Find the original scene to preserve excluded data
      const originalScene = originalStory.scenes.find(s => s.id === editedScene.id);

      if (originalScene) {
        // Merge edited fields with preserved original data
        return {
          ...originalScene,
          ...editedScene,
        };
      }

      // New scene added by the edit
      return editedScene;
    }),
  };
};

/**
 * Edit a story using Agent Hub story-editor agent
 * @param originalStory - The full story to edit
 * @param editRequest - User's edit request text
 * @param currentShot - Context about the currently viewed shot (optional)
 * @param personaId - Persona ID for style guides (optional)
 * @param referenceImageUrl - URL of the reference image for the current shot (optional)
 */
export const editStory = async (
  originalStory: StoryDraft,
  editRequest: string,
  currentShot?: { id: string; title: string; duration: number; prompt: string; cameraAngle: string; voiceover: string },
  personaId?: string,
  referenceImageUrl?: string,
): Promise<StoryEditResult> => {
  console.log('[Story Editing Service] Starting edit with Agent Hub', personaId ? `with persona: ${personaId}` : '');
  if (referenceImageUrl) {
    console.log('[Story Editing Service] Reference image provided:', referenceImageUrl.substring(0, 100) + '...');
  }

  // Create condensed version to reduce token usage
  const condensedStory = createCondensedStory(originalStory);
  const originalSceneCount = originalStory.scenes.length;

  console.log('[Story Editing Service] Condensed story size:', JSON.stringify(condensedStory).length, 'chars');

  // Build context about current shot if provided
  const currentShotContext = currentShot
    ? `\nCURRENT SHOT CONTEXT:
The user is currently viewing/editing this specific scene:
- Scene ID: ${currentShot.id}
- Scene Title: "${currentShot.title}"
- Duration: ${currentShot.duration}s
- Prompt: "${currentShot.prompt}"
- Camera Angle: "${currentShot.cameraAngle}"
- Voiceover: "${currentShot.voiceover}"

IMPORTANT: When the user says "this shot", "this scene", "the current shot", or similar references, they are referring to the scene with ID "${currentShot.id}". Apply all changes to THIS SPECIFIC SCENE ONLY unless they explicitly mention other scenes.
`
    : '';

  // Build reference image context if provided
  const referenceImageContext = referenceImageUrl
    ? `\nREFERENCE IMAGE:
An image is attached showing the current visual reference or start frame for this shot.
IMPORTANT: Carefully analyze the attached image and use it to inform your edits:
- Consider the visual elements, composition, colors, lighting, and mood in the image
- If the user's edit request mentions visual aspects, align the prompt with what you see in the image
- Use the image as context for character appearance, setting, and atmosphere
- Ensure any prompt modifications maintain consistency with the visual reference
`
    : '';

  // Construct prompt for the story-editor agent
  let prompt = `You are editing a story based on user feedback. Analyze the changes needed and return both the updated story and a user-friendly explanation.

ORIGINAL STORY:
${JSON.stringify(condensedStory, null, 2)}
${currentShotContext}${referenceImageContext}
USER'S EDIT REQUEST:
${editRequest}

Please provide your response in the following JSON format:
{
  "updatedStory": {
    // Complete story object with all modifications applied
    // Include: projectMetadata and scenes array
    // For each scene: id, title, duration, prompt, cameraAngle, voiceover, generated, settings
  },
  "response": "A friendly 2-3 sentence explanation of what changed",
  "changesSummary": {
    "scenesAdded": 0,
    "scenesRemoved": 0,
    "scenesModified": 0,
    "titleChanged": false
  }
}

Rules:
1. Apply the requested changes precisely
2. Maintain story structure and coherence
3. Keep scene IDs consistent unless scenes are added/removed
4. Update changesSummary to reflect actual changes made
5. Provide specific, helpful response text`;

  // Inject persona guides if provided
  if (personaId) {
    const scriptingGuide = await PersonaService.getScriptingGuide(personaId as PersonaId);
    const videoGuide = await PersonaService.getVideoGenerationGuide(personaId as PersonaId);
    prompt = `${prompt}${scriptingGuide}${videoGuide}`;
    console.log('✨ Injected persona scripting and video generation guides for story editing:', personaId);
  }

  try {
    // Create image attachment if reference image is provided
    let imageAttachment: AgentHubAttachment | undefined;
    if (referenceImageUrl) {
      // Check if it's a base64 data URL or a regular URL
      if (referenceImageUrl.startsWith('data:')) {
        // Extract base64 data from data URL
        const matches = referenceImageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          imageAttachment = {
            type: 'base64',
            mimeType: matches[1],
            data: matches[2],
          };
        }
      } else {
        // Regular URL
        imageAttachment = {
          type: 'url',
          mimeType: 'image/png', // Assume PNG for most cases
          url: referenceImageUrl,
        };
      }
      console.log('[Story Editing Service] Created image attachment:', imageAttachment?.type);
    }

    const responseText = await executeStoryEditorAgent(prompt, imageAttachment);
    console.log('[Story Editing Service] Received response from Agent Hub');

    // Parse the JSON response
    const result = JSON.parse(responseText);

    // Validate the response structure
    if (!result.updatedStory || !result.response || !result.changesSummary) {
      throw new Error('Invalid response structure from story-editor agent');
    }

    // Merge edited story back with original data we excluded
    const fullUpdatedStory = mergeEditedStory(originalStory, result.updatedStory);

    console.log('[Story Editing Service] Edit complete:', result.changesSummary);

    return {
      updatedStory: fullUpdatedStory,
      response: result.response,
      changesSummary: result.changesSummary,
    };
  } catch (error) {
    console.error('[Story Editing Service] Error:', error);
    throw new Error(
      `Failed to edit story: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
