/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * GET /api/agents/[id] - Get agent details including prompt and tests
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agentsDir = path.join(process.cwd(), '.agents');

    // Try folder-based agent first (.agents/{id}/prompt.md)
    let promptPath = path.join(agentsDir, id, 'prompt.md');
    let promptContent: string;

    try {
      promptContent = await readFile(promptPath, 'utf-8');
    } catch {
      // Try standalone file (.agents/{id}.md)
      promptPath = path.join(agentsDir, `${id}.md`);
      try {
        promptContent = await readFile(promptPath, 'utf-8');
      } catch {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }
    }

    // Define tests based on agent type
    const tests = getTestsForAgent(id);

    return NextResponse.json({
      prompt: promptContent,
      tests,
    });
  } catch (error) {
    console.error('Error reading agent details:', error);
    return NextResponse.json(
      { error: 'Failed to read agent details' },
      { status: 500 }
    );
  }
}

/**
 * Get appropriate tests for each agent
 */
function getTestsForAgent(agentId: string) {
  const testsByAgent: Record<string, Array<{ id: string; name: string; description: string }>> = {
    'story-generator': [
      {
        id: 'test-generate-simple',
        name: 'Generate Simple Story',
        description: 'Test generating a short 4-scene story with basic prompt',
      },
      {
        id: 'test-generate-complex',
        name: 'Generate Complex Story',
        description: 'Test generating a story with complex character and plot requirements',
      },
      {
        id: 'test-scene-coherence',
        name: 'Scene Coherence Test',
        description: 'Verify all scenes are logically connected and maintain continuity',
      },
    ],
    'script-editing-agent': [
      {
        id: 'test-edit-character-name',
        name: 'Edit Character Name',
        description: 'Test changing character name across entire story',
      },
      {
        id: 'test-add-scene',
        name: 'Add Scene',
        description: 'Test adding a new scene to existing story',
      },
      {
        id: 'test-remove-scene',
        name: 'Remove Scene',
        description: 'Test removing a scene from story',
      },
      {
        id: 'test-modify-prompt',
        name: 'Modify Scene Prompt',
        description: 'Test modifying specific scene visual description',
      },
    ],
    'review-agent': [
      {
        id: 'test-review-simple',
        name: 'Review Simple Edit',
        description: 'Test generating review for simple scene modification',
      },
      {
        id: 'test-review-complex',
        name: 'Review Complex Changes',
        description: 'Test generating review for multiple character/plot changes',
      },
    ],
    'story-refiner': [
      {
        id: 'test-refine-dialogue',
        name: 'Refine Dialogue',
        description: 'Test improving voiceovers and character dialogue',
      },
      {
        id: 'test-refine-pacing',
        name: 'Refine Pacing',
        description: 'Test adjusting story pacing and scene timing',
      },
    ],
    'echo-brand-designer': [
      {
        id: 'test-generate-logo',
        name: 'Generate Logo Variations',
        description: 'Test generating Echo brand logo variations',
      },
      {
        id: 'test-generate-ui',
        name: 'Generate UI Elements',
        description: 'Test generating branded UI components',
      },
    ],
  };

  return testsByAgent[agentId] || [];
}
