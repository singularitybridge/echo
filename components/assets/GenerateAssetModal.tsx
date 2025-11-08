/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState } from 'react';
import { X, Sparkles, Check, Loader2, User, Box, MapPin } from 'lucide-react';
import type { AssetType, AssetProvider } from '@/types/asset';
import type { AspectRatio } from '@/types/project';
import { generateImage, type GeneratedImage } from '@/services/imageService';

interface GenerateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSaveAssets: (
    assets: Array<{
      type: AssetType;
      name: string;
      description: string;
      aspectRatio: AspectRatio;
      imageBlob: Blob;
      prompt: string;
      provider: AssetProvider;
    }>
  ) => void;
}

interface GeneratedVariation {
  id: string;
  image: GeneratedImage;
  selected: boolean;
}

export default function GenerateAssetModal({
  isOpen,
  onClose,
  projectId,
  onSaveAssets,
}: GenerateAssetModalProps) {
  const [assetType, setAssetType] = useState<AssetType>('character');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('16:9');
  const [numberOfVariations, setNumberOfVariations] = useState(3);
  const [provider, setProvider] = useState<AssetProvider>('gemini');
  const [generating, setGenerating] = useState(false);
  const [variations, setVariations] = useState<GeneratedVariation[]>([]);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Please enter a description for the asset');
      return;
    }

    setGenerating(true);
    setVariations([]);

    try {
      // Generate enhanced prompts based on asset type
      const basePrompt = prompt.trim();
      const enhancedPrompts = [];

      for (let i = 0; i < numberOfVariations; i++) {
        let enhancedPrompt = basePrompt;

        if (assetType === 'character') {
          const variations = [
            'front-facing portrait, neutral expression, professional lighting',
            'slightly angled view, friendly expression, soft lighting',
            'three-quarter view, engaging expression, natural lighting',
            'full body pose, confident stance, balanced composition',
            'close-up portrait, detailed features, studio lighting',
            'dynamic pose, expressive, dramatic lighting',
          ];
          enhancedPrompt = `${basePrompt}, ${variations[i % variations.length]}, high quality photorealistic`;
        } else if (assetType === 'prop') {
          const variations = [
            'centered composition, clean background, product photography style',
            'slightly angled view, soft shadows, professional lighting',
            'detailed view, textured surface, studio lighting',
            'dramatic angle, interesting perspective, focused composition',
            'overhead view, flat lay style, even lighting',
            'close-up detail, macro perspective, sharp focus',
          ];
          enhancedPrompt = `${basePrompt}, ${variations[i % variations.length]}, high quality detailed render`;
        } else if (assetType === 'location') {
          const variations = [
            'wide angle establishing shot, atmospheric lighting',
            'medium view, balanced composition, natural lighting',
            'detailed environmental view, rich atmosphere',
            'dramatic perspective, interesting depth, cinematic lighting',
            'panoramic view, comprehensive scene, even lighting',
            'intimate angle, focused composition, ambient lighting',
          ];
          enhancedPrompt = `${basePrompt}, ${variations[i % variations.length]}, high quality photorealistic environment`;
        }

        enhancedPrompts.push(enhancedPrompt);
      }

      // Generate all variations
      const generatedImages = await Promise.all(
        enhancedPrompts.map(enhancedPrompt =>
          generateImage({
            prompt: enhancedPrompt,
            aspectRatio: aspectRatio,
          })
        )
      );

      // Create variations with IDs
      const newVariations: GeneratedVariation[] = generatedImages.map((image, index) => ({
        id: `var-${Date.now()}-${index}`,
        image,
        selected: false,
      }));

      setVariations(newVariations);
    } catch (error) {
      console.error('Failed to generate assets:', error);
      alert('Failed to generate assets. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelection = (id: string) => {
    setVariations(prev =>
      prev.map(v => (v.id === id ? { ...v, selected: !v.selected } : v))
    );
  };

  const handleSave = async () => {
    const selectedVariations = variations.filter(v => v.selected);

    if (selectedVariations.length === 0) {
      alert('Please select at least one asset to save');
      return;
    }

    setSaving(true);

    try {
      // Prepare assets for saving
      const assetsToSave = selectedVariations.map((variation, index) => ({
        type: assetType,
        name: `${assetType} ${index + 1}`,
        description: prompt,
        aspectRatio: aspectRatio as unknown as AspectRatio,
        imageBlob: variation.image.blob,
        prompt: prompt,
        provider: provider,
      }));

      await onSaveAssets(assetsToSave);

      // Reset modal state
      setPrompt('');
      setVariations([]);
      onClose();
    } catch (error) {
      console.error('Failed to save assets:', error);
      alert('Failed to save assets. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = variations.filter(v => v.selected).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Generate Assets</h2>
              <p className="text-sm text-gray-500">Create AI-generated visual assets for your project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={generating || saving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {variations.length === 0 ? (
            // Generation Form
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Asset Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asset Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['character', 'prop', 'location'] as AssetType[]).map(type => {
                    const Icon = type === 'character' ? User : type === 'prop' ? Box : MapPin;
                    const isSelected = assetType === type;

                    return (
                      <button
                        key={type}
                        onClick={() => setAssetType(type)}
                        disabled={generating}
                        className={`p-4 border-2 rounded-lg transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Icon className={`w-6 h-6 ${isSelected ? 'text-indigo-600' : 'text-gray-600'}`} />
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {type}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                  <span className="text-xs text-gray-500 ml-2">
                    (describe what you want to generate)
                  </span>
                </label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  disabled={generating}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:opacity-50"
                  placeholder={
                    assetType === 'character'
                      ? 'e.g., A woman in her 30s with long brown hair, wearing a business suit'
                      : assetType === 'prop'
                      ? 'e.g., A modern laptop with a sleek silver design'
                      : 'e.g., A cozy coffee shop interior with warm lighting'
                  }
                />
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['1:1', '16:9', '9:16'] as const).map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      disabled={generating}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        aspectRatio === ratio
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={`border-2 rounded ${
                            ratio === '9:16'
                              ? 'w-6 h-10'
                              : ratio === '16:9'
                              ? 'w-10 h-6'
                              : 'w-8 h-8'
                          } ${
                            aspectRatio === ratio
                              ? 'border-indigo-600 bg-indigo-100'
                              : 'border-gray-400'
                          }`}
                        />
                        <span className="text-xs font-medium text-gray-700">{ratio}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Variations */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Variations
                  <span className="text-xs text-gray-500 ml-2">
                    (generate multiple options to choose from)
                  </span>
                </label>
                <select
                  value={numberOfVariations}
                  onChange={e => setNumberOfVariations(Number(e.target.value))}
                  disabled={generating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value={3}>3 variations</option>
                  <option value={4}>4 variations</option>
                  <option value={5}>5 variations</option>
                  <option value={6}>6 variations</option>
                </select>
              </div>

              {/* Provider (placeholder for future) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Provider
                </label>
                <select
                  value={provider}
                  onChange={e => setProvider(e.target.value as AssetProvider)}
                  disabled={generating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="gemini">Gemini (2.5 Flash Image)</option>
                  <option value="openai" disabled>
                    OpenAI (Coming Soon)
                  </option>
                  <option value="fal" disabled>
                    FAL (Coming Soon)
                  </option>
                </select>
              </div>
            </div>
          ) : (
            // Generated Variations Grid
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">
                  Generated Variations
                </h3>
                <p className="text-xs text-gray-500">
                  Select the assets you want to add to your library ({selectedCount} selected)
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {variations.map(variation => (
                  <button
                    key={variation.id}
                    onClick={() => toggleSelection(variation.id)}
                    disabled={saving}
                    className={`relative group border-2 rounded-lg overflow-hidden transition-all ${
                      variation.selected
                        ? 'border-indigo-600 ring-2 ring-indigo-600 ring-offset-2'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="aspect-video bg-gray-100">
                      <img
                        src={variation.image.objectUrl}
                        alt={`Variation ${variation.id}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Selection Indicator */}
                    <div
                      className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        variation.selected
                          ? 'bg-indigo-600'
                          : 'bg-white border-2 border-gray-300 group-hover:border-gray-400'
                      }`}
                    >
                      {variation.selected && <Check className="w-4 h-4 text-white" />}
                    </div>

                    {/* Hover Overlay */}
                    {!variation.selected && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div>
            {variations.length > 0 && (
              <button
                onClick={() => setVariations([])}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                ← Back to Settings
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={generating || saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {variations.length === 0 ? (
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || selectedCount === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Selected ({selectedCount})
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
