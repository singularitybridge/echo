/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import React, { useState } from 'react';
import { Sparkles, Download, Loader2, X, ChevronLeft, ChevronRight, ArrowLeft, Monitor, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { generateCharacterReferences, GeneratedImage } from '../services/imageService';

interface CharacterReferenceGeneratorProps {
  projectId: string;
}

type AspectRatio = '16:9' | '9:16';

// Global lock to prevent double-generation from React Strict Mode
let generationLock = false;

const CharacterReferenceGenerator: React.FC<CharacterReferenceGeneratorProps> = ({ projectId }) => {
  const router = useRouter();
  const [characterDescription, setCharacterDescription] = useState('');
  const [numberOfImages, setNumberOfImages] = useState(2);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const hasGeneratedInSession = React.useRef(false);
  const isGeneratingRef = React.useRef(false);

  // Reset generation flag when aspect ratio changes (so user can see existing images)
  React.useEffect(() => {
    hasGeneratedInSession.current = false;
    setJustGenerated(false);
  }, [aspectRatio]);

  // Load existing images from public/generated-refs/{projectId} based on aspect ratio
  React.useEffect(() => {
    // Skip loading if we have generated images in this session
    if (hasGeneratedInSession.current) return;

    // Skip loading if we just generated images in this session
    if (justGenerated) return;

    const loadExistingImages = async () => {
      const existingImages: GeneratedImage[] = [];
      const aspectRatioKey = aspectRatio === '16:9' ? 'landscape' : 'portrait';

      // Try to load pre-generated images for this project and aspect ratio
      for (let i = 1; i <= 3; i++) {
        try {
          const response = await fetch(`/generated-refs/${projectId}/character-ref-${aspectRatioKey}-${i}.png`);
          if (response.ok) {
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            // Convert blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
              reader.onloadend = () => {
                const base64 = reader.result as string;
                resolve(base64.split(',')[1]);
              };
              reader.readAsDataURL(blob);
            });

            const imageBytes = await base64Promise;

            existingImages.push({
              imageBytes,
              mimeType: 'image/png',
              objectUrl,
              blob,
            });
          }
        } catch (err) {
          // Image doesn't exist, skip
          console.log(`No pre-generated ${aspectRatioKey} image ${i} found for project ${projectId}`);
        }
      }

      if (existingImages.length > 0) {
        setGeneratedImages(existingImages);
      }
    };

    loadExistingImages();
  }, [projectId, aspectRatio, justGenerated]);

  // Keyboard navigation for modal
  React.useEffect(() => {
    if (selectedImageIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedImageIndex(null);
      } else if (e.key === 'ArrowLeft' && selectedImageIndex > 0) {
        setSelectedImageIndex(selectedImageIndex - 1);
      } else if (e.key === 'ArrowRight' && selectedImageIndex < generatedImages.length - 1) {
        setSelectedImageIndex(selectedImageIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIndex, generatedImages.length]);

  const handleGenerate = React.useCallback(async () => {
    if (!characterDescription.trim()) {
      setError('Please enter a character description');
      return;
    }

    // Prevent double-invocation (React Strict Mode in dev) using global lock
    if (generationLock || isGeneratingRef.current || isGenerating) {
      console.log('Generation already in progress, skipping duplicate call');
      return;
    }

    console.log('Starting generation, setting all locks');
    generationLock = true;
    isGeneratingRef.current = true;
    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);

    try {
      const images = await generateCharacterReferences(
        characterDescription,
        numberOfImages,
        aspectRatio
      );
      setGeneratedImages(images);
      setJustGenerated(true);
      hasGeneratedInSession.current = true;

      // Auto-save generated images
      await saveReferences(images);
    } catch (err) {
      console.error('Character reference generation failed:', err);

      // If it's a duplicate generation error, silently ignore it
      if (err instanceof Error && err.message === 'Generation already in progress') {
        console.log('[CharacterReferenceGenerator] Duplicate generation caught and ignored');
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate character references'
      );
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
      generationLock = false;
      console.log('Generation complete, releasing all locks');
    }
  }, [characterDescription, numberOfImages, aspectRatio, isGenerating]);

  const saveReferences = async (images: GeneratedImage[]) => {
    setIsSaving(true);
    const aspectRatioKey = aspectRatio === '16:9' ? 'landscape' : 'portrait';

    try {
      for (let i = 0; i < images.length; i++) {
        const formData = new FormData();
        formData.append('file', images[i].blob, `character-ref-${aspectRatioKey}-${i + 1}.png`);
        formData.append('projectId', projectId);
        formData.append('filename', `character-ref-${aspectRatioKey}-${i + 1}.png`);

        const response = await fetch('/api/references', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to save reference ${i + 1}`);
        }
      }
      console.log(`Successfully saved ${images.length} ${aspectRatioKey} reference images`);
    } catch (err) {
      console.error('Failed to save references:', err);
      setError('References generated but failed to save. You can still download them manually.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = (image: GeneratedImage, index: number) => {
    const a = document.createElement('a');
    a.href = image.objectUrl;
    a.download = `character-reference-${index + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          disabled={isGenerating}
          className={`flex items-center gap-2 transition-colors mb-4 ${
            isGenerating
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </button>
        <h2 className="text-3xl font-bold text-white mb-2">
          Character Reference Generator
        </h2>
        <p className="text-gray-400">
          Generate consistent character reference images using AI
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-800">
        <div className="mb-4">
          <label
            htmlFor="character-desc"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Character Description
          </label>
          <textarea
            id="character-desc"
            value={characterDescription}
            onChange={(e) => setCharacterDescription(e.target.value)}
            placeholder="e.g., a young creative woman in her late 20s with long dark hair, wearing casual beach attire, warm friendly expression"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            rows={4}
            disabled={isGenerating}
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="num-images"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Number of Reference Images
          </label>
          <select
            id="num-images"
            value={numberOfImages}
            onChange={(e) => setNumberOfImages(Number(e.target.value))}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isGenerating}
          >
            <option value={1}>1 Image</option>
            <option value={2}>2 Images</option>
            <option value={3}>3 Images</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Aspect Ratio
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setAspectRatio('16:9')}
              disabled={isGenerating}
              className={`flex-1 px-4 py-3 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                aspectRatio === '16:9'
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Monitor className="w-4 h-4" />
              <span>Landscape (16:9)</span>
            </button>
            <button
              onClick={() => setAspectRatio('9:16')}
              disabled={isGenerating}
              className={`flex-1 px-4 py-3 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                aspectRatio === '9:16'
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Portrait (9:16)</span>
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            {aspectRatio === '16:9'
              ? 'For landscape/horizontal videos'
              : 'For portrait/vertical videos (TikTok, Instagram Reels, etc.)'}
          </p>
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleGenerate();
          }}
          disabled={isGenerating || !characterDescription.trim()}
          className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating References...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Character References
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Generated Images Display */}
      {generatedImages.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-xl font-semibold text-white mb-4">
            Generated Reference Images
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedImages.map((image, index) => (
              <div
                key={index}
                className="relative group bg-gray-800 rounded-lg overflow-hidden border border-gray-700 cursor-pointer"
                onClick={() => setSelectedImageIndex(index)}
              >
                <img
                  src={image.objectUrl}
                  alt={`Character reference ${index + 1}`}
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(image, index);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
                <div className="p-3 bg-gray-800">
                  <p className="text-sm text-gray-400">
                    Reference {index + 1}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              💡 Tips for Using Character References
            </h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Use these images as reference inputs when generating videos</li>
              <li>• They help maintain character consistency across scenes</li>
              <li>• Download and save them for use in multiple video generations</li>
              <li>
                • Combine with detailed prompts for best results (Veo 3.1 only)
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {selectedImageIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedImageIndex(null)}
        >
          <div className="relative max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setSelectedImageIndex(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Navigation buttons */}
            {selectedImageIndex > 0 && (
              <button
                onClick={() => setSelectedImageIndex(selectedImageIndex - 1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 p-2 text-white hover:text-gray-300 transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-12 h-12" />
              </button>
            )}

            {selectedImageIndex < generatedImages.length - 1 && (
              <button
                onClick={() => setSelectedImageIndex(selectedImageIndex + 1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 p-2 text-white hover:text-gray-300 transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-12 h-12" />
              </button>
            )}

            {/* Image */}
            <img
              src={generatedImages[selectedImageIndex].objectUrl}
              alt={`Character reference ${selectedImageIndex + 1}`}
              className="max-w-full max-h-[90vh] rounded-lg"
            />

            {/* Image info and download */}
            <div className="absolute -bottom-16 left-0 right-0 flex items-center justify-between text-white">
              <p className="text-sm">
                Reference {selectedImageIndex + 1} of {generatedImages.length}
              </p>
              <button
                onClick={() => handleDownload(generatedImages[selectedImageIndex], selectedImageIndex)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>

            {/* Keyboard hints */}
            <div className="absolute -bottom-24 left-0 right-0 text-center text-gray-400 text-sm">
              Press ESC to close • Use arrow keys to navigate
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterReferenceGenerator;
