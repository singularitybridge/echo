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
  Copy,
  Minimize2,
} from 'lucide-react';
import type { StoryDraft } from '../types/story-creation';
import type { Asset, AssetType, AssetProvider } from '../types/asset';
import type { AspectRatio } from '../types/project';
import {
  generateImage,
  editImage,
  generateWithFalInstantCharacter,
  generateWithFluxContextPro,
  generateWithNanoBanana,
} from '../services/imageService';

interface AssetGenerationFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void; // Optional callback to go back to story editing
  onMinimize?: () => void; // Optional callback to minimize while generation continues
  storyDraft: StoryDraft;
  onComplete: (assets: Asset[]) => void;
}

type FlowStep = 'design' | 'pose';
type CharacterModel = 'fal-instant-character' | 'flux-context-pro' | 'gemini-nano-banana' | 'gemini-flash';

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
  onBack,
  onMinimize,
  storyDraft,
  onComplete,
}: AssetGenerationFlowModalProps) {
  const [step, setStep] = useState<FlowStep>('design');

  // Design step
  const [designOptions, setDesignOptions] = useState<DesignOption[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [generatingDesigns, setGeneratingDesigns] = useState(false);
  const [justGeneratedDesigns, setJustGeneratedDesigns] = useState(false);

  // Pose step
  const [poseOptions, setPoseOptions] = useState<PoseOption[]>([]);
  const [selectedPoses, setSelectedPoses] = useState<Set<string>>(new Set());
  const [generatingPoses, setGeneratingPoses] = useState(false);
  const [characterModel, setCharacterModel] = useState<CharacterModel>('flux-context-pro');

  // Saving
  const [saving, setSaving] = useState(false);

  // Prompt copying state
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Auto-generate designs when modal opens
  useEffect(() => {
    // Skip if we just generated designs
    if (justGeneratedDesigns) return;

    // Skip if we already have designs with blob URLs
    if (designOptions.length > 0 && designOptions.every(d => d.imageUrl.startsWith('blob:'))) {
      return;
    }

    if (isOpen && step === 'design' && designOptions.length === 0) {
      generateDesignOptions();
    }
  }, [isOpen, step, justGeneratedDesigns, designOptions]);

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
      setJustGeneratedDesigns(true);
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

      // Generate poses using selected model for character consistency
      const poses = await Promise.all(
        sceneEmotions.map(async (emotion, index) => {
          // Build prompt with emotion + pose (character description handled differently per model)
          const prompt = `${emotion.description}, ${emotion.pose}, high quality photorealistic, professional photography`;

          console.log(`Generating pose ${index + 1}/${sceneEmotions.length}: ${emotion.name} using ${characterModel}`);
          console.log('Generation prompt:', prompt);

          let image;

          // Generate based on selected model
          switch (characterModel) {
            case 'fal-instant-character':
              // Use selected design as reference for character consistency
              // Convert blob to data URL for FAL API (can't access blob URLs)
              const dataUrlForInstant = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(selectedDesignOption.imageBlob);
              });

              image = await generateWithFalInstantCharacter({
                referenceImageUrl: dataUrlForInstant,
                prompt,
                aspectRatio,
              });
              break;

            case 'flux-context-pro':
              // Use Flux Context Pro for industry-leading consistency
              // Convert blob to data URL for FAL API (can't access blob URLs)
              const dataUrlForFlux = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(selectedDesignOption.imageBlob);
              });

              image = await generateWithFluxContextPro({
                referenceImageUrl: dataUrlForFlux,
                prompt,
                aspectRatio,
              });
              break;

            case 'gemini-nano-banana':
              // Use Nano Banana with reference image
              image = await generateWithNanoBanana({
                referenceImageUrl: selectedDesignOption.imageUrl,
                prompt,
                aspectRatio,
              });
              break;

            case 'gemini-flash':
            default:
              // Fallback to basic generation with full character description
              const fullPrompt = `Portrait of ${characterDesc}, ${prompt}`;
              image = await generateImage({
                prompt: fullPrompt,
                aspectRatio,
              });
              break;
          }

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
   * Complete flow by creating asset objects from selected images
   * Assets will be uploaded to story storage by the parent component
   */
  async function handleSaveAssets() {
    setSaving(true);

    try {
      const assets: Asset[] = [];

      // 1. Create asset object for selected design
      const selectedDesignOption = designOptions.find(d => d.id === selectedDesign);
      if (selectedDesignOption) {
        const objectUrl = URL.createObjectURL(selectedDesignOption.imageBlob);

        const designAsset: Asset = {
          id: `design-${Date.now()}`,
          url: objectUrl,
          thumbnailUrl: objectUrl,
          type: 'character',
          category: 'characters',
          name: `${storyDraft.projectMetadata.character} - Design ${selectedDesignOption.label}`,
          description: 'Main character design',
          provider: 'gemini',
          generationPrompt: selectedDesignOption.prompt,
          projectId: '', // Will be set by parent after story is created
          tags: ['character', 'main-character', 'design'],
          relatedAssets: [],
          usedInScenes: [],
          version: 1,
          parentAssetId: null,
          editHistory: [],
          format: 'png',
          aspectRatio: storyDraft.projectMetadata.aspectRatio,
          width: 0, // Will be calculated on upload
          height: 0,
          fileSize: selectedDesignOption.imageBlob.size,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        assets.push(designAsset);
      }

      // 2. Create asset objects for selected poses
      for (const poseId of selectedPoses) {
        const poseOption = poseOptions.find(p => p.id === poseId);
        if (poseOption) {
          const objectUrl = URL.createObjectURL(poseOption.imageBlob);

          const poseAsset: Asset = {
            id: `pose-${poseId}`,
            url: objectUrl,
            thumbnailUrl: objectUrl,
            type: 'character',
            category: 'characters',
            name: `${storyDraft.projectMetadata.character} - ${poseOption.emotion}`,
            description: `Character pose: ${poseOption.description}`,
            provider: 'gemini',
            generationPrompt: poseOption.prompt,
            projectId: '', // Will be set by parent after story is created
            tags: ['character', 'pose', poseOption.emotion],
            relatedAssets: [],
            usedInScenes: [],
            version: 1,
            parentAssetId: null,
            editHistory: [],
            format: 'png',
            aspectRatio: storyDraft.projectMetadata.aspectRatio,
            width: 0,
            height: 0,
            fileSize: poseOption.imageBlob.size,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          assets.push(poseAsset);
        }
      }

      // 3. Link assets to scenes
      const linkedAssets = linkAssetsToScenes(
        storyDraft.scenes,
        assets,
        poseOptions
      );

      // 4. Return to parent (assets will be uploaded to story storage)
      onComplete(linkedAssets);
    } catch (error) {
      console.error('Failed to prepare assets:', error);
      alert('Failed to prepare assets. Please try again.');
      setSaving(false);
    }
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

  /**
   * Copy prompt to clipboard
   */
  function copyPrompt(promptId: string, promptText: string) {
    navigator.clipboard.writeText(promptText);
    setCopiedPromptId(promptId);
    setTimeout(() => setCopiedPromptId(null), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col">
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
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {step === 'design' && 'Select your character design style'}
                {step === 'pose' && 'Choose poses for different scenes'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Minimize button - only show during generation */}
            {(generatingDesigns || generatingPoses) && onMinimize && (
              <button
                onClick={onMinimize}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
                title="Continue generation in background"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={saving}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Step 1: Design Selection */}
          {step === 'design' && (
            <div>
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
                    <div
                      key={design.id}
                      onClick={() => setSelectedDesign(design.id)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
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
                        <div className="flex items-center justify-between mb-2">
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

                        {/* Prompt display */}
                        <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">Prompt</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyPrompt(design.id, design.prompt);
                              }}
                              className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                              title="Copy prompt"
                            >
                              {copiedPromptId === design.id ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">{design.prompt}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Pose Selection */}
          {step === 'pose' && (
            <div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3">
                  Based on <span className="font-semibold">Design {selectedDesignLabel}</span>
                </p>

                {/* Model Selection */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Character Consistency Model
                  </label>
                  <select
                    value={characterModel}
                    onChange={(e) => {
                      setCharacterModel(e.target.value as CharacterModel);
                      // Regenerate poses with new model
                      if (poseOptions.length > 0) {
                        setPoseOptions([]);
                        setSelectedPoses(new Set());
                        setTimeout(() => generatePoseOptions(), 100);
                      }
                    }}
                    disabled={generatingPoses}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="flux-context-pro">
                      Flux Context Pro (99.7% consistency)
                    </option>
                    <option value="fal-instant-character">
                      FAL Instant Character (Good consistency)
                    </option>
                    <option value="gemini-nano-banana">
                      Gemini Nano Banana (Fastest, 1-2s)
                    </option>
                    <option value="gemini-flash">
                      Gemini Flash (Fallback)
                    </option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    {characterModel === 'flux-context-pro' &&
                      'Industry-leading 99.7% character consistency accuracy'}
                    {characterModel === 'fal-instant-character' &&
                      'Uses reference image to maintain character identity across poses'}
                    {characterModel === 'gemini-nano-banana' &&
                      '8x faster with strong semantic understanding'}
                    {characterModel === 'gemini-flash' &&
                      'Basic generation without character reference'}
                  </p>

                  {/* Manual Regenerate Button */}
                  <button
                    onClick={() => {
                      setPoseOptions([]);
                      setSelectedPoses(new Set());
                      generatePoseOptions();
                    }}
                    disabled={generatingPoses}
                    className="mt-3 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {generatingPoses ? 'Generating...' : 'Regenerate Poses'}
                  </button>
                </div>
              </div>

              {generatingPoses ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                  <p className="text-lg text-gray-600">Generating poses and outfits...</p>
                  <p className="text-sm text-gray-500 mt-2">Analyzing your scenes</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-6">
                  {poseOptions.map(pose => (
                    <div
                      key={pose.id}
                      onClick={() => togglePoseSelection(pose.id)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
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
                        <div className="flex gap-1 flex-wrap mb-3">
                          {pose.sceneTags.map(scene => (
                            <span
                              key={scene}
                              className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded"
                            >
                              {scene}
                            </span>
                          ))}
                        </div>

                        {/* Prompt display */}
                        <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">Prompt</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyPrompt(pose.id, pose.prompt);
                              }}
                              className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                              title="Copy prompt"
                            >
                              {copiedPromptId === pose.id ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">{pose.prompt}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={() => {
              if (step === 'design' && onBack) {
                onBack();
              } else if (step === 'pose') {
                setStep('design');
              }
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={(step === 'design' && !onBack) || saving}
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
                onClick={handleSaveAssets}
                disabled={selectedPoses.size === 0 || generatingPoses || saving}
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
