/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {executeStoryGenAgent} from './agentHubService';
import {STORY_PROMPTS} from '../constants/storyPrompts';
import {
  QuickPathParams,
  CustomPathParams,
  StoryDraft,
  GenerationMetadata,
} from '../types/story-creation';

/**
 * Parse JSON response from AI, handling markdown code blocks
 */
const parseAIResponse = (response: string): any => {
  // Strip markdown code blocks if present
  let cleaned = response.trim();

  // Remove ```json and ``` markers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7); // Remove ```json
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3); // Remove ```
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3); // Remove trailing ```
  }

  cleaned = cleaned.trim();

  return JSON.parse(cleaned);
};

/**
 * Generate a story using Quick Path (genre + type + energy)
 */
export const generateQuickPathStory = async (
  params: QuickPathParams,
): Promise<StoryDraft> => {
  console.log('Generating Quick Path story:', params);

  // Build prompt by replacing placeholders
  const prompt = STORY_PROMPTS.quickPath
    .replace('{genre}', params.genre)
    .replace('{type}', params.type)
    .replace('{energy}', params.energy);

  try {
    // Generate story using Agent Hub (story-gen-agent)
    const response = await executeStoryGenAgent(prompt);

    // Parse JSON response (handles markdown code blocks)
    const story = parseAIResponse(response) as StoryDraft;

    // Validate story structure
    if (!story.projectMetadata || !story.scenes || story.scenes.length !== 4) {
      throw new Error('Invalid story structure returned by AI');
    }

    // Attach generation metadata
    story.generationMetadata = {
      mode: 'quick',
      timestamp: new Date().toISOString(),
      aiPrompt: prompt,
      originalParams: params,
    };

    console.log('Quick Path story generated:', story.projectMetadata.title);
    return story;
  } catch (error) {
    console.error('Error generating Quick Path story:', error);
    throw new Error(
      `Failed to generate story: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Generate a story using Custom Path (user concept)
 */
export const generateCustomPathStory = async (
  params: CustomPathParams,
): Promise<StoryDraft> => {
  console.log('Generating Custom Path story:', params);

  // Build prompt with user input
  const prompt = STORY_PROMPTS.customPath
    .replace('{concept}', params.concept)
    .replace('{character}', params.character || 'to be determined by AI')
    .replace('{mood}', params.mood || 'to be determined by AI');

  try {
    // Generate story using Agent Hub (story-gen-agent)
    const response = await executeStoryGenAgent(prompt);

    // Parse JSON response (handles markdown code blocks)
    const story = parseAIResponse(response) as StoryDraft;

    // Validate story structure
    if (!story.projectMetadata || !story.scenes || story.scenes.length !== 4) {
      throw new Error('Invalid story structure returned by AI');
    }

    // Attach generation metadata
    story.generationMetadata = {
      mode: 'custom',
      timestamp: new Date().toISOString(),
      aiPrompt: prompt,
      originalParams: params,
    };

    console.log('Custom Path story generated:', story.projectMetadata.title);
    return story;
  } catch (error) {
    console.error('Error generating Custom Path story:', error);
    throw new Error(
      `Failed to generate story: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Refine an existing story based on user feedback
 * Returns both the refined story and a summary of changes
 */
export const refineStory = async (
  existingStory: StoryDraft,
  refinementFeedback: string,
): Promise<{ story: StoryDraft; changesSummary: string }> => {
  console.log('Refining story with feedback:', refinementFeedback);

  const prompt = `You are helping refine a story based on user feedback.

CURRENT STORY:
${JSON.stringify(existingStory, null, 2)}

USER FEEDBACK:
${refinementFeedback}

INSTRUCTIONS:
1. Apply the user's requested changes to the story
2. Keep all changes targeted and specific to the feedback
3. Preserve everything else about the story that wasn't mentioned in the feedback
4. Maintain the same story structure with projectMetadata and 4 scenes
5. Each scene must have: id, title, duration (8), prompt, voiceover, cameraAngle

IMPORTANT:
- If the user asks to change a character name, change it everywhere (title, description, character field, scene prompts, voiceovers)
- If the user asks to modify specific scenes, only change those scenes
- If the user asks for tone/mood changes, adjust the language and descriptions accordingly
- Keep the same projectMetadata.id value
- Keep the same scene IDs

Return ONLY the complete refined story as JSON, with no markdown code blocks or additional text.`;

  try {
    // Generate refined story using Agent Hub (story-gen-agent)
    const response = await executeStoryGenAgent(prompt);

    // Parse JSON response
    const refinedStory = parseAIResponse(response) as StoryDraft;

    // Validate story structure
    if (!refinedStory.projectMetadata || !refinedStory.scenes || refinedStory.scenes.length === 0) {
      throw new Error('Invalid story structure returned by AI during refinement');
    }

    // Generate a summary of changes
    const summaryPrompt = `You just refined a story based on user feedback. Summarize the changes you made in a conversational, friendly way.

USER FEEDBACK:
"${refinementFeedback}"

ORIGINAL STORY TITLE: ${existingStory.projectMetadata.title}
REFINED STORY TITLE: ${refinedStory.projectMetadata.title}

Provide a brief, natural summary of what you changed. Start with "I've" and be specific about what was modified. Keep it to 2-3 sentences.

Example: "I've changed the character's name from Sarah to Emma throughout the story, including in the title, description, and all dialogue. I also updated the tone in Scene 2 to be more lighthearted as requested."`;

    // Generate summary using Agent Hub (story-gen-agent)
    const summaryResponse = await executeStoryGenAgent(summaryPrompt);

    const changesSummary = summaryResponse.trim();

    // Preserve and update generation metadata
    if (existingStory.generationMetadata) {
      refinedStory.generationMetadata = {
        ...existingStory.generationMetadata,
        refinements: [
          ...(existingStory.generationMetadata.refinements || []),
          {
            timestamp: new Date().toISOString(),
            feedback: refinementFeedback,
            aiPrompt: prompt,
          },
        ],
      };
    }

    console.log('Story refined successfully:', refinedStory.projectMetadata.title);
    return { story: refinedStory, changesSummary };
  } catch (error) {
    console.error('Error refining story:', error);
    throw new Error(
      `Failed to refine story: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Regenerate a single scene while maintaining narrative continuity
 */
export const regenerateScene = async (
  sceneNumber: number,
  projectTitle: string,
  character: string,
  previousSceneTitle: string,
  nextSceneTitle: string,
): Promise<any> => {
  console.log(`Regenerating scene ${sceneNumber}...`);

  const prompt = STORY_PROMPTS.sceneRegeneration
    .replace('{sceneNumber}', sceneNumber.toString())
    .replace('{projectTitle}', projectTitle)
    .replace('{character}', character)
    .replace('{previousSceneTitle}', previousSceneTitle)
    .replace('{nextSceneTitle}', nextSceneTitle);

  try {
    // Generate scene using Agent Hub (story-gen-agent)
    const response = await executeStoryGenAgent(prompt);

    const scene = parseAIResponse(response);

    if (!scene.id || !scene.title || !scene.prompt) {
      throw new Error('Invalid scene structure returned by AI');
    }

    console.log(`Scene ${sceneNumber} regenerated:`, scene.title);
    return scene;
  } catch (error) {
    console.error('Error regenerating scene:', error);
    throw new Error(
      `Failed to regenerate scene: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
