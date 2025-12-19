/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Film,
  Check,
  Loader2,
  ChevronLeft,
  Copy,
  Minimize2,
  Sparkles,
  Camera,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import type { StoryDraft } from '../types/story-creation';
import type { Asset } from '../types/asset';
import { AspectRatio } from '@/types';
import { generateImage } from '../services/imageService';
import { executeStoryboardDesignerAgent } from '../services/agentHubService';
import { DIRECTOR_PERSONAS, DirectorPersona } from '@/types/director-personas';

interface AssetGenerationFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onMinimize?: () => void;
  storyDraft: StoryDraft;
  onComplete: (assets: Asset[]) => void;
}

interface StoryboardFrame {
  sceneId: string;
  sceneTitle: string;
  frameDescription?: string; // Deprecated - use imagePrompt instead
  imagePrompt: string;
  cameraAngle: string;
  mood: string;
  keyElements: string[];
  // Generated image data
  imageBlob?: Blob;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  error?: string;
}

export default function AssetGenerationFlowModal({
  isOpen,
  onClose,
  onBack,
  onMinimize,
  storyDraft,
  onComplete,
}: AssetGenerationFlowModalProps) {
  const [frames, setFrames] = useState<StoryboardFrame[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [selectedFrames, setSelectedFrames] = useState<Set<string>>(new Set());

  // Auto-generate storyboard prompts when modal opens
  useEffect(() => {
    if (isOpen && frames.length === 0 && !generatingPrompts) {
      generateStoryboardPrompts();
    }
  }, [isOpen]);

  /**
   * Generate storyboard prompts for each scene using the storyboard-designer agent
   */
  async function generateStoryboardPrompts() {
    setGeneratingPrompts(true);

    try {
      // Build context for the storyboard designer agent
      const storyContext = {
        title: storyDraft.projectMetadata.title,
        description: storyDraft.projectMetadata.description,
        character: storyDraft.projectMetadata.character,
        aspectRatio: storyDraft.projectMetadata.aspectRatio,
        directorPersona: storyDraft.directorPersona,
        scenes: storyDraft.scenes.map(scene => ({
          id: scene.id,
          title: scene.title,
          prompt: scene.prompt,
          voiceover: scene.voiceover,
          cameraAngle: scene.cameraAngle,
          duration: scene.duration,
        })),
      };

      const userInput = `Generate storyboard frames for this story:

${JSON.stringify(storyContext, null, 2)}

Create one storyboard frame for each scene. Each frame should capture the entire scene visually - environment, lighting, mood, camera angle, and any characters/subjects within that context. These frames will be used as starting images for AI video generation.`;

      console.log('[Storyboard] Calling storyboard-designer agent...');
      const response = await executeStoryboardDesignerAgent(userInput);

      // Parse the response
      let storyboardData;
      try {
        storyboardData = JSON.parse(response);
      } catch {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          storyboardData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to parse storyboard designer response');
        }
      }

      const storyboardFrames: StoryboardFrame[] = storyboardData.storyboardFrames.map(
        (frame: any, index: number) => ({
          sceneId: frame.sceneId || storyDraft.scenes[index]?.id || `scene-${index + 1}`,
          sceneTitle: frame.sceneTitle || storyDraft.scenes[index]?.title || `Scene ${index + 1}`,
          frameDescription: frame.frameDescription || '',
          imagePrompt: frame.imagePrompt || '',
          cameraAngle: frame.cameraAngle || storyDraft.scenes[index]?.cameraAngle || 'Medium shot',
          mood: frame.mood || '',
          keyElements: frame.keyElements || [],
          status: 'pending' as const,
        })
      );

      setFrames(storyboardFrames);
      // Auto-select all frames
      setSelectedFrames(new Set(storyboardFrames.map(f => f.sceneId)));

      console.log('[Storyboard] Generated prompts for', storyboardFrames.length, 'frames');
    } catch (error) {
      console.error('[Storyboard] Failed to generate prompts:', error);
      alert('Failed to generate storyboard prompts. Please try again.');
    } finally {
      setGeneratingPrompts(false);
    }
  }

  /**
   * Generate images for all selected frames in parallel
   */
  async function generateAllImages() {
    setGenerating(true);

    const framesToGenerate = frames.filter(f => selectedFrames.has(f.sceneId));

    // Set all frames to generating status
    setFrames(prev =>
      prev.map(f =>
        selectedFrames.has(f.sceneId) ? { ...f, status: 'generating' as const } : f
      )
    );

    console.log(`[Storyboard] Generating ${framesToGenerate.length} images in parallel`);

    // Generate all images in parallel
    const generatePromises = framesToGenerate.map(async (frame) => {
      try {
        console.log(`[Storyboard] Starting generation: ${frame.sceneTitle}`);

        const image = await generateImage({
          prompt: frame.imagePrompt,
          aspectRatio: storyDraft.projectMetadata.aspectRatio as AspectRatio,
        });

        // Update with generated image
        setFrames(prev =>
          prev.map(f =>
            f.sceneId === frame.sceneId
              ? {
                  ...f,
                  imageBlob: image.blob,
                  imageUrl: URL.createObjectURL(image.blob),
                  status: 'completed' as const,
                }
              : f
          )
        );

        console.log(`[Storyboard] Completed: ${frame.sceneTitle}`);
        return { sceneId: frame.sceneId, success: true };
      } catch (error) {
        console.error(`[Storyboard] Failed to generate image for ${frame.sceneTitle}:`, error);
        setFrames(prev =>
          prev.map(f =>
            f.sceneId === frame.sceneId
              ? {
                  ...f,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Unknown error',
                }
              : f
          )
        );
        return { sceneId: frame.sceneId, success: false, error };
      }
    });

    // Wait for all generations to complete
    const results = await Promise.all(generatePromises);
    const successful = results.filter(r => r.success).length;
    console.log(`[Storyboard] Completed ${successful}/${framesToGenerate.length} images`);

    setGenerating(false);
  }

  /**
   * Regenerate a single frame's image
   */
  async function regenerateFrame(sceneId: string) {
    const frame = frames.find(f => f.sceneId === sceneId);
    if (!frame) return;

    setFrames(prev =>
      prev.map(f => (f.sceneId === sceneId ? { ...f, status: 'generating' as const } : f))
    );

    try {
      const image = await generateImage({
        prompt: frame.imagePrompt,
        aspectRatio: storyDraft.projectMetadata.aspectRatio as AspectRatio,
      });

      setFrames(prev =>
        prev.map(f =>
          f.sceneId === sceneId
            ? {
                ...f,
                imageBlob: image.blob,
                imageUrl: URL.createObjectURL(image.blob),
                status: 'completed' as const,
                error: undefined,
              }
            : f
        )
      );
    } catch (error) {
      console.error(`[Storyboard] Failed to regenerate ${frame.sceneTitle}:`, error);
      setFrames(prev =>
        prev.map(f =>
          f.sceneId === sceneId
            ? {
                ...f,
                status: 'error' as const,
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            : f
        )
      );
    }
  }

  /**
   * Toggle frame selection
   */
  function toggleFrameSelection(sceneId: string) {
    setSelectedFrames(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  }

  /**
   * Save generated frames as assets
   */
  async function handleSaveAssets() {
    setSaving(true);

    try {
      const assets: Asset[] = [];

      for (const frame of frames) {
        if (frame.imageBlob && selectedFrames.has(frame.sceneId)) {
          const objectUrl = URL.createObjectURL(frame.imageBlob);

          const asset: Asset = {
            id: `storyboard-${frame.sceneId}-${Date.now()}`,
            url: objectUrl,
            thumbnailUrl: objectUrl,
            type: 'scene',
            category: 'storyboard',
            name: `${frame.sceneTitle} - Storyboard Frame`,
            description: frame.imagePrompt, // Use imagePrompt as description
            provider: 'fal',
            generationPrompt: frame.imagePrompt,
            projectId: '',
            tags: ['storyboard', 'scene-frame', frame.mood, ...frame.keyElements],
            relatedAssets: [],
            usedInScenes: [frame.sceneId],
            version: 1,
            parentAssetId: null,
            editHistory: [],
            format: 'png',
            aspectRatio: storyDraft.projectMetadata.aspectRatio as AspectRatio,
            width: 0,
            height: 0,
            fileSize: frame.imageBlob.size,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          assets.push(asset);
        }
      }

      // Update scenes with attached assets
      storyDraft.scenes.forEach(scene => {
        const frameAsset = assets.find(a => a.usedInScenes.includes(scene.id));
        if (frameAsset) {
          scene.attachedAssets = [
            {
              assetId: frameAsset.id,
              role: 'storyboard-frame',
              order: 0,
            },
          ];
        }
      });

      onComplete(assets);
    } catch (error) {
      console.error('Failed to save storyboard assets:', error);
      alert('Failed to save assets. Please try again.');
      setSaving(false);
    }
  }

  /**
   * Handle close with confirmation
   */
  function handleClose() {
    const hasGeneratedImages = frames.some(f => f.imageUrl);
    if (hasGeneratedImages && !saving) {
      if (confirm('Are you sure? Generated images will be lost.')) {
        frames.forEach(f => f.imageUrl && URL.revokeObjectURL(f.imageUrl));
        onClose();
      }
    } else {
      onClose();
    }
  }

  /**
   * Copy prompt to clipboard
   */
  function copyPrompt(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  }

  if (!isOpen) return null;

  const completedFrames = frames.filter(f => f.status === 'completed').length;
  const selectedCount = selectedFrames.size;
  const allImagesGenerated = frames.every(
    f => !selectedFrames.has(f.sceneId) || f.status === 'completed'
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Film className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Storyboard</h2>
              <p className="text-sm text-gray-500 mt-1">
                Generate visual frames for each scene
              </p>
            </div>
            {/* Director Badge */}
            {storyDraft.projectMetadata.personaId && DIRECTOR_PERSONAS[storyDraft.projectMetadata.personaId as DirectorPersona] && (
              <div className="flex items-center gap-2 bg-white rounded-md px-2 py-1 border border-gray-200 ml-4">
                <img
                  src={DIRECTOR_PERSONAS[storyDraft.projectMetadata.personaId as DirectorPersona].avatar}
                  alt={DIRECTOR_PERSONAS[storyDraft.projectMetadata.personaId as DirectorPersona].directorName}
                  className="w-6 h-6 rounded-full object-cover"
                />
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 leading-tight">Directed by</span>
                  <span className="text-xs font-medium text-gray-900 leading-tight">
                    {DIRECTOR_PERSONAS[storyDraft.projectMetadata.personaId as DirectorPersona].directorName}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {generating && onMinimize && (
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

        {/* Progress Bar */}
        {(generating || generatingPrompts) && (
          <div className="h-1 bg-gray-200">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{
                width: generatingPrompts
                  ? '30%'
                  : `${(completedFrames / selectedCount) * 100}%`,
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Story Info */}
          <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {storyDraft.projectMetadata.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {storyDraft.scenes.length} scenes | {storyDraft.projectMetadata.aspectRatio}
                </p>
                {storyDraft.directorPersona && (
                  <p className="text-xs text-indigo-600 mt-1">
                    Director: {storyDraft.directorPersona.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {generatingPrompts && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
              <p className="text-lg text-gray-600">Designing storyboard frames...</p>
              <p className="text-sm text-gray-500 mt-2">
                Analyzing scenes and creating visual prompts
              </p>
            </div>
          )}

          {/* Storyboard Grid */}
          {!generatingPrompts && frames.length > 0 && (
            <div className="space-y-4">
              {frames.map((frame, index) => (
                <div
                  key={frame.sceneId}
                  className={`border rounded-xl overflow-hidden transition-all ${
                    selectedFrames.has(frame.sceneId)
                      ? 'border-indigo-300 bg-white'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex">
                    {/* Scene Info (Left) */}
                    <div className="w-1/3 p-4 border-r border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          checked={selectedFrames.has(frame.sceneId)}
                          onChange={() => toggleFrameSelection(frame.sceneId)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <span className="text-xs font-medium text-gray-500">
                          Scene {index + 1}
                        </span>
                      </div>

                      <h4 className="font-semibold text-gray-900 mb-2">{frame.sceneTitle}</h4>

                      {/* Camera Angle */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Camera className="w-4 h-4" />
                        <span>{frame.cameraAngle}</span>
                      </div>

                      {/* Mood */}
                      {frame.mood && (
                        <div className="mb-2">
                          <span className="text-xs font-medium text-gray-500">Mood:</span>
                          <span className="text-sm text-gray-700 ml-1">{frame.mood}</span>
                        </div>
                      )}

                      {/* Voiceover */}
                      {storyDraft.scenes[index]?.voiceover && (
                        <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                          <div className="flex items-center gap-1 mb-1">
                            <MessageSquare className="w-3 h-3 text-gray-400" />
                            <span className="text-xs font-medium text-gray-500">Voiceover</span>
                          </div>
                          <p className="text-xs text-gray-600 italic">
                            "{storyDraft.scenes[index].voiceover}"
                          </p>
                        </div>
                      )}

                      {/* Key Elements */}
                      {frame.keyElements.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {frame.keyElements.map((element, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded"
                            >
                              {element}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Image Preview (Center) */}
                    <div className="w-1/3 bg-gray-100 flex items-center justify-center">
                      {frame.status === 'pending' && (
                        <div className="text-center p-4">
                          <div className="w-16 h-16 bg-gray-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
                            <Film className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-500">Ready to generate</p>
                        </div>
                      )}

                      {frame.status === 'generating' && (
                        <div className="text-center p-4">
                          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Generating...</p>
                        </div>
                      )}

                      {frame.status === 'completed' && frame.imageUrl && (
                        <div className="relative w-full h-full group">
                          <img
                            src={frame.imageUrl}
                            alt={frame.sceneTitle}
                            className="w-full h-full object-contain"
                          />
                          <button
                            onClick={() => regenerateFrame(frame.sceneId)}
                            className="absolute top-2 right-2 p-2 bg-white/90 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Regenerate frame"
                          >
                            <RefreshCw className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      )}

                      {frame.status === 'error' && (
                        <div className="text-center p-4">
                          <div className="w-16 h-16 bg-red-100 rounded-lg mx-auto mb-2 flex items-center justify-center">
                            <X className="w-8 h-8 text-red-500" />
                          </div>
                          <p className="text-sm text-red-600 mb-2">Generation failed</p>
                          <button
                            onClick={() => regenerateFrame(frame.sceneId)}
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            Try again
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Prompt (Right) */}
                    <div className="w-1/3 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500">Image Prompt</span>
                        <button
                          onClick={() => copyPrompt(frame.sceneId, frame.imagePrompt)}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                          title="Copy prompt"
                        >
                          {copiedPromptId === frame.sceneId ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{frame.imagePrompt}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={() => onBack?.()}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!onBack || saving || generating}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            {/* Selection info */}
            <span className="text-sm text-gray-500">
              {selectedCount} of {frames.length} frames selected
            </span>

            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={saving || generating}
            >
              Cancel
            </button>

            {/* Generate button */}
            {!allImagesGenerated && (
              <button
                onClick={generateAllImages}
                disabled={generatingPrompts || generating || selectedCount === 0}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating ({completedFrames}/{selectedCount})
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Images
                  </>
                )}
              </button>
            )}

            {/* Save button */}
            {allImagesGenerated && completedFrames > 0 && (
              <button
                onClick={handleSaveAssets}
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Storyboard
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
