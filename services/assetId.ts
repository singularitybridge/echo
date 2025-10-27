/**
 * Asset ID Generator
 * Generates unique, human-readable asset IDs
 *
 * Format: ast_{semantic}_{timestamp}_{random}
 * Example: ast_sarah_1761480000_a1b2
 */

/**
 * Generate a unique asset ID
 * @param semanticName Optional human-readable name (e.g., "Captain Sarah", "Mars Base")
 * @returns Unique asset ID
 */
export function generateAssetId(semanticName?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);

  if (semanticName) {
    // Clean and truncate semantic name
    const clean = semanticName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
      .replace(/^_+|_+$/g, '')      // Remove leading/trailing underscores
      .substring(0, 20);             // Max 20 characters

    if (clean) {
      return `ast_${clean}_${timestamp}_${random}`;
    }
  }

  return `ast_${timestamp}_${random}`;
}

/**
 * Validate an asset ID format
 * @param assetId Asset ID to validate
 * @returns True if valid asset ID format
 */
export function isValidAssetId(assetId: string): boolean {
  // Pattern: ast_{optional_semantic}_{timestamp}_{random}
  const pattern = /^ast_([a-z0-9_]+_)?\d{13}_[a-z0-9]{4}$/;
  return pattern.test(assetId);
}

/**
 * Extract semantic name from asset ID
 * @param assetId Asset ID
 * @returns Semantic name or null if not present
 */
export function getSemanticName(assetId: string): string | null {
  const parts = assetId.split('_');

  // Format: ast_{semantic}_{timestamp}_{random}
  // If there are 4 parts, semantic name is at index 1
  if (parts.length === 4 && parts[0] === 'ast') {
    return parts[1];
  }

  return null;
}

/**
 * Extract timestamp from asset ID
 * @param assetId Asset ID
 * @returns Timestamp or null if invalid
 */
export function getTimestamp(assetId: string): number | null {
  const parts = assetId.split('_');

  // Timestamp is always second-to-last part
  const timestampStr = parts[parts.length - 2];
  const timestamp = parseInt(timestampStr, 10);

  if (!isNaN(timestamp)) {
    return timestamp;
  }

  return null;
}
