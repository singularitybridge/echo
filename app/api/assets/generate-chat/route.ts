/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AssetMetadata {
  type: string;
  aspectRatio: string;
  prompt: string;
  timestamp: number;
}

interface PreviousAsset {
  id: string;
  metadata: AssetMetadata;
}

/**
 * POST /api/assets/generate-chat
 *
 * Chat-based asset generation endpoint that:
 * 1. Interprets user's natural language request
 * 2. Generates appropriate assets using Gemini
 * 3. Returns conversational response + generated assets
 */
export async function POST(request: NextRequest) {
  try {
    const { message, previousAssets, conversationHistory } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Parse user intent from message
    const intent = parseUserIntent(message, previousAssets, conversationHistory);

    // Generate assets if needed
    let assets: any[] = [];
    if (intent.shouldGenerate) {
      assets = await generateAssets(apiKey, intent);
    }

    // Generate conversational response
    const response = generateResponse(intent, assets);

    return NextResponse.json({
      assets,
      response,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Asset generation chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process generation request' },
      { status: 500 }
    );
  }
}

/**
 * Parse user intent from their message
 */
function parseUserIntent(
  message: string,
  previousAssets: PreviousAsset[],
  conversationHistory: ChatMessage[]
): {
  shouldGenerate: boolean;
  assetType: 'character' | 'prop' | 'location';
  description: string;
  aspectRatio: '1:1' | '16:9' | '9:16';
  variations: number;
  isRefinement: boolean;
} {
  const lowerMessage = message.toLowerCase();

  // Determine asset type
  let assetType: 'character' | 'prop' | 'location' = 'character';
  if (lowerMessage.includes('prop') || lowerMessage.includes('object') || lowerMessage.includes('item')) {
    assetType = 'prop';
  } else if (lowerMessage.includes('location') || lowerMessage.includes('place') || lowerMessage.includes('scene') || lowerMessage.includes('background')) {
    assetType = 'location';
  }

  // Determine aspect ratio
  let aspectRatio: '1:1' | '16:9' | '9:16' = '16:9';
  if (lowerMessage.includes('square') || lowerMessage.includes('1:1')) {
    aspectRatio = '1:1';
  } else if (lowerMessage.includes('portrait') || lowerMessage.includes('vertical') || lowerMessage.includes('9:16')) {
    aspectRatio = '9:16';
  }

  // Determine number of variations
  let variations = 3;
  const varMatch = lowerMessage.match(/(\d+)\s+(variation|version|option)/);
  if (varMatch) {
    variations = Math.min(6, Math.max(2, parseInt(varMatch[1])));
  }

  // Check if this is a refinement request
  const isRefinement = previousAssets.length > 0 && (
    lowerMessage.includes('make') ||
    lowerMessage.includes('change') ||
    lowerMessage.includes('adjust') ||
    lowerMessage.includes('darker') ||
    lowerMessage.includes('lighter') ||
    lowerMessage.includes('more') ||
    lowerMessage.includes('less')
  );

  // Extract description (clean up command words)
  let description = message
    .replace(/create|generate|make|give me|show me|i want|can you/gi, '')
    .replace(/\d+\s+(variation|version|option)s?/gi, '')
    .trim();

  if (!description || description.length < 3) {
    description = message; // Use full message if cleaning resulted in nothing
  }

  return {
    shouldGenerate: true, // Always generate for now
    assetType,
    description,
    aspectRatio,
    variations,
    isRefinement,
  };
}

/**
 * Generate assets using Gemini
 */
async function generateAssets(
  apiKey: string,
  intent: ReturnType<typeof parseUserIntent>
): Promise<any[]> {
  const ai = new GoogleGenAI({ apiKey });

  // Build enhanced prompts based on asset type
  const enhancedPrompts = buildEnhancedPrompts(intent);

  // Generate all variations in parallel
  const results = await Promise.allSettled(
    enhancedPrompts.map(async (enhancedPrompt) => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [enhancedPrompt],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: intent.aspectRatio,
          },
        },
      });

      // Extract image bytes
      let imageBytes: string | undefined;
      let mimeType = 'image/png';

      if (response.parts && Array.isArray(response.parts)) {
        const imagePartCamel = response.parts.find((part: any) => part.inlineData);
        if (imagePartCamel?.inlineData) {
          imageBytes = imagePartCamel.inlineData.data;
          mimeType = imagePartCamel.inlineData.mimeType || mimeType;
        } else {
          const imagePartSnake = response.parts.find((part: any) => part.inline_data);
          if (imagePartSnake?.inline_data) {
            imageBytes = imagePartSnake.inline_data.data;
            mimeType = imagePartSnake.inline_data.mime_type || imagePartSnake.inline_data.mimeType || mimeType;
          }
        }
      }

      if (!imageBytes && (response as any).data) {
        imageBytes = (response as any).data;
      }

      if (!imageBytes) {
        throw new Error('No image data in response');
      }

      return {
        imageBytes,
        mimeType,
        prompt: enhancedPrompt,
      };
    })
  );

  // Convert to assets format
  const assets = results
    .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
    .map((result, index) => {
      const { imageBytes, mimeType, prompt } = result.value;

      // Convert base64 to blob
      const byteString = Buffer.from(imageBytes, 'base64').toString('binary');
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blobData = Buffer.from(ia).toString('base64');

      return {
        id: `asset-${Date.now()}-${index}`,
        imageUrl: `data:${mimeType};base64,${imageBytes}`,
        blob: {
          type: mimeType,
          data: blobData,
        },
        metadata: {
          type: intent.assetType,
          aspectRatio: intent.aspectRatio,
          prompt,
          timestamp: Date.now(),
        },
      };
    });

  return assets;
}

/**
 * Build enhanced prompts based on asset type
 */
function buildEnhancedPrompts(
  intent: ReturnType<typeof parseUserIntent>
): string[] {
  const basePrompt = intent.description.trim();
  const prompts: string[] = [];

  if (intent.assetType === 'character') {
    const variations = [
      'front-facing portrait, neutral expression, professional lighting',
      'slightly angled view, friendly expression, soft lighting',
      'three-quarter view, engaging expression, natural lighting',
      'full body pose, confident stance, balanced composition',
      'close-up portrait, detailed features, studio lighting',
      'dynamic pose, expressive, dramatic lighting',
    ];

    for (let i = 0; i < intent.variations; i++) {
      prompts.push(
        `${basePrompt}, ${variations[i % variations.length]}, high quality photorealistic`
      );
    }
  } else if (intent.assetType === 'prop') {
    const variations = [
      'centered composition, clean background, product photography style',
      'slightly angled view, soft shadows, professional lighting',
      'detailed view, textured surface, studio lighting',
      'dramatic angle, interesting perspective, focused composition',
      'overhead view, flat lay style, even lighting',
      'close-up detail, macro perspective, sharp focus',
    ];

    for (let i = 0; i < intent.variations; i++) {
      prompts.push(
        `${basePrompt}, ${variations[i % variations.length]}, high quality detailed render`
      );
    }
  } else if (intent.assetType === 'location') {
    const variations = [
      'wide angle establishing shot, atmospheric lighting',
      'medium view, balanced composition, natural lighting',
      'detailed environmental view, rich atmosphere',
      'dramatic perspective, interesting depth, cinematic lighting',
      'panoramic view, comprehensive scene, even lighting',
      'intimate angle, focused composition, ambient lighting',
    ];

    for (let i = 0; i < intent.variations; i++) {
      prompts.push(
        `${basePrompt}, ${variations[i % variations.length]}, high quality photorealistic environment`
      );
    }
  }

  return prompts;
}

/**
 * Generate a conversational response
 */
function generateResponse(
  intent: ReturnType<typeof parseUserIntent>,
  assets: any[]
): string {
  if (assets.length === 0) {
    return "I couldn't generate any assets. Please try rephrasing your request.";
  }

  const count = assets.length;
  const type = intent.assetType;
  const aspectText = intent.aspectRatio === '1:1' ? 'square' : intent.aspectRatio === '9:16' ? 'portrait' : 'landscape';

  if (intent.isRefinement) {
    return `I've created ${count} refined ${type} ${count === 1 ? 'variation' : 'variations'} based on your feedback. The ${aspectText} format should work well. Let me know if you'd like me to adjust anything else!`;
  }

  return `I've generated ${count} ${type} ${count === 1 ? 'variation' : 'variations'} for you in ${aspectText} format. Feel free to ask me to refine them or create something different!`;
}
