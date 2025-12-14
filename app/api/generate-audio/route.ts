/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Voice IDs for different speech types
// Using high-quality expressive voices optimized for eleven_v3 model
const VOICE_IDS = {
  female: {
    voiceover: 'EXAVITQu4vr4xnSDxMaL', // Sarah - warm and expressive (great for on-screen dialogue)
    narration: 'XrExE9yKIg1WjnnlVkGX', // Matilda - professional narrator (great for off-screen narration)
  },
  male: {
    voiceover: 'N2lVS1w4EtoT3dr4eOWO', // Callum - conversational
    narration: 'onwK4e9ZLuTAKqWW03F9', // Daniel - authoritative narrator
  },
};

// Model configuration
// eleven_v3 is the most expressive model, best for audiobooks, videos, narrative content
// Use audio tags like [whispers], [happily], [sighs] for emotional control
const MODEL_ID = 'eleven_v3';

interface GenerateAudioRequest {
  text: string;
  speechType: 'voiceover' | 'narration';
  voiceGender?: 'male' | 'female';
  sceneId?: string;
}

/**
 * Prepare text for v3 model with appropriate audio tags based on speech type
 * v3 model is prompt-sensitive and responds well to stage-direction style tags
 */
function prepareTextForV3(text: string, speechType: 'voiceover' | 'narration'): string {
  // For narration, use a calm professional tone
  if (speechType === 'narration') {
    // Add subtle cues for narrator style if not already present
    if (!text.startsWith('[')) {
      return text; // Natural narration, no tags needed
    }
    return text;
  }

  // For voiceover (on-screen dialogue), keep it natural and expressive
  // The v3 model handles dialogue naturally without needing many tags
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateAudioRequest = await request.json();
    const { text, speechType, voiceGender = 'female', sceneId } = body;

    if (!text || !speechType) {
      return NextResponse.json(
        { error: 'Missing required fields: text and speechType' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Select voice based on speech type and gender
    const voiceCategory = VOICE_IDS[voiceGender] || VOICE_IDS.female;
    const voiceId = voiceCategory[speechType];

    // Prepare text for v3 model (may add audio tags for expressiveness)
    const preparedText = prepareTextForV3(text, speechType);

    // Configure voice settings for eleven_v3 model
    // v3 requires stability values: 0.0 (Creative), 0.5 (Natural), 1.0 (Robust)
    const stability = speechType === 'narration' ? 1.0 : 0.5; // Robust for narration, Natural for voiceover
    const similarityBoost = 0.5; // Good balance for natural sound
    const style = speechType === 'voiceover' ? 0.5 : 0.0; // More style for on-screen dialogue

    console.log(`[generate-audio] Generating ${speechType} audio for scene ${sceneId || 'unknown'} using ${MODEL_ID}`);
    console.log(`[generate-audio] Voice: ${voiceId}, Gender: ${voiceGender}`);
    console.log(`[generate-audio] Text: "${preparedText.substring(0, 50)}..."`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: preparedText,
          model_id: MODEL_ID, // eleven_v3 - most expressive model for videos/narration
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: true,
          },
          output_format: 'mp3_44100_128', // High quality MP3
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-audio] ElevenLabs API error:', errorText);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}` },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    console.log(`[generate-audio] Successfully generated audio (${audioBuffer.byteLength} bytes)`);

    return NextResponse.json({
      success: true,
      audioBase64,
      mimeType: 'audio/mpeg',
      speechType,
      sceneId,
    });
  } catch (error) {
    console.error('[generate-audio] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    );
  }
}

/**
 * Generate audio for multiple scenes in batch
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { scenes } = body as {
      scenes: Array<{
        sceneId: string;
        text: string;
        speechType: 'voiceover' | 'narration';
        voiceGender?: 'male' | 'female';
      }>;
    };

    if (!scenes || !Array.isArray(scenes)) {
      return NextResponse.json(
        { error: 'Missing required field: scenes (array)' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log(`[generate-audio] Batch generating audio for ${scenes.length} scenes`);

    // Process scenes in parallel with concurrency limit
    const results: Record<string, { audioBase64: string; mimeType: string } | { error: string }> = {};

    const processScene = async (scene: typeof scenes[0]) => {
      const { sceneId, text, speechType, voiceGender = 'female' } = scene;

      if (!text || text.trim().length === 0) {
        results[sceneId] = { error: 'No text provided' };
        return;
      }

      try {
        const voiceCategory = VOICE_IDS[voiceGender] || VOICE_IDS.female;
        const voiceId = voiceCategory[speechType];

        // Prepare text for v3 model
        const preparedText = prepareTextForV3(text, speechType);

        // Configure voice settings for eleven_v3 model
        // v3 requires stability values: 0.0 (Creative), 0.5 (Natural), 1.0 (Robust)
        const stability = speechType === 'narration' ? 1.0 : 0.5;
        const style = speechType === 'voiceover' ? 0.5 : 0.0;

        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text: preparedText,
              model_id: MODEL_ID, // eleven_v3 - most expressive model
              voice_settings: {
                stability,
                similarity_boost: 0.5,
                style,
                use_speaker_boost: true,
              },
              output_format: 'mp3_44100_128',
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[generate-audio] Error for scene ${sceneId}:`, errorText);
          results[sceneId] = { error: `API error: ${response.status}` };
          return;
        }

        const audioBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');

        results[sceneId] = {
          audioBase64,
          mimeType: 'audio/mpeg',
        };

        console.log(`[generate-audio] Generated audio for scene ${sceneId}`);
      } catch (error) {
        console.error(`[generate-audio] Error for scene ${sceneId}:`, error);
        results[sceneId] = { error: 'Generation failed' };
      }
    };

    // Process in batches of 3 to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < scenes.length; i += batchSize) {
      const batch = scenes.slice(i, i + batchSize);
      await Promise.all(batch.map(processScene));
    }

    const successCount = Object.values(results).filter((r) => 'audioBase64' in r).length;
    console.log(`[generate-audio] Batch complete: ${successCount}/${scenes.length} successful`);

    return NextResponse.json({
      success: true,
      results,
      totalScenes: scenes.length,
      successCount,
    });
  } catch (error) {
    console.error('[generate-audio] Batch error:', error);
    return NextResponse.json(
      { error: 'Failed to generate batch audio' },
      { status: 500 }
    );
  }
}
