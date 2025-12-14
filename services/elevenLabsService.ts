/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ElevenLabs Text-to-Speech Service
 * Generates voiceover and narration audio for video scenes
 */

export type SpeechType = 'voiceover' | 'narration';

// Voice IDs for different speech types
// These can be customized based on your ElevenLabs account voices
const VOICE_IDS = {
  // Female voices
  female: {
    voiceover: 'EXAVITQu4vr4xnSDxMaL', // Sarah - warm and expressive
    narration: 'XrExE9yKIg1WjnnlVkGX', // Matilda - professional narrator
  },
  // Male voices
  male: {
    voiceover: 'N2lVS1w4EtoT3dr4eOWO', // Callum - conversational
    narration: 'onwK4e9ZLuTAKqWW03F9', // Daniel - authoritative narrator
  },
  // Default (female)
  default: {
    voiceover: 'EXAVITQu4vr4xnSDxMaL', // Sarah
    narration: 'XrExE9yKIg1WjnnlVkGX', // Matilda
  },
};

// Model IDs
const MODELS = {
  v3: 'eleven_v3', // Most expressive, best for videos/audiobooks/narrative content
  multilingual: 'eleven_multilingual_v2', // Best quality, supports multiple languages
  turbo: 'eleven_turbo_v2', // Faster, English optimized
  flash: 'eleven_flash_v2_5', // Fastest, good quality
};

export interface TTSOptions {
  text: string;
  speechType: SpeechType;
  voiceGender?: 'male' | 'female';
  stability?: number; // 0-1, higher = more consistent
  similarityBoost?: number; // 0-1, higher = more similar to original voice
  style?: number; // 0-1, style exaggeration
  speed?: number; // 0.5-2.0, playback speed
}

export interface TTSResult {
  audioBlob: Blob;
  audioUrl: string; // Blob URL
  mimeType: string;
  durationMs?: number;
}

/**
 * Generate speech audio using ElevenLabs TTS API
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }

  const {
    text,
    speechType,
    voiceGender = 'female',
    // v3 requires stability values: 0.0 (Creative), 0.5 (Natural), 1.0 (Robust)
    stability = speechType === 'narration' ? 1.0 : 0.5, // Robust for narration, Natural for voiceover
    similarityBoost = 0.5,
    style = speechType === 'voiceover' ? 0.5 : 0.0, // More style for voiceover
    speed = 1.0,
  } = options;

  // Select voice based on speech type and gender
  const voiceCategory = VOICE_IDS[voiceGender] || VOICE_IDS.default;
  const voiceId = voiceCategory[speechType] || voiceCategory.voiceover;

  // Use v3 model for best expressiveness in videos/narration
  const modelId = MODELS.v3;

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
        text,
        model_id: modelId,
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
    console.error('ElevenLabs API error:', errorText);
    throw new Error(`ElevenLabs TTS failed: ${response.status} - ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const audioUrl = URL.createObjectURL(audioBlob);

  return {
    audioBlob,
    audioUrl,
    mimeType: 'audio/mpeg',
  };
}

/**
 * Generate speech for multiple scenes in batch
 */
export async function generateSpeechBatch(
  scenes: Array<{
    sceneId: string;
    text: string;
    speechType: SpeechType;
    voiceGender?: 'male' | 'female';
  }>
): Promise<Map<string, TTSResult>> {
  const results = new Map<string, TTSResult>();

  // Process in parallel with concurrency limit
  const concurrencyLimit = 3;
  const chunks: typeof scenes[] = [];

  for (let i = 0; i < scenes.length; i += concurrencyLimit) {
    chunks.push(scenes.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (scene) => {
        try {
          const result = await generateSpeech({
            text: scene.text,
            speechType: scene.speechType,
            voiceGender: scene.voiceGender,
          });
          return { sceneId: scene.sceneId, result };
        } catch (error) {
          console.error(`Failed to generate speech for scene ${scene.sceneId}:`, error);
          return { sceneId: scene.sceneId, result: null };
        }
      })
    );

    for (const { sceneId, result } of chunkResults) {
      if (result) {
        results.set(sceneId, result);
      }
    }
  }

  return results;
}

/**
 * Get available voices from ElevenLabs
 */
export async function getAvailableVoices(): Promise<any[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices || [];
}
