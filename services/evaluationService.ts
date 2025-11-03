/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { trackEvaluation } from './costTrackingService';

export interface FrameEvaluation {
  frameType: 'first' | 'last';
  imageUrl: string;
  matchesPrompt: boolean;
  analysis: string;
  score: number; // 0-100
}

export interface AudioEvaluation {
  transcribedText: string;
  expectedText: string;
  matchesVoiceover: boolean;
  analysis: string;
  score: number; // 0-100
}

export interface VideoEvaluation {
  audioEvaluation: AudioEvaluation;
  firstFrameEvaluation: FrameEvaluation;
  lastFrameEvaluation: FrameEvaluation;
  overallScore: number; // 0-100
  timestamp: number;
}

/**
 * Extract audio from video blob as WAV
 */
export const extractAudioFromVideo = async (
  videoBlob: Blob
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const audioContext = new AudioContext();

    video.src = URL.createObjectURL(videoBlob);
    video.crossOrigin = 'anonymous';

    video.addEventListener('loadedmetadata', async () => {
      try {
        const source = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);

        const mediaRecorder = new MediaRecorder(destination.stream);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          URL.revokeObjectURL(video.src);
          resolve(audioBlob);
        };

        mediaRecorder.start();
        video.play();

        video.addEventListener('ended', () => {
          mediaRecorder.stop();
          audioContext.close();
        });
      } catch (error) {
        reject(error);
      }
    });

    video.addEventListener('error', (e) => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video'));
    });
  });
};

/**
 * Extract a frame from video at specific time
 */
export const extractFrameFromVideo = async (
  videoBlob: Blob,
  timeInSeconds: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    video.src = URL.createObjectURL(videoBlob);
    video.crossOrigin = 'anonymous';

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = timeInSeconds;
    });

    video.addEventListener('seeked', () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageUrl = canvas.toDataURL('image/png');
      URL.revokeObjectURL(video.src);
      resolve(imageUrl);
    });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video'));
    });
  });
};

/**
 * Transcribe audio using OpenAI Whisper API
 */
export const transcribeAudio = async (
  audioBlob: Blob,
  apiKey: string
): Promise<string> => {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Transcription failed: ${error}`);
  }

  const result = await response.json();
  return result.text;
};

/**
 * Evaluate frame using Gemini vision via REST API
 */
export const evaluateFrameWithGemini = async (
  frameDataUrl: string,
  prompt: string,
  frameType: 'first' | 'last'
): Promise<{ matches: boolean; analysis: string; score: number }> => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not available');
  }

  // Convert data URL to base64
  const base64Data = frameDataUrl.split(',')[1];

  const evaluationPrompt = `You are evaluating a ${frameType} frame from a video against the intended prompt.

Video Prompt: "${prompt}"

Please analyze this frame and determine:
1. Does this frame match the intended prompt? (yes/no)
2. What do you see in this frame?
3. How well does it align with the prompt? (score 0-100)
4. What specific elements match or don't match?

Respond in JSON format:
{
  "matches": true/false,
  "analysis": "detailed analysis",
  "score": 0-100
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: evaluationPrompt },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const result = await response.json();
  const text = result.candidates[0].content.parts[0].text;

  // Extract JSON from response (looking for code blocks or raw JSON)
  let jsonText = '';

  // Try to find JSON in code blocks first
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1];
  } else {
    // Fall back to finding any JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from Gemini response:', text);
      throw new Error('Failed to parse evaluation response - no JSON found');
    }
    jsonText = jsonMatch[0];
  }

  // Clean up common JSON issues
  jsonText = jsonText
    .replace(/[\u0000-\u001F]+/g, ' ') // Remove control characters
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  let evaluation;
  try {
    evaluation = JSON.parse(jsonText);
  } catch (parseError) {
    console.error('JSON parsing error:', parseError);
    console.error('Attempted to parse:', jsonText);
    console.error('Original response:', text);
    throw new Error(`Failed to parse evaluation response: ${parseError.message}`);
  }

  return {
    matches: evaluation.matches,
    analysis: evaluation.analysis,
    score: evaluation.score,
  };
};

/**
 * Compare transcribed text with expected voiceover using Gemini REST API
 */
export const compareVoiceoverWithGemini = async (
  transcribedText: string,
  expectedText: string
): Promise<{ matches: boolean; analysis: string; score: number }> => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not available');
  }

  const comparisonPrompt = `Compare the transcribed audio with the expected voiceover script.

Expected Voiceover:
"${expectedText}"

Transcribed Audio:
"${transcribedText}"

Evaluate:
1. Does the transcription match the expected voiceover? (yes/no)
2. What are the key differences or similarities?
3. How accurate is the match? (score 0-100)
4. Consider: exact words, meaning, tone, and completeness

Respond in JSON format:
{
  "matches": true/false,
  "analysis": "detailed comparison",
  "score": 0-100
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: comparisonPrompt }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const result = await response.json();
  const text = result.candidates[0].content.parts[0].text;

  // Extract JSON from response (looking for code blocks or raw JSON)
  let jsonText = '';

  // Try to find JSON in code blocks first
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1];
  } else {
    // Fall back to finding any JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from Gemini response:', text);
      throw new Error('Failed to parse comparison response - no JSON found');
    }
    jsonText = jsonMatch[0];
  }

  // Clean up common JSON issues
  jsonText = jsonText
    .replace(/[\u0000-\u001F]+/g, ' ') // Remove control characters
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  let comparison;
  try {
    comparison = JSON.parse(jsonText);
  } catch (parseError) {
    console.error('JSON parsing error:', parseError);
    console.error('Attempted to parse:', jsonText);
    console.error('Original response:', text);
    throw new Error(`Failed to parse comparison response: ${parseError.message}`);
  }

  return {
    matches: comparison.matches,
    analysis: comparison.analysis,
    score: comparison.score,
  };
};

/**
 * Evaluate a generated video
 */
export const evaluateVideo = async (
  videoBlob: Blob,
  videoDuration: number,
  prompt: string,
  expectedVoiceover: string,
  openaiApiKey?: string
): Promise<VideoEvaluation> => {
  console.log('Starting video evaluation...');

  // Extract first and last frames
  console.log('Extracting frames...');
  const firstFrameUrl = await extractFrameFromVideo(videoBlob, 0.1);
  const lastFrameUrl = await extractFrameFromVideo(videoBlob, Math.max(0, videoDuration - 0.5));

  // Evaluate frames
  console.log('Evaluating frames with Gemini...');
  const firstFrameResult = await evaluateFrameWithGemini(firstFrameUrl, prompt, 'first');
  const lastFrameResult = await evaluateFrameWithGemini(lastFrameUrl, prompt, 'last');

  // Extract and transcribe audio if OpenAI key is provided
  let audioEvaluation: AudioEvaluation;

  if (openaiApiKey) {
    console.log('Extracting audio...');
    const audioBlob = await extractAudioFromVideo(videoBlob);

    console.log('Transcribing audio with Whisper...');
    const transcribedText = await transcribeAudio(audioBlob, openaiApiKey);

    console.log('Comparing voiceover with Gemini...');
    const voiceoverResult = await compareVoiceoverWithGemini(transcribedText, expectedVoiceover);

    audioEvaluation = {
      transcribedText,
      expectedText: expectedVoiceover,
      matchesVoiceover: voiceoverResult.matches,
      analysis: voiceoverResult.analysis,
      score: voiceoverResult.score,
    };
  } else {
    audioEvaluation = {
      transcribedText: 'Audio evaluation skipped (no OpenAI API key)',
      expectedText: expectedVoiceover,
      matchesVoiceover: false,
      analysis: 'Provide OpenAI API key to enable audio transcription',
      score: 0,
    };
  }

  // Calculate overall score
  const overallScore = Math.round(
    (firstFrameResult.score + lastFrameResult.score + audioEvaluation.score) / 3
  );

  // Track evaluation cost
  trackEvaluation(videoDuration, !!openaiApiKey);
  console.log('Evaluation cost tracked:', { audioDuration: videoDuration, includesAudio: !!openaiApiKey });

  return {
    audioEvaluation,
    firstFrameEvaluation: {
      frameType: 'first',
      imageUrl: firstFrameUrl,
      matchesPrompt: firstFrameResult.matches,
      analysis: firstFrameResult.analysis,
      score: firstFrameResult.score,
    },
    lastFrameEvaluation: {
      frameType: 'last',
      imageUrl: lastFrameUrl,
      matchesPrompt: lastFrameResult.matches,
      analysis: lastFrameResult.analysis,
      score: lastFrameResult.score,
    },
    overallScore,
    timestamp: Date.now(),
  };
};
