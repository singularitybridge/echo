/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Wand2,
  Loader2,
  Check,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react';
import type { Asset } from '@/types/asset';

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onEditComplete: () => void;
}

export default function EditAssetModal({
  isOpen,
  onClose,
  asset,
  onEditComplete,
}: EditAssetModalProps) {
  const [editPrompt, setEditPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const [editedAsset, setEditedAsset] = useState<Asset | null>(null);
  const [showComparison, setShowComparison] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setEditPrompt('');
      setEditing(false);
      setEditedAsset(null);
      setShowComparison(true);
    }
  }, [isOpen]);

  const handleEdit = async () => {
    if (!asset || !editPrompt.trim()) {
      alert('Please enter an edit prompt');
      return;
    }

    setEditing(true);

    try {
      const response = await fetch(`/api/assets/${asset.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editPrompt: editPrompt.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to edit asset');
      }

      const result = await response.json();
      setEditedAsset(result);
    } catch (error) {
      console.error('Failed to edit asset:', error);
      alert('Failed to edit asset. Please try again.');
    } finally {
      setEditing(false);
    }
  };

  const handleSave = async () => {
    if (!editedAsset) return;

    // Save and close
    onEditComplete();
    onClose();
  };

  const handleReset = () => {
    setEditedAsset(null);
    setEditPrompt('');
  };

  if (!isOpen || !asset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Wand2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Asset with AI</h2>
              <p className="text-sm text-gray-500">
                Describe the changes you want to make
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={editing}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Asset Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-5 h-5 text-gray-400" />
              <div>
                <h3 className="font-medium text-gray-900">{asset.name}</h3>
                <p className="text-sm text-gray-500">{asset.description}</p>
              </div>
            </div>
          </div>

          {/* Edit Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Edit Instructions
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              disabled={editing || !!editedAsset}
              rows={3}
              placeholder="e.g., Add a red hat, Change background to blue sky, Make the character smile..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Describe what changes you want to make to the image
            </p>
          </div>

          {/* Before/After Comparison */}
          {showComparison && (
            <div className="grid grid-cols-2 gap-4">
              {/* Original */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Original</div>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Edited */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  {editedAsset ? 'Edited' : 'Preview'}
                </div>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {editedAsset ? (
                    <img
                      src={editedAsset.url}
                      alt="Edited"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-gray-400">
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Edited version will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Edit History */}
          {asset.editHistory && asset.editHistory.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Edit History</h4>
              <div className="space-y-2">
                {asset.editHistory.map((edit, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    <span className="font-medium">Edit {index + 1}:</span> {edit.prompt}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div>
            {editedAsset && (
              <button
                onClick={handleReset}
                disabled={editing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={editing}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {editedAsset ? (
              <button
                onClick={handleSave}
                disabled={editing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Save Changes
              </button>
            ) : (
              <button
                onClick={handleEdit}
                disabled={editing || !editPrompt.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Editing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Apply Edit
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
