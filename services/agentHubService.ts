/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent Hub API Service
 * Provides integration with Agent Hub for AI agent execution via internal proxy
 */

export interface AgentHubExecuteParams {
  assistantId: string;
  userInput: string;
  responseFormat?: {
    type: 'json_object';
  };
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
    assistantId: '690a1bad455d30f7a1c0db7d', // story-gen-agent ID
    userInput,
    responseFormat: {
      type: 'json_object',
    },
  });
};
