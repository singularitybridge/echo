/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Download, Monitor, Smartphone } from 'lucide-react';
import { generateCharacterReferences, GeneratedImage } from '../services/imageService';
import { AspectRatio } from '../types';

interface CharacterRefsModalProps {
  projectId: string;
  currentAspectRatio: AspectRatio;
  onClose: () => void;
}

type AspectRatioType = '16:9' | '9:16';

const CharacterRefsModal: React.FC<CharacterRefsModalProps> = ({
  projectId,
  currentAspectRatio,
  onClose,
}) => {
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioType>('9:16');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [characterDescription, setCharacterDescription] = useState('');
  const [numberOfImages, setNumberOfImages] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // Load existing images based on selected aspect ratio
  useEffect(() => {
    const loadExistingImages = async () => {
      const existingImages: GeneratedImage[] = [];
      const aspectRatioKey = selectedAspectRatio === '16:9' ? 'landscape' : 'portrait';

      for (let i = 1; i <= 10; i++) {
        try {
          const response = await fetch(`/generated-refs/${projectId}/character-ref-${aspectRatioKey}-${i}.png`);
          if (response.ok) {
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

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
          console.log(`No pre-generated ${aspectRatioKey} image ${i} found`);
        }
      }

      setGeneratedImages(existingImages);
    };

    loadExistingImages();
  }, [projectId, selectedAspectRatio]);

  // Keyboard navigation for image modal
  useEffect(() => {
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

  const handleGenerate = async () => {
    if (!characterDescription.trim()) {
      setError('Please enter a character description');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);

    try {
      const images = await generateCharacterReferences(
        characterDescription,
        numberOfImages,
        selectedAspectRatio
      );
      setGeneratedImages(images);
      await saveReferences(images);
    } catch (err) {
      console.error('Character reference generation failed:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate character references'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const saveReferences = async (images: GeneratedImage[]) => {
    setIsSaving(true);
    const aspectRatioKey = selectedAspectRatio === '16:9' ? 'landscape' : 'portrait';

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
    a.download = `character-reference-${selectedAspectRatio}-${index + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full h-[90vh] overflow-hidden border border-gray-200 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Character References
              </h2>
              {/* Aspect Ratio Toggle - Compact */}
              <div className="flex gap-0.5 border border-gray-200 rounded">
                <button
                  onClick={() => setSelectedAspectRatio('16:9')}
                  disabled={isGenerating}
                  className={`px-1.5 py-0.5 rounded-l transition-colors flex items-center gap-0.5 text-[10px] ${
                    selectedAspectRatio === '16:9'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Landscape (16:9)"
                >
                  <Monitor className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => setSelectedAspectRatio('9:16')}
                  disabled={isGenerating}
                  className={`px-1.5 py-0.5 rounded-r transition-colors flex items-center gap-0.5 text-[10px] ${
                    selectedAspectRatio === '9:16'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Portrait (9:16)"
                >
                  <Smartphone className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">

            {/* Generated Images Display */}
            {generatedImages.length > 0 && (
              <div className="flex-shrink-0">
                <h3 className="text-xs font-medium text-gray-900 mb-2">
                  Reference Images ({generatedImages.length})
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {generatedImages.map((image, index) => (
                    <div
                      key={index}
                      className="relative group bg-gray-50 rounded overflow-hidden border border-gray-200 cursor-pointer hover:border-gray-300 transition-all"
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <div className={`${selectedAspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`}>
                        <img
                          src={image.objectUrl}
                          alt={`Reference ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(image, index);
                          }}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] rounded flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-2.5 h-2.5" />
                          Download
                        </button>
                      </div>
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[9px] text-white font-medium">
                        Ref {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generation Section */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex-shrink-0">
              <h3 className="text-xs font-medium text-gray-900 mb-2">
                {generatedImages.length > 0 ? 'Regenerate References' : 'Generate References'}
              </h3>

              <div className="space-y-2">
                <div>
                  <label htmlFor="char-desc" className="block text-xs font-medium text-gray-700 mb-1">
                    Character Description
                  </label>
                  <textarea
                    id="char-desc"
                    value={characterDescription}
                    onChange={(e) => setCharacterDescription(e.target.value)}
                    placeholder="e.g., a young creative woman in her late 20s with long dark hair"
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent resize-none"
                    rows={2}
                    disabled={isGenerating}
                  />
                </div>

                <div>
                  <label htmlFor="num-imgs" className="block text-xs font-medium text-gray-700 mb-1">
                    Number of Images
                  </label>
                  <select
                    id="num-imgs"
                    value={numberOfImages}
                    onChange={(e) => setNumberOfImages(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    disabled={isGenerating}
                  >
                    <option value={1}>1 Image</option>
                    <option value={2}>2 Images</option>
                    <option value={3}>3 Images</option>
                  </select>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded p-2">
                    <p className="text-red-700 text-[10px]">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !characterDescription.trim()}
                  className="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      Generate References
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImageIndex !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedImageIndex(null)}
        >
          <div className="relative max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImageIndex(null)}
              className="absolute -top-10 right-0 p-1.5 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <img
              src={generatedImages[selectedImageIndex].objectUrl}
              alt={`Reference ${selectedImageIndex + 1}`}
              className="max-w-full max-h-[85vh] rounded-lg border border-gray-200"
            />

            <div className="absolute -bottom-14 left-0 right-0 flex items-center justify-between text-white">
              <p className="text-xs">
                Reference {selectedImageIndex + 1} of {generatedImages.length}
              </p>
              <button
                onClick={() => handleDownload(generatedImages[selectedImageIndex], selectedImageIndex)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            </div>

            <div className="absolute -bottom-20 left-0 right-0 text-center text-gray-300 text-xs">
              Press ESC to close • Use arrow keys to navigate
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CharacterRefsModal;
