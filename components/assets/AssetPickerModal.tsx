/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Check,
  Image as ImageIcon,
  Box,
  MapPin,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { Asset, AssetType } from '@/types/asset';
import type { SceneAssetAttachment } from '@/types/project';

interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  sceneId: string;
  currentAttachments: SceneAssetAttachment[];
  onSaveAttachments: (attachments: SceneAssetAttachment[]) => void;
}

export default function AssetPickerModal({
  isOpen,
  onClose,
  projectId,
  sceneId,
  currentAttachments,
  onSaveAttachments,
}: AssetPickerModalProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<AssetType | 'all'>('all');
  const [attachments, setAttachments] = useState<SceneAssetAttachment[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadAssets();
      setAttachments([...currentAttachments]);
    }
  }, [isOpen, projectId, selectedType]);

  const loadAssets = async () => {
    try {
      setLoading(true);

      // Build query parameters
      const params = new URLSearchParams({
        projectId,
        page: '1',
        pageSize: '50',
      });

      if (selectedType !== 'all') {
        params.append('type', selectedType);
      }

      const response = await fetch(`/api/assets?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load assets');
      }

      const data = await response.json();
      setAssets(data.assets || []);
    } catch (error) {
      console.error('Failed to load assets:', error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const isAttached = (assetId: string) => {
    return attachments.some((a) => a.assetId === assetId);
  };

  const getAttachment = (assetId: string) => {
    return attachments.find((a) => a.assetId === assetId);
  };

  const handleToggleAsset = (assetId: string, assetType: AssetType) => {
    if (isAttached(assetId)) {
      // Remove
      setAttachments(attachments.filter((a) => a.assetId !== assetId));
    } else {
      // Add with default role based on asset type
      const defaultRole =
        assetType === 'character'
          ? 'character'
          : assetType === 'location'
          ? 'background'
          : 'prop';

      setAttachments([
        ...attachments,
        {
          assetId,
          role: defaultRole,
          order: attachments.length,
        },
      ]);
    }
  };

  const handleUpdateRole = (
    assetId: string,
    role: 'character' | 'background' | 'prop'
  ) => {
    setAttachments(
      attachments.map((a) => (a.assetId === assetId ? { ...a, role } : a))
    );
  };

  const handleMoveUp = (assetId: string) => {
    const index = attachments.findIndex((a) => a.assetId === assetId);
    if (index > 0) {
      const newAttachments = [...attachments];
      [newAttachments[index - 1], newAttachments[index]] = [
        newAttachments[index],
        newAttachments[index - 1],
      ];
      // Update order values
      newAttachments.forEach((a, i) => (a.order = i));
      setAttachments(newAttachments);
    }
  };

  const handleMoveDown = (assetId: string) => {
    const index = attachments.findIndex((a) => a.assetId === assetId);
    if (index < attachments.length - 1) {
      const newAttachments = [...attachments];
      [newAttachments[index], newAttachments[index + 1]] = [
        newAttachments[index + 1],
        newAttachments[index],
      ];
      // Update order values
      newAttachments.forEach((a, i) => (a.order = i));
      setAttachments(newAttachments);
    }
  };

  const handleSave = () => {
    onSaveAttachments(attachments);
    onClose();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'character':
        return 'bg-blue-100 text-blue-700';
      case 'background':
        return 'bg-green-100 text-green-700';
      case 'prop':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'character':
        return <ImageIcon className="w-3 h-3" />;
      case 'background':
        return <MapPin className="w-3 h-3" />;
      case 'prop':
        return <Box className="w-3 h-3" />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Attach Assets to Scene
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Select assets to use in this scene's video generation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Asset Library */}
          <div className="flex-1 flex flex-col border-r border-gray-200">
            {/* Type Filter */}
            <div className="px-6 py-3 border-b border-gray-200 flex gap-2">
              {[
                { value: 'all', label: 'All', icon: Box },
                { value: 'character', label: 'Characters', icon: ImageIcon },
                { value: 'prop', label: 'Props', icon: Box },
                { value: 'location', label: 'Locations', icon: MapPin },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setSelectedType(value as AssetType | 'all')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    selectedType === value
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Asset Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-gray-400">Loading assets...</div>
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <Box className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-sm text-gray-500">No assets found</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {assets.map((asset) => {
                    const attached = isAttached(asset.id);
                    return (
                      <div
                        key={asset.id}
                        className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                          attached
                            ? 'border-indigo-500 ring-2 ring-indigo-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleToggleAsset(asset.id, asset.type)}
                      >
                        {/* Image */}
                        <div className="aspect-video bg-gray-100">
                          <img
                            src={asset.imageUrl}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Asset Info */}
                        <div className="p-2">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {asset.name}
                          </h4>
                        </div>

                        {/* Selected Badge */}
                        {attached && (
                          <div className="absolute top-2 right-2 p-1.5 bg-indigo-600 rounded-full shadow-lg">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Attached Assets */}
          <div className="w-96 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                Attached Assets ({attachments.length})
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Order determines reference priority
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {attachments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">No assets attached</p>
                  <p className="text-xs mt-1">
                    Click assets on the left to attach them
                  </p>
                </div>
              ) : (
                attachments.map((attachment, index) => {
                  const asset = assets.find((a) => a.id === attachment.assetId);
                  if (!asset) return null;

                  return (
                    <div
                      key={attachment.assetId}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      {/* Asset Thumbnail */}
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.name}
                        className="w-16 h-10 object-cover rounded"
                      />

                      {/* Asset Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {asset.name}
                        </h4>

                        {/* Role Selector */}
                        <div className="flex gap-1 mt-1">
                          {['character', 'background', 'prop'].map((role) => (
                            <button
                              key={role}
                              onClick={() =>
                                handleUpdateRole(
                                  attachment.assetId,
                                  role as 'character' | 'background' | 'prop'
                                )
                              }
                              className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                                attachment.role === role
                                  ? getRoleColor(role)
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              {getRoleIcon(role)}
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Reorder Controls */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleMoveUp(attachment.assetId)}
                          disabled={index === 0}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronUp className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(attachment.assetId)}
                          disabled={index === attachments.length - 1}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() =>
                          setAttachments(
                            attachments.filter(
                              (a) => a.assetId !== attachment.assetId
                            )
                          )
                        }
                        className="p-1.5 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {attachments.length} asset{attachments.length !== 1 ? 's' : ''}{' '}
            attached
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Save Attachments
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
