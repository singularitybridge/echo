/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { X, Settings2, Image as ImageIcon } from 'lucide-react';
import { AspectRatio, VeoModel, Resolution } from '../types';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectDescription: string;
  aspectRatio: AspectRatio;
  defaultModel: VeoModel;
  defaultResolution: Resolution;
  generationMetadata?: {
    mode: 'quick' | 'custom';
    timestamp: string;
    originalParams: Record<string, any>;
  };
  onSave: (settings: {
    title: string;
    description: string;
    aspectRatio: AspectRatio;
    defaultModel: VeoModel;
    defaultResolution: Resolution;
  }) => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  projectName,
  projectDescription,
  aspectRatio,
  defaultModel,
  defaultResolution,
  generationMetadata,
  onSave,
}) => {
  const [title, setTitle] = useState(projectName);
  const [description, setDescription] = useState(projectDescription);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(aspectRatio);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [selectedResolution, setSelectedResolution] = useState(defaultResolution);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      title,
      description,
      aspectRatio: selectedAspectRatio,
      defaultModel: selectedModel,
      defaultResolution: selectedResolution,
    });
    onClose();
  };

  const getAspectRatioLabel = (ratio: AspectRatio) => {
    switch (ratio) {
      case AspectRatio.PORTRAIT:
        return '9:16 Portrait';
      case AspectRatio.LANDSCAPE:
        return '16:9 Landscape';
      case AspectRatio.SQUARE:
        return '1:1 Square';
      default:
        return ratio;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Settings2 size={20} className="text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Story Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Story Info Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Story Information</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Story Name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Describe your project"
                />
              </div>
            </div>
          </div>

          {/* Creation Parameters Section */}
          {generationMetadata && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Creation Parameters</h3>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Creation Mode</span>
                  <span className="text-sm font-semibold text-gray-900 capitalize">
                    {generationMetadata.mode === 'quick' ? 'Quick Start' : 'Custom Story'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Created At</span>
                  <span className="text-sm text-gray-900">
                    {new Date(generationMetadata.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <div className="text-sm font-medium text-gray-600 mb-2">Parameters</div>
                  <div className="space-y-2">
                    {generationMetadata.mode === 'quick' ? (
                      <>
                        {generationMetadata.originalParams.genre && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Genre</span>
                            <span className="text-xs font-medium text-gray-700 capitalize">
                              {generationMetadata.originalParams.genre}
                            </span>
                          </div>
                        )}
                        {generationMetadata.originalParams.type && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Story Type</span>
                            <span className="text-xs font-medium text-gray-700 capitalize">
                              {generationMetadata.originalParams.type.replace('-', ' ')}
                            </span>
                          </div>
                        )}
                        {generationMetadata.originalParams.energy && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Energy</span>
                            <span className="text-xs font-medium text-gray-700 capitalize">
                              {generationMetadata.originalParams.energy}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {generationMetadata.originalParams.concept && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Concept</div>
                            <div className="text-xs text-gray-700 bg-white rounded px-2 py-1">
                              {generationMetadata.originalParams.concept}
                            </div>
                          </div>
                        )}
                        {generationMetadata.originalParams.character && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Character</div>
                            <div className="text-xs text-gray-700 bg-white rounded px-2 py-1">
                              {generationMetadata.originalParams.character}
                            </div>
                          </div>
                        )}
                        {generationMetadata.originalParams.mood && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Mood</div>
                            <div className="text-xs text-gray-700 bg-white rounded px-2 py-1">
                              {generationMetadata.originalParams.mood}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Video Settings Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Video Settings</h3>

            <div className="space-y-4">
              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aspect Ratio
                  <span className="text-xs text-gray-500 ml-2">(applies to all scenes)</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[AspectRatio.PORTRAIT, AspectRatio.LANDSCAPE, AspectRatio.SQUARE].map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setSelectedAspectRatio(ratio)}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        selectedAspectRatio === ratio
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={`border-2 rounded ${
                            ratio === AspectRatio.PORTRAIT
                              ? 'w-6 h-10'
                              : ratio === AspectRatio.LANDSCAPE
                              ? 'w-10 h-6'
                              : 'w-8 h-8'
                          } ${
                            selectedAspectRatio === ratio
                              ? 'border-indigo-600 bg-indigo-100'
                              : 'border-gray-400'
                          }`}
                        />
                        <span className="text-xs font-medium text-gray-700">
                          {getAspectRatioLabel(ratio)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Model
                  <span className="text-xs text-gray-500 ml-2">(default for new scenes)</span>
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as VeoModel)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value={VeoModel.VEO}>Veo 3.1</option>
                </select>
              </div>

              {/* Default Resolution */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Resolution
                  <span className="text-xs text-gray-500 ml-2">(default for new scenes)</span>
                </label>
                <select
                  value={selectedResolution}
                  onChange={(e) => setSelectedResolution(e.target.value as Resolution)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value={Resolution.P720}>720p</option>
                  <option value={Resolution.P1080}>1080p</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
