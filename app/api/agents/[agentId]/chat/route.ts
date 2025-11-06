/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { generateText } from '@/services/geminiService';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * POST /api/agents/[agentId]/chat - Chat with an AI agent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const { message, history } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Load agent prompt
    const agentsDir = path.join(process.cwd(), '.agents');
    let agentPrompt: string;

    // Try folder-based agent first (.agents/{agentId}/prompt.md)
    let promptPath = path.join(agentsDir, agentId, 'prompt.md');
    try {
      agentPrompt = await readFile(promptPath, 'utf-8');
    } catch {
      // Try standalone file (.agents/{agentId}.md)
      promptPath = path.join(agentsDir, `${agentId}.md`);
      try {
        agentPrompt = await readFile(promptPath, 'utf-8');
      } catch {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }
    }

    // Build conversation context
    let conversationContext = '';
    if (history && Array.isArray(history) && history.length > 0) {
      conversationContext = '\n\nCONVERSATION HISTORY:\n';
      history.forEach((msg: ChatMessage) => {
        conversationContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
    }

    // Build the full prompt for the agent
    const fullPrompt = `${agentPrompt}

${conversationContext}

USER MESSAGE:
${message}

Please respond as this agent would, following the instructions and personality defined in the agent prompt above.`;

    // Generate response using Gemini
    const response = await generateText({
      prompt: fullPrompt,
      temperature: 0.7, // Moderate creativity for conversational responses
      maxTokens: 2048,
    });

    return NextResponse.json({
      response: response.trim(),
      agentId,
    });
  } catch (error) {
    console.error('Error in agent chat:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate response',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
