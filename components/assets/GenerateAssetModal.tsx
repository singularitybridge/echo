/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Check,
} from 'lucide-react';
import type { AssetType, AssetProvider } from '@/types/asset';
import { AspectRatio } from '@/types';
import { ImageGenerationModel, ModelGenerationResult } from '@/types/ai-models';
import { getGenerationModelDefinition } from '@/lib/ai-models';
import { ModelSelector } from './ModelSelector';

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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  results?: ModelGenerationResult[];
}

export default function GenerateAssetModal({
  isOpen,
  onClose,
  projectId,
  onSaveAssets,
}: GenerateAssetModalProps) {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  // Default: all generation models selected (except bria)
  const [selectedModels, setSelectedModels] = useState<ImageGenerationModel[]>([
    'flux-dev',
    'ideogram-v2',
    'imagen4-ultra',
    'hidream-i1',
    'nano-banana-pro',
    'flux-pro-ultra',
    'recraft-v3',
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // Multi-model state
  const [allResults, setAllResults] = useState<ModelGenerationResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ModelGenerationResult | null>(null);
  const [hoveredPreview, setHoveredPreview] = useState<ModelGenerationResult | null>(null);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-grow textarea
  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto';
      chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
    }
  }, [chatInput]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setChatInput('');
      setIsGenerating(false);
      // Reset to all models selected (except bria)
      setSelectedModels([
        'flux-dev',
        'ideogram-v2',
        'imagen4-ultra',
        'hidream-i1',
        'nano-banana-pro',
        'flux-pro-ultra',
        'recraft-v3',
      ]);
      setAllResults([]);
      setSelectedResult(null);
      setHoveredPreview(null);
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // / to focus chat input
      if (e.key === '/' && document.activeElement !== chatInputRef.current) {
        e.preventDefault();
        chatInputRef.current?.focus();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelectResult = (result: ModelGenerationResult) => {
    if (!result.imageBytes || !result.mimeType) return;
    setSelectedResult(result);

    // Add selection message to chat
    const modelDef = getGenerationModelDefinition(result.model);
    const selectionMessage: ChatMessage = {
      role: 'assistant',
      content: `Selected result from ${modelDef.name}. Click "Save" to add this asset to your library.`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, selectionMessage]);
  };

  const handleSave = async () => {
    if (!selectedResult || !selectedResult.imageBytes || !selectedResult.mimeType) {
      alert('Please select a generated image first');
      return;
    }

    setIsSaving(true);

    try {
      // Convert base64 to blob
      const base64Data = selectedResult.imageBytes;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const imageBlob = new Blob([byteArray], { type: selectedResult.mimeType });

      // Log MIME type for debugging file extension issue
      console.log('🔍 Blob created with MIME type:', selectedResult.mimeType);
      console.log('🔍 Blob type property:', imageBlob.type);

      // Get the user's prompt from the last user message
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
      const prompt = lastUserMessage?.content || 'AI generated asset';

      const modelDef = getGenerationModelDefinition(selectedResult.model);

      // Prepare asset for saving
      const assetToSave = {
        type: 'prop' as AssetType,
        name: `${modelDef.name} - Generated Asset`,
        description: prompt,
        aspectRatio: AspectRatio.PORTRAIT,
        imageBlob: imageBlob,
        prompt: prompt,
        provider: 'fal' as AssetProvider,
      };

      await onSaveAssets([assetToSave]);

      // Add success message to chat
      const successMessage: ChatMessage = {
        role: 'assistant',
        content: `Asset saved successfully! You can now use it in your project.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, successMessage]);

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Failed to save asset:', error);

      // Add error message to chat
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Failed to save asset. Please try again.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isGenerating) return;

    const prompt = chatInput.trim();
    setChatInput('');
    setIsGenerating(true);
    setSelectedResult(null); // Reset selection when generating new results

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      console.log(`Generating with ${selectedModels.length} models:`, selectedModels);

      // Call multi-model generation API
      const response = await fetch('/api/generate-image-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          models: selectedModels,
          prompt: prompt,
          aspectRatio: '9:16',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();

      // Store results
      setAllResults((prev) => [...prev, ...data.results]);

      // Add assistant message with results inline
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: `Generated ${data.results.length} result${data.results.length > 1 ? 's' : ''}. Click on an image to select it.`,
        timestamp: Date.now(),
        results: data.results,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to generate assets:', error);

      // Add error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Failed to generate assets. Please try again.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  // Helper function to safely convert error to string
  const getErrorMessage = (error: any): string => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
      if (error.message) return error.message;
      if (error.msg) return error.msg;
      return JSON.stringify(error);
    }
    return 'Generation failed';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Generate Assets</h2>
              <p className="text-sm text-gray-500">
                Chat to create AI-generated assets (9:16)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isGenerating || isSaving || !selectedResult}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isGenerating || isSaving}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Main Content: Three-column layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Results List (15%) */}
          <div className="w-[15%] flex flex-col bg-white border-r border-gray-200">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-600 uppercase">Results</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {allResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-4 text-center text-gray-400">
                  <Sparkles className="w-8 h-8 mb-2" />
                  <p className="text-xs">No results yet</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {allResults.map((result, index) => {
                    const modelDef = getGenerationModelDefinition(result.model);
                    const isSelected = selectedResult?.model === result.model &&
                                     selectedResult?.imageBytes === result.imageBytes;

                    return (
                      <button
                        key={`${result.model}-${index}`}
                        onClick={() => !result.loading && !result.error && handleSelectResult(result)}
                        disabled={result.loading || !!result.error}
                        className={`w-full text-left p-2 rounded-lg transition-colors disabled:cursor-not-allowed ${
                          isSelected
                            ? 'bg-indigo-100 border-2 border-indigo-500'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            isSelected ? 'bg-indigo-600' : 'bg-gray-300'
                          }`} />
                          <span className={`text-xs font-medium truncate ${
                            isSelected ? 'text-indigo-900' : 'text-gray-700'
                          }`}>
                            {modelDef.name}
                          </span>
                        </div>
                        {result.generationTime && (
                          <p className="text-xs text-gray-500 mt-1 ml-3.5">
                            {result.generationTime.toFixed(1)}s
                          </p>
                        )}
                        {result.loading && (
                          <p className="text-xs text-blue-500 mt-1 ml-3.5">Generating...</p>
                        )}
                        {result.error && (
                          <p className="text-xs text-red-500 mt-1 ml-3.5 line-clamp-2">
                            {getErrorMessage(result.error)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Middle Column: Image Preview (50%) */}
          <div className="w-[50%] flex flex-col bg-gray-50 border-r border-gray-200">
            {/* Image Display */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
              {!selectedResult && allResults.length === 0 ? (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <Sparkles className="w-12 h-12" />
                  <p className="text-sm">Generate an image to get started</p>
                </div>
              ) : selectedResult || hoveredPreview ? (
                <div className="relative h-full w-full flex items-center justify-center">
                  <img
                    src={
                      hoveredPreview && hoveredPreview.imageBytes
                        ? `data:${hoveredPreview.mimeType};base64,${hoveredPreview.imageBytes}`
                        : selectedResult?.imageBytes
                        ? `data:${selectedResult.mimeType};base64,${selectedResult.imageBytes}`
                        : ''
                    }
                    alt={
                      hoveredPreview
                        ? getGenerationModelDefinition(hoveredPreview.model).name
                        : selectedResult
                        ? getGenerationModelDefinition(selectedResult.model).name
                        : ''
                    }
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />

                  {/* Model Badge Overlay */}
                  <div className="absolute top-3 left-3">
                    {hoveredPreview ? (
                      <div className="px-3 py-1.5 bg-indigo-600/90 text-white text-sm rounded-lg font-medium">
                        Previewing: {getGenerationModelDefinition(hoveredPreview.model).name}
                      </div>
                    ) : selectedResult ? (
                      <div className="px-3 py-1.5 bg-black/70 text-white text-sm rounded-lg font-medium">
                        {getGenerationModelDefinition(selectedResult.model).name}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <AlertCircle className="w-12 h-12" />
                  <p className="text-sm">Select a result to preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Chat Interface (35%) */}
          <div className="w-[35%] flex flex-col bg-white">
            {/* Model Selection */}
            <div className="border-b border-gray-200 p-4 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Models
                <span className="text-xs text-gray-500 ml-2">
                  (select one or more models to compare)
                </span>
              </label>
              <ModelSelector
                mode="generation"
                selectedModels={selectedModels}
                onModelsChange={setSelectedModels as any}
              />
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Sparkles className="w-12 h-12 mb-3" />
                  <p className="text-sm">Describe what you want to generate</p>
                  <p className="text-xs mt-1">Example: "A modern coffee shop interior with warm lighting"</p>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className="space-y-2">
                  <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.role === 'user' ? 'text-indigo-200' : 'text-gray-500'
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  {/* Inline Results */}
                  {message.results && message.results.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pl-2">
                      {message.results.map((result, resultIndex) => {
                        const modelDef = getGenerationModelDefinition(result.model);
                        const isSelected = selectedResult?.model === result.model &&
                                         selectedResult?.imageBytes === result.imageBytes;
                        return (
                          <button
                            key={`${result.model}-${resultIndex}`}
                            onClick={() => !result.loading && !result.error && handleSelectResult(result)}
                            onMouseEnter={() => !result.loading && !result.error && setHoveredPreview(result)}
                            onMouseLeave={() => setHoveredPreview(null)}
                            disabled={result.loading || !!result.error}
                            className={`relative rounded-lg overflow-hidden bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group ${
                              isSelected ? 'ring-2 ring-indigo-500' : 'hover:ring-2 hover:ring-indigo-400'
                            }`}
                          >
                            {/* Image */}
                            <div className="relative aspect-square bg-gray-50">
                              {result.loading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <Loader2 className="w-5 h-5 animate-spin text-gray-400 mb-1" />
                                  <p className="text-xs text-gray-500">{modelDef.name}</p>
                                </div>
                              )}
                              {result.error && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                                  <AlertCircle className="w-5 h-5 text-red-400 mb-1" />
                                  <p className="text-xs text-red-500 text-center">{getErrorMessage(result.error)}</p>
                                </div>
                              )}
                              {!result.loading && !result.error && result.imageBytes && (
                                <>
                                  <img
                                    src={`data:${result.mimeType};base64,${result.imageBytes}`}
                                    alt={modelDef.name}
                                    className="w-full h-full object-cover"
                                  />

                                  {/* Model Name Overlay */}
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium text-white truncate">{modelDef.name}</span>
                                      {result.generationTime && (
                                        <span className="text-xs text-white/80">{result.generationTime.toFixed(1)}s</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Selected Check Icon */}
                                  {isSelected && (
                                    <div className="absolute top-2 right-2 bg-indigo-600 rounded-full p-1">
                                      <Check className="w-4 h-4 text-white" />
                                    </div>
                                  )}

                                  {/* Hover Effect */}
                                  {!isSelected && (
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                                  )}
                                </>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-900 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <p className="text-sm">Generating...</p>
                    </div>
                  </div>
                </div>
              )}

              {isSaving && (
                <div className="flex justify-start">
                  <div className="bg-indigo-100 text-indigo-900 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <p className="text-sm">Saving asset...</p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isGenerating || isSaving}
                  placeholder="Describe what you want to generate (Enter to send, Shift+Enter for new line)..."
                  rows={1}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 text-sm min-h-[40px] max-h-[120px] overflow-y-auto"
                  style={{ height: 'auto' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isGenerating || isSaving}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  title="Send message (Enter)"
                >
                  {isGenerating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span>/ Focus input</span>
                  <span>Esc Close</span>
                </div>
                <span>Enter Send</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
