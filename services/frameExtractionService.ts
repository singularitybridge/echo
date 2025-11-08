/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VideoMetadata {
  fps: number;
  duration: number;
  totalFrames: number;
  width: number;
  height: number;
}

export interface ExtractedFrame {
  frameDataUrl: string;
  frameNumber: number;
  timestamp: number;
  videoMetadata: VideoMetadata;
}

/**
 * Extract a frame from a video using server-side FFmpeg
 * This provides frame-perfect extraction with exact frame numbers
 */
export async function extractFrame(
  projectId: string,
  sceneId: string,
  method: 'first' | 'last' | 'frame' | 'timestamp',
  options?: {
    frameNumber?: number;
    timestamp?: number;
  }
): Promise<ExtractedFrame> {
  const response = await fetch('/api/extract-frame', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      sceneId,
      method,
      frameNumber: options?.frameNumber,
      timestamp: options?.timestamp,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Frame extraction failed');
  }

  return response.json();
}

/**
 * Extract the first frame of a video (frame 0)
 */
export async function extractFirstFrame(
  projectId: string,
  sceneId: string
): Promise<string> {
  const result = await extractFrame(projectId, sceneId, 'first');
  console.log(`Extracted first frame (frame #${result.frameNumber}) at ${result.timestamp.toFixed(3)}s`);
  return result.frameDataUrl;
}

/**
 * Extract the last frame of a video (exact last frame)
 */
export async function extractLastFrame(
  projectId: string,
  sceneId: string
): Promise<string> {
  const result = await extractFrame(projectId, sceneId, 'last');
  console.log(
    `Extracted last frame (frame #${result.frameNumber}/${result.videoMetadata.totalFrames}) at ${result.timestamp.toFixed(3)}s`
  );
  return result.frameDataUrl;
}

/**
 * Extract a frame by exact frame number
 */
export async function extractFrameByNumber(
  projectId: string,
  sceneId: string,
  frameNumber: number
): Promise<string> {
  const result = await extractFrame(projectId, sceneId, 'frame', { frameNumber });
  console.log(`Extracted frame #${result.frameNumber} at ${result.timestamp.toFixed(3)}s`);
  return result.frameDataUrl;
}

/**
 * Extract a frame by timestamp (for backward compatibility)
 */
export async function extractFrameByTimestamp(
  projectId: string,
  sceneId: string,
  timestamp: number
): Promise<string> {
  const result = await extractFrame(projectId, sceneId, 'timestamp', { timestamp });
  console.log(`Extracted frame #${result.frameNumber} at ${result.timestamp.toFixed(3)}s`);
  return result.frameDataUrl;
}

/**
 * Get video metadata without extracting a frame
 */
export async function getVideoMetadata(
  projectId: string,
  sceneId: string
): Promise<VideoMetadata> {
  // We can use first frame extraction to get metadata
  const result = await extractFrame(projectId, sceneId, 'first');
  return result.videoMetadata;
}

/**
 * Extract first frame from a video blob URL (client-side)
 * Used for generating thumbnails from video blobs before saving to server
 */
export async function extractFirstFrameFromBlob(
  videoUrl: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';

    video.onloadeddata = () => {
      // Seek to 0.1 seconds to ensure we get a valid frame
      video.currentTime = 0.1;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');

        // Clean up
        video.remove();

        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.src = videoUrl;
  });
}
