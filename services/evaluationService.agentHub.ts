/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Video Evaluation Service - Agent Hub Integration
 * Uses Agent Hub agents for vision analysis instead of Gemini/OpenAI APIs
 * NOTE: Audio transcription is not included. Consider using Fal.ai's audio models if needed.
 */

import { trackEvaluation } from './costTrackingService';
import { extractFirstFrame, extractLastFrame } from './frameExtractionService';
import { executeFrameEvalAgent, executeAudioComparisonAgent } from './agentHubService';

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
 * Evaluate a video frame using Agent Hub frame-eval-agent
 */
export const evaluateFrameWithAgentHub = async (
  frameDataUrl: string,
  prompt: string,
  frameType: 'first' | 'last'
): Promise<{ matches: boolean; analysis: string; score: number }> => {
  console.log(`[Evaluation] Evaluating ${frameType} frame with Agent Hub`);

  const evaluationPrompt = `You are evaluating a ${frameType} frame from a video against the intended prompt.

Video Prompt: "${prompt}"

Please analyze this frame and determine:
1. Does this frame match the intended prompt? (yes/no)
2. What do you see in this frame?
3. How well does it align with the prompt? (score 0-100)
4. What specific elements match or don't match?

Frame image (base64 data URL): ${frameDataUrl}

Respond in JSON format:
{
  "matches": true/false,
  "analysis": "detailed analysis",
  "score": 0-100
}`;

  try {
    const responseText = await executeFrameEvalAgent(evaluationPrompt);
    const evaluation = JSON.parse(responseText);

    return {
      matches: evaluation.matches,
      analysis: evaluation.analysis,
      score: evaluation.score,
    };
  } catch (error) {
    console.error('[Evaluation] Frame evaluation error:', error);
    throw new Error(
      `Frame evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Compare transcribed audio with expected voiceover using Agent Hub
 */
export const compareVoiceoverWithAgentHub = async (
  transcribedText: string,
  expectedText: string
): Promise<{ matches: boolean; analysis: string; score: number }> => {
  console.log('[Evaluation] Comparing voiceover with Agent Hub');

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

  try {
    const responseText = await executeAudioComparisonAgent(comparisonPrompt);
    const comparison = JSON.parse(responseText);

    return {
      matches: comparison.matches,
      analysis: comparison.analysis,
      score: comparison.score,
    };
  } catch (error) {
    console.error('[Evaluation] Audio comparison error:', error);
    throw new Error(
      `Audio comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Evaluate a generated video using Agent Hub for all analysis
 *
 * Note: Audio transcription is skipped. If you need audio transcription:
 * 1. Use Fal.ai's audio transcription models
 * 2. Or integrate another audio transcription service
 * 3. Pass the transcribed text to compareVoiceoverWithAgentHub()
 */
export const evaluateVideo = async (
  projectId: string,
  sceneId: string,
  videoBlob: Blob,
  videoDuration: number,
  prompt: string,
  expectedVoiceover: string,
  transcribedAudio?: string  // Optional: provide if you have transcription from elsewhere
): Promise<VideoEvaluation> => {
  console.log('[Evaluation] Starting video evaluation with Agent Hub...');

  // Extract first and last frames using server-side FFmpeg
  console.log('[Evaluation] Extracting frames using server-side FFmpeg...');
  const firstFrameUrl = await extractFirstFrame(projectId, sceneId);
  const lastFrameUrl = await extractLastFrame(projectId, sceneId);

  // Evaluate frames using Agent Hub
  console.log('[Evaluation] Evaluating frames with Agent Hub...');
  const firstFrameResult = await evaluateFrameWithAgentHub(firstFrameUrl, prompt, 'first');
  const lastFrameResult = await evaluateFrameWithAgentHub(lastFrameUrl, prompt, 'last');

  // Handle audio evaluation
  let audioEvaluation: AudioEvaluation;

  if (transcribedAudio) {
    console.log('[Evaluation] Comparing voiceover with Agent Hub...');
    const voiceoverResult = await compareVoiceoverWithAgentHub(transcribedAudio, expectedVoiceover);

    audioEvaluation = {
      transcribedText: transcribedAudio,
      expectedText: expectedVoiceover,
      matchesVoiceover: voiceoverResult.matches,
      analysis: voiceoverResult.analysis,
      score: voiceoverResult.score,
    };
  } else {
    audioEvaluation = {
      transcribedText: 'Audio evaluation skipped (no transcription provided)',
      expectedText: expectedVoiceover,
      matchesVoiceover: false,
      analysis: 'Audio transcription not available. Use Fal.ai audio models for transcription.',
      score: 0,
    };
  }

  // Calculate overall score
  const overallScore = Math.round(
    (firstFrameResult.score + lastFrameResult.score + audioEvaluation.score) / 3
  );

  // Track evaluation cost
  trackEvaluation(videoDuration, !!transcribedAudio);
  console.log('[Evaluation] Cost tracked:', { audioDuration: videoDuration, includesAudio: !!transcribedAudio });

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
