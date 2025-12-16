/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeAssetAnalyzerAgent } from '@/services/agentHubService';
import type { AssetType } from '@/types/asset';

interface AnalyzeRequest {
  imageBase64: string;
  mimeType: string;
}

interface AnalysisResult {
  type: AssetType;
  name: string;
  description: string;
}

/**
 * POST /api/assets/analyze - Analyze an image using AI to determine asset type, name, and description
 */
export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType }: AnalyzeRequest = await request.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Missing imageBase64 parameter' },
        { status: 400 }
      );
    }

    console.log('[Asset Analyze] Analyzing image with AI...');

    // Call the asset-analyzer agent with the image
    const response = await executeAssetAnalyzerAgent({
      type: 'base64',
      mimeType: mimeType || 'image/png',
      data: imageBase64,
    });

    console.log('[Asset Analyze] Raw response:', response);

    // Parse the JSON response from the agent
    let result: AnalysisResult;
    try {
      // Try to parse JSON directly
      result = JSON.parse(response);
    } catch {
      // If that fails, try to extract JSON from markdown code block
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    // Validate the result
    if (!result.type || !result.name) {
      throw new Error('Invalid response structure from AI');
    }

    // Ensure type is a valid AssetType
    const validTypes: AssetType[] = ['character', 'prop', 'location'];
    if (!validTypes.includes(result.type)) {
      result.type = 'prop'; // Default to prop if invalid
    }

    console.log('[Asset Analyze] Analysis result:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Asset Analyze] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
