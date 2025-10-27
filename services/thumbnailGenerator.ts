/**
 * Thumbnail Generator Service
 * Generates thumbnails for assets using sharp
 */

import sharp from 'sharp';
import { writeFile } from 'fs/promises';

/**
 * Generate a thumbnail from image buffer
 * @param imageBuffer Source image buffer
 * @param size Thumbnail size (default: 256x256)
 * @returns Thumbnail buffer
 */
export async function generateThumbnail(
  imageBuffer: Buffer,
  size: number = 256
): Promise<Buffer> {
  try {
    const thumbnail = await sharp(imageBuffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}

/**
 * Generate thumbnail from file path and save to target path
 * @param sourcePath Source image file path
 * @param targetPath Target thumbnail file path
 * @param size Thumbnail size (default: 256x256)
 */
export async function generateThumbnailFromFile(
  sourcePath: string,
  targetPath: string,
  size: number = 256
): Promise<void> {
  try {
    await sharp(sourcePath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .toFile(targetPath);
  } catch (error) {
    console.error('Error generating thumbnail from file:', error);
    throw error;
  }
}

/**
 * Get image dimensions
 * @param imageBuffer Image buffer
 * @returns Width and height
 */
export async function getImageDimensions(
  imageBuffer: Buffer
): Promise<{ width: number; height: number }> {
  try {
    const metadata = await sharp(imageBuffer).metadata();

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    throw error;
  }
}

/**
 * Convert image to specific format
 * @param imageBuffer Source image buffer
 * @param format Target format (png, jpg, webp)
 * @returns Converted image buffer
 */
export async function convertImageFormat(
  imageBuffer: Buffer,
  format: 'png' | 'jpg' | 'webp'
): Promise<Buffer> {
  try {
    let pipeline = sharp(imageBuffer);

    switch (format) {
      case 'png':
        pipeline = pipeline.png();
        break;
      case 'jpg':
        pipeline = pipeline.jpeg({ quality: 90 });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality: 90 });
        break;
    }

    return await pipeline.toBuffer();
  } catch (error) {
    console.error('Error converting image format:', error);
    throw error;
  }
}
