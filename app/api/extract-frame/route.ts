/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

interface ExtractFrameRequest {
  projectId: string;
  sceneId: string;
  method: 'first' | 'last' | 'frame' | 'timestamp';
  frameNumber?: number;
  timestamp?: number;
}

interface VideoMetadata {
  fps: number;
  duration: number;
  totalFrames: number;
  width: number;
  height: number;
}

interface ExtractFrameResponse {
  frameDataUrl: string;
  frameNumber: number;
  timestamp: number;
  videoMetadata: VideoMetadata;
}

/**
 * Get video metadata using ffprobe
 */
async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      // Parse frame rate (e.g., "30/1" or "30000/1001")
      const fpsString = videoStream.r_frame_rate || '30/1';
      const [num, den] = fpsString.split('/').map(Number);
      const fps = num / den;

      const duration = Number(videoStream.duration) || Number(metadata.format.duration) || 0;
      const totalFrames = Number(videoStream.nb_frames) || Math.floor(duration * fps);
      const width = videoStream.width || 0;
      const height = videoStream.height || 0;

      resolve({
        fps,
        duration,
        totalFrames,
        width,
        height,
      });
    });
  });
}

/**
 * Extract frame from video by frame number
 */
async function extractFrameByNumber(
  videoPath: string,
  frameNumber: number,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        `-vf select='eq(n\\,${frameNumber})'`,
        '-vframes 1',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Extract frame from video by timestamp (fallback for compatibility)
 */
async function extractFrameByTimestamp(
  videoPath: string,
  timestamp: number,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestamp)
      .outputOptions(['-vframes 1'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: ExtractFrameRequest = await request.json();
    const { projectId, sceneId, method, frameNumber, timestamp } = body;

    // Validate input
    if (!projectId || !sceneId || !method) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, sceneId, method' },
        { status: 400 }
      );
    }

    // Construct video file path
    const videoPath = path.join(process.cwd(), 'public', 'videos', projectId, `${sceneId}.mp4`);

    // Check if video exists
    try {
      await fs.access(videoPath);
    } catch {
      return NextResponse.json(
        { error: 'Video file not found', videoPath },
        { status: 404 }
      );
    }

    // Get video metadata
    const metadata = await getVideoMetadata(videoPath);

    // Determine target frame number
    let targetFrame: number;
    let targetTimestamp: number;

    if (method === 'first') {
      targetFrame = 0;
      targetTimestamp = 0;
    } else if (method === 'last') {
      // Extract the EXACT last frame
      targetFrame = metadata.totalFrames - 1;
      targetTimestamp = targetFrame / metadata.fps;
    } else if (method === 'frame' && frameNumber !== undefined) {
      targetFrame = Math.max(0, Math.min(frameNumber, metadata.totalFrames - 1));
      targetTimestamp = targetFrame / metadata.fps;
    } else if (method === 'timestamp' && timestamp !== undefined) {
      targetTimestamp = Math.max(0, Math.min(timestamp, metadata.duration));
      targetFrame = Math.floor(targetTimestamp * metadata.fps);
    } else {
      return NextResponse.json(
        { error: 'Invalid method or missing frameNumber/timestamp' },
        { status: 400 }
      );
    }

    // Create temp output file
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `frame-${Date.now()}.png`);

    // Extract frame (use frame-based extraction for precision)
    await extractFrameByNumber(videoPath, targetFrame, outputPath);

    // Read extracted frame and convert to base64
    const frameBuffer = await fs.readFile(outputPath);
    const base64Frame = frameBuffer.toString('base64');
    const frameDataUrl = `data:image/png;base64,${base64Frame}`;

    // Clean up temp file
    await fs.unlink(outputPath).catch(() => {});

    const response: ExtractFrameResponse = {
      frameDataUrl,
      frameNumber: targetFrame,
      timestamp: targetTimestamp,
      videoMetadata: metadata,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Frame extraction error:', error);
    return NextResponse.json(
      {
        error: 'Frame extraction failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
