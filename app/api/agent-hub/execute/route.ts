/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {NextRequest, NextResponse} from 'next/server';

interface AgentHubAttachment {
  type: 'url' | 'base64';
  mimeType: string;
  url?: string;
  data?: string;
  fileName?: string;
}

interface ExecuteRequest {
  assistantId: string;
  userInput: string;
  responseFormat?: {
    type: 'json_object';
  };
  attachments?: AgentHubAttachment[];
}

/**
 * POST /api/agent-hub/execute
 * Execute an Agent Hub assistant
 */
export async function POST(request: NextRequest) {
  try {
    // Get Agent Hub configuration from environment
    const AGENT_HUB_API_URL = process.env.AGENT_HUB_API_URL;
    const AGENT_HUB_API_KEY = process.env.AGENT_HUB_API_KEY;

    if (!AGENT_HUB_API_URL || !AGENT_HUB_API_KEY) {
      console.error('[Agent Hub Proxy] Missing environment configuration');
      return NextResponse.json(
        {
          success: false,
          error: 'Agent Hub configuration missing. Please set AGENT_HUB_API_URL and AGENT_HUB_API_KEY in .env.local',
        },
        {status: 500},
      );
    }

    const body: ExecuteRequest = await request.json();

    if (!body.assistantId || !body.userInput) {
      return NextResponse.json(
        {success: false, error: 'assistantId and userInput are required'},
        {status: 400},
      );
    }

    console.log('[Agent Hub Proxy] Executing assistant:', body.assistantId);

    const url = `${AGENT_HUB_API_URL}/${body.assistantId}/workspace-execute`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENT_HUB_API_KEY}`,
      },
      body: JSON.stringify({
        query: body.userInput,
        responseFormat: body.responseFormat,
        attachments: body.attachments,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Agent Hub Proxy] API error:', response.status, errorText);
      return NextResponse.json(
        {
          success: false,
          error: `Agent Hub API error (${response.status}): ${errorText}`,
        },
        {status: response.status},
      );
    }

    const data = await response.json();

    // Debug: Log the raw response structure
    console.log('[Agent Hub Proxy] Raw response:', JSON.stringify(data, null, 2));

    // Agent Hub returns {success: true, response: "stringified JSON"}
    if (!data.success || !data.response) {
      return NextResponse.json(
        {success: false, error: 'Agent Hub returned invalid response format'},
        {status: 500},
      );
    }

    // Parse the stringified response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(data.response);
    } catch (e) {
      console.error('[Agent Hub Proxy] Failed to parse response:', e);
      return NextResponse.json(
        {success: false, error: 'Failed to parse Agent Hub response'},
        {status: 500},
      );
    }

    // Extract text content from parsed response
    if (!parsedResponse.content || parsedResponse.content.length === 0) {
      return NextResponse.json(
        {success: false, error: 'Agent Hub returned empty content'},
        {status: 500},
      );
    }

    let textContent = parsedResponse.content[0]?.text?.value;
    if (!textContent) {
      return NextResponse.json(
        {success: false, error: 'Agent Hub response missing text value'},
        {status: 500},
      );
    }

    // Strip markdown code fences if present (```json ... ```)
    textContent = textContent.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');

    console.log('[Agent Hub Proxy] Response received, length:', textContent.length);

    return NextResponse.json({
      success: true,
      content: textContent,
      raw: data,
    });
  } catch (error) {
    console.error('[Agent Hub Proxy] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {status: 500},
    );
  }
}
