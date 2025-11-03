/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAsset } from '@/services/assetStorage';
import type { Asset } from '@/types/asset';

/**
 * GET - Get the full version lineage of an asset
 * Walks backwards through parentAssetId chain and returns assets ordered from v1 to current
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params;

    // Get the requested asset
    const currentAsset = await getAsset(assetId);

    if (!currentAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Build version lineage by walking backwards through parentAssetId chain
    const lineage: Asset[] = [currentAsset];
    let current = currentAsset;

    // Walk backwards until we hit the root (parentAssetId is null)
    while (current.parentAssetId) {
      const parent = await getAsset(current.parentAssetId);

      if (!parent) {
        console.warn(`Parent asset ${current.parentAssetId} not found, stopping lineage walk`);
        break;
      }

      lineage.unshift(parent); // Add to beginning (we're walking backwards)
      current = parent;

      // Safety check to prevent infinite loops
      if (lineage.length > 100) {
        console.error('Asset lineage exceeded 100 versions, possible circular reference');
        break;
      }
    }

    // Lineage is now ordered from v1 (root) to current version
    return NextResponse.json({
      assetId: currentAsset.id,
      currentVersion: currentAsset.version,
      totalVersions: lineage.length,
      lineage,
    });
  } catch (error) {
    console.error('Error fetching asset lineage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset lineage' },
      { status: 500 }
    );
  }
}
