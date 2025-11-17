/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent Hub API Service
 * Provides integration with Agent Hub for AI agent execution via internal proxy
 */

export interface AgentHubAttachment {
  type: 'url' | 'base64';
  mimeType: string;
  url?: string;
  data?: string;
  fileName?: string;
}

export interface AgentHubExecuteParams {
  assistantId: string;
  userInput: string;
  responseFormat?: {
    type: 'json_object';
  };
  attachments?: AgentHubAttachment[];
}

interface AgentHubProxyResponse {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Execute an Agent Hub assistant with the given input
 * Uses internal API proxy to handle Agent Hub authentication
 */
export const executeAgent = async (
  params: AgentHubExecuteParams,
): Promise<string> => {
  console.log('[Agent Hub] Executing assistant:', params.assistantId);

  try {
    // Construct absolute URL for server-side fetch
    // In Next.js API routes, we need absolute URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3039';
    const url = `${baseUrl}/api/agent-hub/execute`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: params.assistantId,
        userInput: params.userInput,
        responseFormat: params.responseFormat,
        attachments: params.attachments,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data: AgentHubProxyResponse = await response.json();

    if (!data.success || !data.content) {
      throw new Error(data.error || 'Agent Hub returned no content');
    }

    console.log('[Agent Hub] Response received, length:', data.content.length);
    return data.content;
  } catch (error) {
    console.error('[Agent Hub] Error:', error);
    throw new Error(
      `Failed to execute Agent Hub assistant: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Execute story generation agent (story-gen-agent)
 */
export const executeStoryGenAgent = async (
  userInput: string,
): Promise<string> => {
  return executeAgent({
    assistantId: 'story-gen-agent',
    userInput,
    responseFormat: {
      type: 'json_object',
    },
  });
};

/**
 * Execute character design expert agent
 */
export const executeCharacterDesignAgent = async (
  userInput: string,
): Promise<string> => {
  return executeAgent({
    assistantId: 'character-design-expert',
    userInput,
    responseFormat: {
      type: 'json_object',
    },
  });
};

/**
 * Execute poses and outfits expert agent
 */
export const executePosesOutfitsAgent = async (
  userInput: string,
): Promise<string> => {
  return executeAgent({
    assistantId: 'poses-outfits-expert',
    userInput,
    responseFormat: {
      type: 'json_object',
    },
  });
};

/**
 * Execute story editor agent (for story editing tasks)
 */
export const executeStoryEditorAgent = async (
  userInput: string,
): Promise<string> => {
  return executeAgent({
    assistantId: 'story-editor',
    userInput,
    responseFormat: {
      type: 'json_object',
    },
  });
};

/**
 * Execute frame evaluation agent (for video frame analysis)
 */
export const executeFrameEvalAgent = async (
  userInput: string,
): Promise<string> => {
  return executeAgent({
    assistantId: 'frame-eval-agent',
    userInput,
    responseFormat: {
      type: 'json_object',
    },
  });
};

/**
 * Execute audio comparison agent (for voiceover matching)
 */
export const executeAudioComparisonAgent = async (
  userInput: string,
): Promise<string> => {
  return executeAgent({
    assistantId: 'audio-comparison-agent',
    userInput,
    responseFormat: {
      type: 'json_object',
    },
  });
};

/**
 * Execute start frame generator agent (for creating new start frame prompts)
 */
export const executeStartFrameGeneratorAgent = async (
  userInput: string,
): Promise<string> => {
  return executeAgent({
    assistantId: 'start-frame-generator',
    userInput,
    responseFormat: {
      type: 'json_object',
    },
  });
};

/**
 * Execute start frame editor agent (for editing existing start frame prompts with vision analysis)
 */
export const executeStartFrameEditorAgent = async (
  userInput: string,
  imageAttachment?: AgentHubAttachment,
): Promise<string> => {
  return executeAgent({
    assistantId: 'start-frame-editor',
    userInput,
    responseFormat: {
      type: 'json_object',
    },
    attachments: imageAttachment ? [imageAttachment] : undefined,
  });
};
