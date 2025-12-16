/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import {useState, useRef, useEffect, useCallback} from 'react';
import {X, Upload, Check, Loader2, FileImage, Clipboard, Sparkles} from 'lucide-react';
import type {AssetType} from '@/types/asset';

interface UploadAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onUploadComplete: () => void;
}

interface AnalysisResult {
  type: AssetType;
  name: string;
  description: string;
}

export default function UploadAssetModal({
  isOpen,
  onClose,
  projectId,
  onUploadComplete,
}: UploadAssetModalProps) {
  const [assetType, setAssetType] = useState<AssetType>('character');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading && !analyzing) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, uploading, analyzing]);

  // Handle click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !uploading && !analyzing) {
        onClose();
      }
    },
    [onClose, uploading, analyzing],
  );

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setAssetType('character');
      setName('');
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
      setUploading(false);
      setAnalyzing(false);
      setDragActive(false);
    }
  }, [isOpen]);

  // Handle paste from clipboard
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleFile(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Image file is too large. Maximum size is 10MB.');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setImageFile(file);

    // Clear previous values when new image is uploaded
    setName('');
    setDescription('');
    setAssetType('character');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleAnalyzeWithAI = async () => {
    if (!imagePreview) return;

    setAnalyzing(true);

    try {
      // Extract base64 data and mime type from data URL
      const [header, base64Data] = imagePreview.split(',');
      const mimeMatch = header.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

      const response = await fetch('/api/assets/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze image');
      }

      const result: AnalysisResult = await response.json();

      // Update form with AI-generated values
      setAssetType(result.type);
      setName(result.name);
      setDescription(result.description);
    } catch (error) {
      console.error('Failed to analyze image:', error);
      alert('Failed to analyze image. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpload = async () => {
    if (!imageFile || !name.trim()) {
      alert('Please select an image and generate details with AI first');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('projectId', projectId);
      formData.append('type', assetType);
      formData.append('name', name);
      formData.append('description', description);

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload asset');
      }

      await response.json();

      // Notify parent and close modal
      onUploadComplete();
      onClose();
    } catch (error) {
      console.error('Failed to upload asset:', error);
      alert('Failed to upload asset. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Upload className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Upload Asset</h2>
              <p className="text-sm text-gray-500">Drop an image or paste from clipboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={uploading || analyzing}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {!imagePreview ? (
            /* Upload Area */
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-white rounded-full">
                  <FileImage className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Drop your image here, or click to browse
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, WebP up to 10MB</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clipboard className="w-4 h-4" />
                  <span>Or press Cmd+V / Ctrl+V to paste</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          ) : (
            /* Image Preview with Details - Side by Side Layout */
            <div className="flex gap-5">
              {/* Image Preview - 9:16 Aspect Ratio */}
              <div className="relative flex-shrink-0 w-48">
                <div className="aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setName('');
                    setDescription('');
                  }}
                  disabled={uploading || analyzing}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-md shadow hover:bg-white transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Details Section */}
              <div className="flex-1 flex flex-col">
                {/* Name and Description Display */}
                {name ? (
                  <div className="space-y-3 flex-1">
                    {/* Asset Type Badge */}
                    <span
                      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                        assetType === 'character'
                          ? 'bg-purple-100 text-purple-700'
                          : assetType === 'prop'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {assetType}
                    </span>

                    {/* Name */}
                    <h3 className="text-lg font-semibold text-gray-900">{name}</h3>

                    {/* Description */}
                    <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
                  </div>
                ) : (
                  /* Empty State - Prompt to Generate */
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                    <div className="p-3 bg-indigo-50 rounded-full mb-3">
                      <Sparkles className="w-6 h-6 text-indigo-500" />
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      Click the button below to analyze this image
                    </p>
                    <p className="text-xs text-gray-400">
                      AI will detect type, name, and description
                    </p>
                  </div>
                )}

                {/* Generate Button */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={handleAnalyzeWithAI}
                    disabled={uploading || analyzing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {name ? 'Re-analyze with AI' : 'Analyze with AI'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-400">Press ESC to close</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={uploading || analyzing}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || analyzing || !imageFile || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Upload Asset
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
