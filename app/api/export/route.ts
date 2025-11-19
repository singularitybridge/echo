/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import ffmpeg from 'fluent-ffmpeg';

const VIDEOS_DIR = join(process.cwd(), 'public', 'videos');
const TEMP_DIR = join(process.cwd(), 'temp');

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

interface SceneTrimInfo {
  id: string;
  startTrim: number;
  endTrim: number;
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, scenes } = await request.json();

    if (!projectId || !scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: projectId and scenes are required' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const trimmedVideoPaths: string[] = [];

    // Trim each video according to its in/out points
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i] as SceneTrimInfo;
      const videoPath = join(VIDEOS_DIR, projectId, `${scene.id}.mp4`);

      if (!existsSync(videoPath)) {
        console.warn(`Video not found: ${videoPath}`);
        continue;
      }

      const trimmedVideoPath = join(TEMP_DIR, `trimmed-${timestamp}-${i}.mp4`);
      const duration = scene.endTrim - scene.startTrim;

      // Trim the video using FFmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .setStartTime(scene.startTrim)
          .setDuration(duration)
          .outputOptions([
            '-c:v libx264',      // Re-encode video
            '-preset fast',      // Faster encoding
            '-crf 18',           // High quality
            '-c:a aac',          // Re-encode audio
            '-b:a 192k'          // Audio bitrate
          ])
          .output(trimmedVideoPath)
          .on('end', () => {
            console.log(`Trimmed video ${i + 1}/${scenes.length}`);
            trimmedVideoPaths.push(trimmedVideoPath);
            resolve();
          })
          .on('error', (err: Error) => {
            console.error('FFmpeg trim error:', err);
            reject(err);
          })
          .run();
      });
    }

    if (trimmedVideoPaths.length === 0) {
      return NextResponse.json(
        { error: 'No video files found' },
        { status: 404 }
      );
    }

    // Create a file list for FFmpeg concat demuxer
    const listFilePath = join(TEMP_DIR, `concat-list-${timestamp}.txt`);
    const outputFilePath = join(TEMP_DIR, `output-${timestamp}.mp4`);

    // Write file list for concat demuxer
    const fileListContent = trimmedVideoPaths.map(path => `file '${path}'`).join('\n');
    writeFileSync(listFilePath, fileListContent);

    // Concatenate the trimmed videos
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy']) // Copy codec since all videos are already re-encoded consistently
        .output(outputFilePath)
        .on('end', () => {
          console.log('Video concatenation completed');
          resolve();
        })
        .on('error', (err: Error) => {
          console.error('FFmpeg concat error:', err);
          reject(err);
        })
        .run();
    });

    // Read the concatenated video file
    const videoBuffer = readFileSync(outputFilePath);

    // Clean up temporary files
    try {
      unlinkSync(listFilePath);
      unlinkSync(outputFilePath);
      // Clean up trimmed video files
      for (const trimmedPath of trimmedVideoPaths) {
        try {
          unlinkSync(trimmedPath);
        } catch (err) {
          console.error('Failed to delete trimmed video:', err);
        }
      }
    } catch (err) {
      console.error('Failed to clean up temporary files:', err);
    }

    // Return the video file as a response
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${projectId}-full.mp4"`,
      },
    });
  } catch (error) {
    console.error('Error exporting video:', error);
    return NextResponse.json(
      { error: 'Failed to export video' },
      { status: 500 }
    );
  }
}
