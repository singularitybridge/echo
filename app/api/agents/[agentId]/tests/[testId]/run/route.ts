/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { generateCustomPathStory } from '../../../../../../../services/storyGenerationService';

interface TestResult {
  passed: boolean;
  score: number;
  details: string;
  errors: string[];
  output?: any;
  duration: number;
}

/**
 * POST /api/agents/[agentId]/tests/[testId]/run - Run agent test
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string; testId: string }> }
) {
  const startTime = Date.now();

  try {
    const { agentId, testId } = await params;

    console.log(`[Test Runner] Running test ${testId} for agent ${agentId}`);

    // Generate test inputs based on agent and test type
    const testInput = generateTestInput(agentId, testId);

    // Run the agent with test inputs
    const agentOutput = await runAgent(agentId, testInput);

    // Validate output against test criteria
    const testResult = await validateOutput(agentId, testId, agentOutput, testInput);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      ...testResult,
      duration,
      testId,
      agentId,
    });
  } catch (error) {
    console.error('[Test Runner] Error:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        passed: false,
        score: 0,
        details: 'Test execution failed',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration,
      },
      { status: 500 }
    );
  }
}

/**
 * Generate test inputs based on agent and test type
 */
function generateTestInput(agentId: string, testId: string): any {
  const inputs: Record<string, Record<string, any>> = {
    'story-generator': {
      'test-generate-simple': {
        concept: 'A friendly dog discovers a magical bone in the park',
        character: 'A friendly golden retriever',
        mood: 'Lighthearted and fun',
        testType: 'simple',
      },
      'test-generate-complex': {
        concept:
          'A brilliant scientist who is also a single parent struggles to balance groundbreaking research on time travel with raising their rebellious teenage daughter who unknowingly possesses the key to making the research work',
        character: 'Dr. Sarah Chen and her daughter Maya',
        mood: 'Emotional drama with suspense',
        testType: 'complex',
      },
      'test-scene-coherence': {
        concept: 'A detective solving a mystery in a haunted mansion',
        character: 'Detective James Morgan',
        mood: 'Dark and mysterious',
        testType: 'coherence',
      },
    },
    'script-editing-agent': {
      'test-edit-character-name': {
        editRequest: 'Change the main character name to Sarah Miller',
        testType: 'character-rename',
      },
      'test-add-scene': {
        editRequest: 'Add a new scene where the character discovers a hidden clue',
        testType: 'add-scene',
      },
      'test-remove-scene': {
        editRequest: 'Remove the last scene',
        testType: 'remove-scene',
      },
      'test-modify-prompt': {
        editRequest: 'Make the first scene darker and more suspenseful',
        testType: 'modify-prompt',
      },
    },
  };

  return inputs[agentId]?.[testId] || {};
}

/**
 * Run agent with test inputs
 */
async function runAgent(agentId: string, testInput: any): Promise<any> {
  switch (agentId) {
    case 'story-generator':
      return await runStoryGenerator(testInput);

    case 'script-editing-agent':
      // TODO: Implement script editing agent runner
      throw new Error('Script editing agent tests not yet implemented');

    case 'review-agent':
      // TODO: Implement review agent runner
      throw new Error('Review agent tests not yet implemented');

    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }
}

/**
 * Run story generator agent
 */
async function runStoryGenerator(testInput: any): Promise<any> {
  const { concept, character, mood } = testInput;

  const story = await generateCustomPathStory({
    concept,
    character,
    mood,
  });

  return story;
}

/**
 * Validate agent output against test criteria
 */
async function validateOutput(
  agentId: string,
  testId: string,
  output: any,
  testInput: any
): Promise<TestResult> {
  switch (agentId) {
    case 'story-generator':
      return validateStoryGeneratorOutput(testId, output, testInput);

    default:
      return {
        passed: false,
        score: 0,
        details: `No validator for agent: ${agentId}`,
        errors: ['Validator not implemented'],
        duration: 0,
      };
  }
}

/**
 * Validate story generator output
 */
function validateStoryGeneratorOutput(
  testId: string,
  story: any,
  testInput: any
): TestResult {
  const errors: string[] = [];
  let score = 0;
  const maxScore = 100;

  // Check basic structure (20 points)
  if (!story.projectMetadata) {
    errors.push('Missing projectMetadata');
  } else {
    score += 5;
    if (story.projectMetadata.title) score += 5;
    if (story.projectMetadata.description) score += 5;
    if (story.projectMetadata.character) score += 5;
  }

  // Check scenes array (20 points)
  if (!story.scenes || !Array.isArray(story.scenes)) {
    errors.push('Missing or invalid scenes array');
  } else {
    score += 10;
    if (story.scenes.length === 4) {
      score += 10;
    } else {
      errors.push(`Expected 4 scenes, got ${story.scenes.length}`);
    }
  }

  // Check scene structure (40 points - 10 per scene)
  if (story.scenes && Array.isArray(story.scenes)) {
    for (let i = 0; i < story.scenes.length; i++) {
      const scene = story.scenes[i];
      let sceneScore = 0;

      if (scene.id) sceneScore += 2;
      if (scene.title) sceneScore += 2;
      if (scene.prompt && scene.prompt.length > 20) sceneScore += 3;
      if (scene.cameraAngle) sceneScore += 2;
      if (scene.duration === 8) sceneScore += 1;

      score += sceneScore;

      if (sceneScore < 10) {
        errors.push(`Scene ${i + 1} is incomplete (${sceneScore}/10 points)`);
      }
    }
  }

  // Check narrative coherence (20 points)
  if (story.scenes && story.scenes.length >= 2) {
    const hasCharacterContinuity = story.scenes.every((scene: any) =>
      scene.prompt.toLowerCase().includes(story.projectMetadata.character?.split(' ')[0]?.toLowerCase() || 'character')
    );

    if (hasCharacterContinuity) {
      score += 10;
    } else {
      errors.push('Character continuity issue detected');
    }

    // Check if scenes tell a coherent story
    const hasTitles = story.scenes.every((scene: any) => scene.title && scene.title.length > 0);
    if (hasTitles) {
      score += 10;
    } else {
      errors.push('Some scenes missing titles');
    }
  }

  // Test-specific validations
  if (testId === 'test-generate-complex') {
    // Complex stories should have richer descriptions
    const avgPromptLength =
      story.scenes?.reduce((sum: number, s: any) => sum + (s.prompt?.length || 0), 0) / (story.scenes?.length || 1);

    if (avgPromptLength < 50) {
      errors.push('Prompts too short for complex story');
      score = Math.max(0, score - 10);
    }
  }

  const passed = score >= 80 && errors.length === 0;

  return {
    passed,
    score,
    details: passed
      ? `✓ Story generated successfully with ${story.scenes?.length || 0} scenes`
      : `✗ Story validation failed (${score}/${maxScore} points)`,
    errors,
    output: story,
    duration: 0,
  };
}
