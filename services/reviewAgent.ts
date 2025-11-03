/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {generateText} from './geminiService';
import {StoryDraft} from '../types/story-creation';

/**
 * Analyze changes between two story versions
 */
const analyzeChanges = (originalStory: StoryDraft, refinedStory: StoryDraft) => {
  const changes: any = {
    scenesAdded: 0,
    scenesRemoved: 0,
    scenesModified: 0,
    titleChanged: false,
    characterNameChanged: false,
    modifiedScenes: [],
  };

  // Check title change
  if (originalStory.projectMetadata.title !== refinedStory.projectMetadata.title) {
    changes.titleChanged = true;
  }

  // Check character name change
  if (originalStory.projectMetadata.character !== refinedStory.projectMetadata.character) {
    changes.characterNameChanged = true;
  }

  // Analyze scene changes
  const originalSceneIds = new Set(originalStory.scenes.map(s => s.id));
  const refinedSceneIds = new Set(refinedStory.scenes.map(s => s.id));

  // Count added scenes
  for (const id of refinedSceneIds) {
    if (!originalSceneIds.has(id)) {
      changes.scenesAdded++;
    }
  }

  // Count removed scenes
  for (const id of originalSceneIds) {
    if (!refinedSceneIds.has(id)) {
      changes.scenesRemoved++;
    }
  }

  // Check modified scenes
  for (const refinedScene of refinedStory.scenes) {
    const originalScene = originalStory.scenes.find(s => s.id === refinedScene.id);
    if (originalScene) {
      if (
        originalScene.title !== refinedScene.title ||
        originalScene.prompt !== refinedScene.prompt ||
        originalScene.voiceover !== refinedScene.voiceover ||
        originalScene.cameraAngle !== refinedScene.cameraAngle
      ) {
        changes.scenesModified++;
        changes.modifiedScenes.push({
          id: refinedScene.id,
          title: refinedScene.title,
        });
      }
    }
  }

  return changes;
};

/**
 * Review Agent
 *
 * Uses Gemini 2.0 Flash Exp to generate user-friendly responses explaining changes.
 *
 * @param originalStory - Story before changes
 * @param refinedStory - Story after changes
 * @param userFeedback - User's original request
 * @returns Promise<{response: string, changesSummary: any}> - User-facing response and structured changes
 */
export const generateReview = async (
  originalStory: StoryDraft,
  refinedStory: StoryDraft,
  userFeedback: string,
): Promise<{response: string; changesSummary: any}> => {
  console.log('[Review Agent] Analyzing changes...');

  const changesSummary = analyzeChanges(originalStory, refinedStory);

  const prompt = `You are a friendly review agent explaining story changes to a user.

USER REQUEST:
"${userFeedback}"

CHANGES MADE:
- Scenes added: ${changesSummary.scenesAdded}
- Scenes removed: ${changesSummary.scenesRemoved}
- Scenes modified: ${changesSummary.scenesModified}
- Title changed: ${changesSummary.titleChanged}
- Character name changed: ${changesSummary.characterNameChanged}

ORIGINAL STORY TITLE: "${originalStory.projectMetadata.title}"
REFINED STORY TITLE: "${refinedStory.projectMetadata.title}"
ORIGINAL SCENE COUNT: ${originalStory.scenes.length}
REFINED SCENE COUNT: ${refinedStory.scenes.length}

${changesSummary.modifiedScenes.length > 0 ? `MODIFIED SCENES:\n${changesSummary.modifiedScenes.map((s: any) => `- ${s.title}`).join('\n')}` : ''}

INSTRUCTIONS:
Generate a brief, conversational response (2-3 sentences) that:
1. Acknowledges what the user requested
2. Explains what specific changes were made
3. Uses a friendly, helpful tone
4. Is specific about scene titles/numbers when relevant

EXAMPLES:
- "I've removed Scene 4 'The Empty Walls' from your story as requested. The story now ends with Scene 3 for a more impactful conclusion."
- "I've added a new Scene 3 where the character discovers a hidden clue. The remaining scenes have been renumbered accordingly."
- "I've updated the character name from Sarah to Emma throughout the entire story, including the title, all prompts, and dialogue."
- "I've made Scene 2 darker by adjusting the lighting description and adding more suspenseful dialogue."

Return ONLY the response text, no JSON or markdown.`;

  try {
    const response = await generateText({
      prompt,
      temperature: 0.7, // Medium temperature for natural language
      maxTokens: 200,
      model: 'gemini-2.0-flash', // Use stable Gemini 2.0 Flash
    });

    const userResponse = response.trim();

    console.log('[Review Agent] Generated response:', userResponse.substring(0, 100));

    return {
      response: userResponse,
      changesSummary,
    };
  } catch (error) {
    console.error('[Review Agent] Error:', error);

    // Fallback response if review agent fails
    return {
      response: "I've updated your story based on your feedback!",
      changesSummary,
    };
  }
};
