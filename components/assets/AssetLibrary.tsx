/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Upload,
  Image as ImageIcon,
  MapPin,
  Box,
  Search,
  Filter,
  Radio,
} from 'lucide-react';
import type { Asset, AssetType, AssetLibraryResponse, AssetProvider } from '@/types/asset';
import type { AspectRatio } from '@/types/project';
import { assetStorage } from '@/services/assetStorage.server';
import AssetCard from './AssetCard';
import AssetGenerationChatModal from './AssetGenerationChatModal';
import UploadAssetModal from './UploadAssetModal';
import EditAssetModal from './EditAssetModal';
import { AlertDialog } from '../AlertDialog';

interface AssetLibraryProps {
  projectId: string;
}

export default function AssetLibrary({ projectId }: AssetLibraryProps) {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<AssetType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState({
    totalAssets: 0,
    byType: { character: 0, prop: 0, location: 0 },
  });
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load assets on mount
  useEffect(() => {
    loadAssets();
  }, [projectId, selectedType, searchQuery]);

  const loadAssets = async () => {
    try {
      setLoading(true);

      const query = {
        projectId,
        filters: {
          type: selectedType === 'all' ? undefined : selectedType,
          search: searchQuery || undefined,
        },
        pagination: {
          page: 1,
          pageSize: 50,
        },
      };

      const response: AssetLibraryResponse = await assetStorage.getAssets(query);
      setAssets(response.assets);
      setSummary(response.summary);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    if (asset) {
      setAssetToDelete(asset);
    }
  };

  const confirmDelete = async () => {
    if (!assetToDelete) return;

    try {
      await assetStorage.deleteAsset(assetToDelete.id);
      setAssetToDelete(null);
      await loadAssets(); // Reload assets
    } catch (error) {
      console.error('Failed to delete asset:', error);
      setDeleteError('Failed to delete asset. Please try again.');
    }
  };

  const handleSaveAssets = async (
    assetsToSave: Array<{
      type: AssetType;
      name: string;
      description: string;
      aspectRatio: AspectRatio;
      imageBlob: Blob;
      prompt: string;
      provider: AssetProvider;
    }>
  ) => {
    try {
      // Save images and create asset metadata
      for (const assetData of assetsToSave) {
        // Generate unique ID for the asset
        const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Save the image file
        const imageUrl = await assetStorage.saveAssetImage(
          projectId,
          assetId,
          assetData.type,
          assetData.imageBlob
        );

        // Create asset metadata
        await assetStorage.createAsset({
          projectId,
          type: assetData.type,
          name: assetData.name,
          description: assetData.description,
          aspectRatio: assetData.aspectRatio,
          imageUrl,
          thumbnailUrl: imageUrl, // Use same URL for now
          generationPrompt: assetData.prompt,
          provider: assetData.provider,
          tags: [],
          editHistory: [],
          relatedAssets: [],
          usedInScenes: [],
        });
      }

      // Reload assets to show new ones
      await loadAssets();
    } catch (error) {
      console.error('Failed to save assets:', error);
      throw error;
    }
  };

  const typeButtons: Array<{
    value: AssetType | 'all';
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    {
      value: 'all',
      label: 'All Assets',
      icon: <Box className="w-4 h-4" />,
      count: summary.totalAssets,
    },
    {
      value: 'character',
      label: 'Characters',
      icon: <ImageIcon className="w-4 h-4" />,
      count: summary.byType.character,
    },
    {
      value: 'prop',
      label: 'Props',
      icon: <Box className="w-4 h-4" />,
      count: summary.byType.prop,
    },
    {
      value: 'location',
      label: 'Locations',
      icon: <MapPin className="w-4 h-4" />,
      count: summary.byType.location,
    },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/projects/${projectId}`)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Project
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">Asset Library</h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                onClick={() => setShowGenerateModal(true)}
              >
                <Plus className="w-4 h-4" />
                Generate
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search assets by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        {/* Type Tabs */}
        <div className="px-6 flex gap-2 border-t border-gray-200">
          {typeButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setSelectedType(btn.value)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                selectedType === btn.value
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {btn.icon}
              {btn.label}
              {btn.count !== undefined && btn.count > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {btn.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading assets...</div>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-full max-w-md h-48 mb-6">
              <img
                src="/docs/asset-library-empty-state.png"
                alt="Asset Library"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assets yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Get started by generating or uploading your first asset
            </p>
            <div className="flex gap-2">
              <button
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                onClick={() => setShowGenerateModal(true)}
              >
                <Plus className="w-4 h-4" />
                Generate Asset
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload className="w-4 h-4" />
                Upload Asset
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={handleDeleteAsset}
                onEdit={(assetId) => {
                  const asset = assets.find(a => a.id === assetId);
                  if (asset) {
                    setAssetToEdit(asset);
                    setShowEditModal(true);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Generate Asset Modal */}
      <AssetGenerationChatModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        projectId={projectId}
        onSaveAssets={handleSaveAssets}
      />

      {/* Upload Asset Modal */}
      <UploadAssetModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        projectId={projectId}
        onUploadComplete={loadAssets}
      />

      {/* Edit Asset Modal */}
      <EditAssetModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setAssetToEdit(null);
        }}
        asset={assetToEdit}
        onEditComplete={loadAssets}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={!!assetToDelete}
        onClose={() => setAssetToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Asset"
        description={`Are you sure you want to delete "${assetToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Delete Error Dialog */}
      <AlertDialog
        isOpen={!!deleteError}
        onClose={() => setDeleteError(null)}
        onConfirm={() => setDeleteError(null)}
        title="Error"
        description={deleteError || 'An error occurred'}
        confirmText="OK"
        variant="destructive"
      />
    </div>
  );
}
