/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { StoryDraft } from '../types/story-creation';
import type { Asset, AssetType, AssetProvider } from '../types/asset';
import type { AspectRatio } from '../types/project';
import { generateImage, editImage } from '../services/imageService';

interface AssetGenerationFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyDraft: StoryDraft;
  projectId: string;
  onComplete: (assets: Asset[]) => void;
}

type FlowStep = 'design' | 'pose' | 'confirmation';

interface DesignOption {
  id: string;
  prompt: string;
  imageBlob: Blob;
  imageUrl: string;
  label: string; // "A", "B", "C"
}

interface PoseOption {
  id: string;
  prompt: string;
  imageBlob: Blob;
  imageUrl: string;
  emotion: string; // "cheerful", "worried", "determined"
  description: string;
  sceneTags: string[]; // Which scenes this pose fits
}

export default function AssetGenerationFlowModal({
  isOpen,
  onClose,
  storyDraft,
  projectId,
  onComplete,
}: AssetGenerationFlowModalProps) {
  const [step, setStep] = useState<FlowStep>('design');

  // Design step
  const [designOptions, setDesignOptions] = useState<DesignOption[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [generatingDesigns, setGeneratingDesigns] = useState(false);

  // Pose step
  const [poseOptions, setPoseOptions] = useState<PoseOption[]>([]);
  const [selectedPoses, setSelectedPoses] = useState<Set<string>>(new Set());
  const [generatingPoses, setGeneratingPoses] = useState(false);

  // Saving
  const [saving, setSaving] = useState(false);

  // Auto-generate designs when modal opens
  useEffect(() => {
    if (isOpen && step === 'design' && designOptions.length === 0) {
      generateDesignOptions();
    }
  }, [isOpen, step]);

  // Generate poses when moving to pose step OR when selected design changes
  useEffect(() => {
    if (step === 'pose' && selectedDesign) {
      // Clear existing poses when design changes to force regeneration
      setPoseOptions([]);
      setSelectedPoses(new Set());
      generatePoseOptions();
    }
  }, [step, selectedDesign]);

  /**
   * Generate 3 character design variations
   */
  async function generateDesignOptions() {
    setGeneratingDesigns(true);

    try {
      const characterDesc = storyDraft.projectMetadata.character;
      const aspectRatio = storyDraft.projectMetadata.aspectRatio;

      // Generate 3 variations with different styles
      const styleVariations = [
        {
          style: 'soft warm lighting, friendly appearance, approachable demeanor',
          name: 'Friendly & Warm',
          description: 'Soft lighting, approachable demeanor',
        },
        {
          style: 'dramatic studio lighting, confident expression, strong presence',
          name: 'Bold & Confident',
          description: 'Dramatic lighting, strong presence',
        },
        {
          style: 'natural outdoor lighting, gentle smile, relaxed pose',
          name: 'Natural & Relaxed',
          description: 'Natural lighting, gentle expression',
        },
      ];

      const designs = await Promise.all(
        styleVariations.map(async (variation, index) => {
          const prompt = `Portrait of ${characterDesc}, ${variation.style}, high quality photorealistic, professional photography`;
          const image = await generateImage({ prompt, aspectRatio });

          return {
            id: `design-${index}`,
            prompt,
            imageBlob: image.blob,
            imageUrl: URL.createObjectURL(image.blob),
            label: variation.name,
            description: variation.description,
          };
        })
      );

      setDesignOptions(designs);
    } catch (error) {
      console.error('Failed to generate design options:', error);
      alert('Failed to generate character designs. Please try again.');
    } finally {
      setGeneratingDesigns(false);
    }
  }

  /**
   * Generate pose variations based on selected design and scene analysis
   * Uses fresh image generation with full character description to maintain consistency
   */
  async function generatePoseOptions() {
    setGeneratingPoses(true);

    try {
      const selectedDesignOption = designOptions.find(d => d.id === selectedDesign);
      if (!selectedDesignOption) {
        console.error('No design selected');
        return;
      }

      const characterDesc = storyDraft.projectMetadata.character;
      const aspectRatio = storyDraft.projectMetadata.aspectRatio;

      // Analyze scenes to determine needed emotions/poses
      const sceneEmotions = analyzeSceneEmotions(storyDraft.scenes);

      // Generate poses for each emotion using fresh image generation
      // This ensures character consistency by always including the full character description
      const poses = await Promise.all(
        sceneEmotions.map(async (emotion, index) => {
          // Build prompt with full character description + emotion + pose
          const prompt = `Portrait of ${characterDesc}, ${emotion.description}, ${emotion.pose}, high quality photorealistic, professional photography`;

          console.log(`Generating pose ${index + 1}/${sceneEmotions.length}: ${emotion.name}`);
          console.log('Generation prompt:', prompt);

          const image = await generateImage({
            prompt,
            aspectRatio,
          });

          return {
            id: `pose-${index}`,
            prompt,
            imageBlob: image.blob,
            imageUrl: URL.createObjectURL(image.blob),
            emotion: emotion.name,
            description: emotion.visualDescription,
            sceneTags: emotion.scenes,
          };
        })
      );

      setPoseOptions(poses);

      // Auto-select all poses by default
      setSelectedPoses(new Set(poses.map(p => p.id)));
    } catch (error) {
      console.error('Failed to generate pose options:', error);
      alert('Failed to generate poses. Please try again.');
    } finally {
      setGeneratingPoses(false);
    }
  }

  /**
   * Analyze scene prompts to determine needed emotions/poses
   */
  function analyzeSceneEmotions(scenes: any[]): Array<{
    name: string;
    description: string;
    pose: string;
    visualDescription: string;
    scenes: string[];
  }> {
    const emotions = [
      {
        name: 'cheerful',
        keywords: ['happy', 'smiling', 'joyful', 'cheerful', 'excited', 'laugh', 'bright'],
        description: 'bright smile, cheerful expression, happy demeanor',
        pose: 'relaxed pose, open body language, arms open',
        visualDescription: 'Bright smile, positive energy',
      },
      {
        name: 'worried',
        keywords: ['concerned', 'worried', 'anxious', 'uncertain', 'nervous', 'afraid', 'tense'],
        description: 'concerned look, furrowed brow, worried expression',
        pose: 'tense posture, protective stance, arms crossed',
        visualDescription: 'Concerned expression, thoughtful',
      },
      {
        name: 'determined',
        keywords: ['determined', 'focused', 'resolute', 'confident', 'strong', 'ready', 'brave'],
        description: 'confident expression, focused eyes, determined look',
        pose: 'strong stance, ready for action, confident posture',
        visualDescription: 'Confident stance, ready for action',
      },
    ];

    // Map emotions to scenes that match them
    const emotionsWithScenes = emotions.map(emotion => {
      const matchingScenes = scenes.filter((scene, sceneIndex) => {
        const text = `${scene.prompt} ${scene.voiceover || ''}`.toLowerCase();
        return emotion.keywords.some(keyword => text.includes(keyword));
      });

      return {
        ...emotion,
        scenes: matchingScenes.map((_, i) => {
          const sceneNum = scenes.indexOf(matchingScenes[i]) + 1;
          return `Scene ${sceneNum}`;
        }),
      };
    });

    // Always include at least the 3 standard emotions (cheerful, worried, determined)
    // even if they don't match specific scenes
    const standardEmotions = emotionsWithScenes.slice(0, 3);
    const matchedEmotions = emotionsWithScenes.filter(e => e.scenes.length > 0);

    // Combine standard emotions with any additional matched emotions
    const allEmotions = new Map();
    standardEmotions.forEach(e => allEmotions.set(e.name, e));
    matchedEmotions.forEach(e => allEmotions.set(e.name, e));

    return Array.from(allEmotions.values());
  }

  /**
   * Toggle pose selection
   */
  function togglePoseSelection(poseId: string) {
    setSelectedPoses(prev => {
      const next = new Set(prev);
      if (next.has(poseId)) {
        next.delete(poseId);
      } else {
        next.add(poseId);
      }
      return next;
    });
  }

  /**
   * Save selected assets and complete flow
   */
  async function handleSaveAssets() {
    setSaving(true);

    try {
      const savedAssets: Asset[] = [];

      // 1. Save selected design as character asset
      const selectedDesignOption = designOptions.find(d => d.id === selectedDesign);
      if (selectedDesignOption) {
        const designAsset = await saveAsset({
          projectId,
          type: 'character',
          name: `${storyDraft.projectMetadata.character} - Design ${selectedDesignOption.label}`,
          description: 'Main character design',
          aspectRatio: storyDraft.projectMetadata.aspectRatio,
          imageBlob: selectedDesignOption.imageBlob,
          prompt: selectedDesignOption.prompt,
          provider: 'gemini',
          tags: ['character', 'main-character', 'design'],
          category: 'Characters',
        });

        savedAssets.push(designAsset);
      }

      // 2. Save selected poses as character assets
      for (const poseId of selectedPoses) {
        const poseOption = poseOptions.find(p => p.id === poseId);
        if (poseOption) {
          const poseAsset = await saveAsset({
            projectId,
            type: 'character',
            name: `${storyDraft.projectMetadata.character} - ${poseOption.emotion}`,
            description: `Character pose: ${poseOption.description}`,
            aspectRatio: storyDraft.projectMetadata.aspectRatio,
            imageBlob: poseOption.imageBlob,
            prompt: poseOption.prompt,
            provider: 'gemini',
            tags: ['character', 'pose', poseOption.emotion],
            category: 'Characters',
          });

          savedAssets.push(poseAsset);
        }
      }

      // 3. Link assets to scenes
      const linkedAssets = linkAssetsToScenes(
        storyDraft.scenes,
        savedAssets,
        poseOptions
      );

      // 4. Return to parent
      onComplete(linkedAssets);
    } catch (error) {
      console.error('Failed to save assets:', error);
      alert('Failed to save assets. Please try again.');
      setSaving(false);
    }
  }

  /**
   * Save single asset (image + metadata) using unified asset API
   */
  async function saveAsset(data: {
    projectId: string;
    type: AssetType;
    name: string;
    description: string;
    aspectRatio: AspectRatio;
    imageBlob: Blob;
    prompt: string;
    provider: AssetProvider;
    tags: string[];
    category: string;
  }): Promise<Asset> {
    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
    reader.readAsDataURL(data.imageBlob);
    const imageBase64 = await base64Promise;

    // Create asset via unified API
    const response = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: data.projectId,
        type: data.type,
        name: data.name,
        description: data.description,
        imageBase64: imageBase64,
        aspectRatio: data.aspectRatio,
        provider: data.provider,
        generationPrompt: data.prompt,
        tags: data.tags,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create asset');
    }

    return await response.json();
  }

  /**
   * Link generated assets to scenes based on emotion matching
   */
  function linkAssetsToScenes(
    scenes: any[],
    savedAssets: Asset[],
    poseOptions: PoseOption[]
  ): Asset[] {
    // Find the main design asset (first saved)
    const designAsset = savedAssets[0];

    // Map emotion to asset ID
    const emotionToAssetId = new Map<string, string>();
    poseOptions.forEach((pose, index) => {
      emotionToAssetId.set(pose.emotion, savedAssets[index + 1]?.id);
    });

    // Update each scene with appropriate assets
    scenes.forEach(scene => {
      const attachedAssets: any[] = [];

      // Determine which emotion/pose fits this scene
      const emotion = determineSceneEmotion(scene);
      const poseAssetId = emotionToAssetId.get(emotion);

      if (poseAssetId) {
        // Use specific pose for this scene
        attachedAssets.push({
          assetId: poseAssetId,
          role: 'character',
          order: 0,
        });

        // Update asset's usedInScenes
        const poseAsset = savedAssets.find(a => a.id === poseAssetId);
        if (poseAsset && !poseAsset.usedInScenes.includes(scene.id)) {
          poseAsset.usedInScenes.push(scene.id);
        }
      } else {
        // Fallback to main design
        attachedAssets.push({
          assetId: designAsset.id,
          role: 'character',
          order: 0,
        });

        if (!designAsset.usedInScenes.includes(scene.id)) {
          designAsset.usedInScenes.push(scene.id);
        }
      }

      scene.attachedAssets = attachedAssets;
    });

    return savedAssets;
  }

  /**
   * Determine the primary emotion for a scene based on prompt/voiceover
   */
  function determineSceneEmotion(scene: any): string {
    const text = `${scene.prompt} ${scene.voiceover || ''}`.toLowerCase();

    const emotionKeywords = {
      cheerful: ['happy', 'smiling', 'joyful', 'cheerful', 'excited', 'laugh', 'bright'],
      worried: ['concerned', 'worried', 'anxious', 'uncertain', 'nervous', 'afraid', 'tense'],
      determined: ['determined', 'focused', 'resolute', 'confident', 'strong', 'ready', 'brave'],
    };

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return emotion;
      }
    }

    return 'cheerful'; // Default
  }

  /**
   * Handle close with confirmation if work in progress
   */
  function handleClose() {
    if (designOptions.length > 0 && !saving) {
      if (confirm('Are you sure? Generated designs will be lost.')) {
        // Clean up blob URLs
        designOptions.forEach(d => URL.revokeObjectURL(d.imageUrl));
        poseOptions.forEach(p => URL.revokeObjectURL(p.imageUrl));
        onClose();
      }
    } else {
      onClose();
    }
  }

  if (!isOpen) return null;

  const selectedDesignLabel = designOptions.find(d => d.id === selectedDesign)?.label || 'A';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {step === 'design' && 'Character Design'}
                {step === 'pose' && 'Poses & Outfits'}
                {step === 'confirmation' && 'Confirm Selection'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {step === 'design' && 'Select your character design style'}
                {step === 'pose' && 'Choose poses for different scenes'}
                {step === 'confirmation' && 'Review and save your assets'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={saving}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Design Selection */}
          {step === 'design' && (
            <div className="p-8">
              {/* Character Info Card */}
              <div className="mb-8 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {storyDraft.projectMetadata.character}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {storyDraft.projectMetadata.description}
                    </p>
                  </div>
                </div>
              </div>

              {generatingDesigns ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                  <p className="text-lg text-gray-600">Generating character designs...</p>
                  <p className="text-sm text-gray-500 mt-2">This may take a minute</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-6">
                  {designOptions.map(design => (
                    <button
                      key={design.id}
                      onClick={() => setSelectedDesign(design.id)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                        selectedDesign === design.id
                          ? 'border-indigo-600 ring-4 ring-indigo-100'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="aspect-[9/16]">
                        <img
                          src={design.imageUrl}
                          alt={`Design ${design.label}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 bg-white border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900">Design {design.label}</h4>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedDesign === design.id
                                ? 'border-indigo-600 bg-indigo-600'
                                : 'border-gray-300'
                            }`}
                          >
                            {selectedDesign === design.id && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Pose Selection */}
          {step === 'pose' && (
            <div className="p-8">
              <p className="text-sm text-gray-600 mb-6">
                Based on <span className="font-semibold">Design {selectedDesignLabel}</span>
              </p>

              {generatingPoses ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                  <p className="text-lg text-gray-600">Generating poses and outfits...</p>
                  <p className="text-sm text-gray-500 mt-2">Analyzing your scenes</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-6">
                  {poseOptions.map(pose => (
                    <button
                      key={pose.id}
                      onClick={() => togglePoseSelection(pose.id)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                        selectedPoses.has(pose.id)
                          ? 'border-indigo-600 ring-4 ring-indigo-100'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="aspect-[9/16]">
                        <img
                          src={pose.imageUrl}
                          alt={pose.emotion}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 bg-white border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900 capitalize">
                            {pose.emotion}
                          </h4>
                          <input
                            type="checkbox"
                            checked={selectedPoses.has(pose.id)}
                            readOnly
                            className="w-5 h-5 text-indigo-600 rounded pointer-events-none"
                          />
                        </div>
                        <p className="text-xs text-gray-600 mb-3">{pose.description}</p>
                        <div className="flex gap-1 flex-wrap">
                          {pose.sceneTags.map(scene => (
                            <span
                              key={scene}
                              className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded"
                            >
                              {scene}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirmation' && (
            <div className="p-8">
              <div className="space-y-6">
                {/* Selected Design */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Selected Character Design
                  </h3>
                  <div className="max-w-xs">
                    {designOptions
                      .filter(d => d.id === selectedDesign)
                      .map(design => (
                        <div key={design.id} className="rounded-xl overflow-hidden border-2 border-indigo-600">
                          <div className="aspect-[9/16]">
                            <img
                              src={design.imageUrl}
                              alt={`Design ${design.label}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-3 bg-indigo-50">
                            <p className="font-medium text-gray-900">Design {design.label}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Selected Poses */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Selected Poses ({selectedPoses.size})
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {poseOptions
                      .filter(p => selectedPoses.has(p.id))
                      .map(pose => (
                        <div key={pose.id} className="rounded-xl overflow-hidden border-2 border-gray-200">
                          <div className="aspect-[9/16]">
                            <img
                              src={pose.imageUrl}
                              alt={pose.emotion}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-3 bg-white">
                            <p className="font-medium text-gray-900 capitalize">{pose.emotion}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={() => {
              if (step === 'pose') setStep('design');
              else if (step === 'confirmation') setStep('pose');
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={step === 'design' || saving}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={saving}
            >
              Cancel
            </button>

            {step === 'design' && (
              <button
                onClick={() => setStep('pose')}
                disabled={!selectedDesign || generatingDesigns}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'pose' && (
              <button
                onClick={() => setStep('confirmation')}
                disabled={selectedPoses.size === 0 || generatingPoses}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'confirmation' && (
              <button
                onClick={handleSaveAssets}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Assets...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Generate Assets
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
