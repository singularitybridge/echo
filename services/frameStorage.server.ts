/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client-side service for managing frame images via API
 * Replaces inline base64 data URLs with file references
 */
class FrameStorageServer {
  /**
   * Save a frame image to server storage
   * @param projectId - Project ID
   * @param sceneId - Scene ID
   * @param frameType - 'first' or 'last'
   * @param dataUrl - Base64 data URL (e.g., "data:image/png;base64,...")
   * @returns Public URL to the saved frame image
   */
  async saveFrame(
    projectId: string,
    sceneId: string,
    frameType: 'first' | 'last',
    dataUrl: string
  ): Promise<string> {
    const response = await fetch('/api/frames', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        sceneId,
        frameType,
        dataUrl,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save frame');
    }

    const data = await response.json();
    return data.url;
  }

  /**
   * Get frame image URL
   * @param projectId - Project ID
   * @param sceneId - Scene ID
   * @param frameType - 'first' or 'last'
   * @returns Public URL to the frame image, or null if not found
   */
  async getFrame(
    projectId: string,
    sceneId: string,
    frameType: 'first' | 'last'
  ): Promise<string | null> {
    const response = await fetch(
      `/api/frames?projectId=${projectId}&sceneId=${sceneId}&frameType=${frameType}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to get frame');
    }

    const data = await response.json();
    return data.url;
  }

  /**
   * Delete a frame image
   * @param projectId - Project ID
   * @param sceneId - Scene ID
   * @param frameType - 'first' or 'last'
   */
  async deleteFrame(
    projectId: string,
    sceneId: string,
    frameType: 'first' | 'last'
  ): Promise<void> {
    const response = await fetch(
      `/api/frames?projectId=${projectId}&sceneId=${sceneId}&frameType=${frameType}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error('Failed to delete frame');
    }
  }

  /**
   * Check if a data URL needs to be saved to storage
   * @param url - URL or data URL
   * @returns true if it's a base64 data URL that should be saved
   */
  isDataUrl(url: string | undefined): url is string {
    return !!url && url.startsWith('data:image/');
  }

  /**
   * Check if URL is already a file reference
   * @param url - URL to check
   * @returns true if it's a file path (not a data URL)
   */
  isFileUrl(url: string | undefined): boolean {
    return !!url && !url.startsWith('data:');
  }
}

export const frameStorage = new FrameStorageServer();
