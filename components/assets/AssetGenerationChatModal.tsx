/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Check, Loader2, Edit3, Download, ChevronLeft, ChevronRight, ArrowRight, FileText } from 'lucide-react';
import type { AssetType, AssetProvider } from '@/types/asset';
import type { AspectRatio } from '@/types/project';

interface AssetGenerationChatModalProps {
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
}

interface GeneratedAsset {
  id: string;
  imageUrl: string;
  blob: Blob;
  metadata: {
    type: AssetType;
    aspectRatio: string;
    prompt: string;
    timestamp: number;
  };
  selected: boolean;
}

export default function AssetGenerationChatModal({
  isOpen,
  onClose,
  projectId,
  onSaveAssets,
}: AssetGenerationChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat to bottom
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

  // Reset current asset index when new assets are added
  useEffect(() => {
    if (generatedAssets.length > 0 && currentAssetIndex >= generatedAssets.length) {
      setCurrentAssetIndex(generatedAssets.length - 1);
    }
  }, [generatedAssets.length, currentAssetIndex]);

  // Keyboard shortcuts for arrow navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow navigation only when textarea is not focused
      if (document.activeElement === chatInputRef.current) return;

      if (generatedAssets.length === 0) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          setCurrentAssetIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          setCurrentAssetIndex(prev => Math.min(generatedAssets.length - 1, prev + 1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, generatedAssets.length]);

  if (!isOpen) return null;

  const currentAsset = generatedAssets[currentAssetIndex];
  const canNavigateLeft = currentAssetIndex > 0;
  const canNavigateRight = currentAssetIndex < generatedAssets.length - 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chatInput.trim() || isGenerating) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsGenerating(true);

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }]);

    try {
      // Call the chat-based generation API
      const response = await fetch('/api/assets/generate-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          aspectRatio: '9:16', // Use portrait aspect ratio
          previousAssets: generatedAssets.map(a => ({
            id: a.id,
            metadata: a.metadata,
          })),
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.response,
        timestamp: Date.now(),
      }]);

      // Add generated assets
      if (result.assets && result.assets.length > 0) {
        const newAssets: GeneratedAsset[] = result.assets.map((asset: any) => {
          // Convert blob data object back to actual Blob
          let blob: Blob;
          if (asset.blob && asset.blob.data) {
            // API returns {type, data} object, need to convert to Blob
            const binaryString = atob(asset.blob.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            blob = new Blob([bytes], { type: asset.blob.type });
          } else {
            // Fallback: create blob from data URL
            const base64Data = asset.imageUrl.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            blob = new Blob([bytes], { type: 'image/png' });
          }

          return {
            id: asset.id,
            imageUrl: asset.imageUrl,
            blob,
            metadata: asset.metadata,
            selected: false,
          };
        });

        setGeneratedAssets(prev => [...prev, ...newAssets]);
      }
    } catch (error) {
      console.error('Generation error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error while generating assets. Please try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends message, Shift+Enter adds new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleSelection = (id: string) => {
    setGeneratedAssets(prev =>
      prev.map(a => (a.id === id ? { ...a, selected: !a.selected } : a))
    );
  };

  const handleSave = async () => {
    const selectedAssets = generatedAssets.filter(a => a.selected);

    if (selectedAssets.length === 0) {
      alert('Please select at least one asset to save');
      return;
    }

    setIsSaving(true);

    try {
      const assetsToSave = selectedAssets.map((asset, index) => ({
        type: asset.metadata.type,
        name: `${asset.metadata.type} ${index + 1}`,
        description: asset.metadata.prompt,
        aspectRatio: asset.metadata.aspectRatio as unknown as AspectRatio,
        imageBlob: asset.blob,
        prompt: asset.metadata.prompt,
        provider: 'gemini' as AssetProvider,
      }));

      await onSaveAssets(assetsToSave);

      // Reset and close
      setMessages([]);
      setGeneratedAssets([]);
      onClose();
    } catch (error) {
      console.error('Failed to save assets:', error);
      alert('Failed to save assets. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = (asset: GeneratedAsset) => {
    const a = document.createElement('a');
    a.href = asset.imageUrl;
    a.download = `${asset.metadata.type}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const selectedCount = generatedAssets.filter(a => a.selected).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Generate Assets</h2>
              <p className="text-sm text-gray-500">Chat with AI to create and refine visual assets</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {generatedAssets.length > 0 && (
              <button
                onClick={() => setShowPromptPreview(!showPromptPreview)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isGenerating || isSaving}
              >
                <FileText className="w-4 h-4" />
                {showPromptPreview ? 'Hide Prompts' : 'View Prompts'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isGenerating || isSaving}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Main Content: 60/40 Split Layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Image Gallery (60%) */}
          <div className="w-[60%] bg-gray-50 flex flex-col">
            {generatedAssets.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg font-medium mb-2">
                    No assets generated yet
                  </p>
                  <p className="text-gray-400 text-sm">
                    Start a conversation in the chat to generate assets
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Top Action Bar */}
                {/* Image Gallery: Thumbnails (Left) + Active Image (Right) */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Left: Vertical Thumbnail List */}
                  <div className="w-24 bg-gray-50 py-4 overflow-y-auto flex-shrink-0 flex items-center justify-center">
                    <div className="space-y-2 w-16">
                      {generatedAssets.map((asset, index) => (
                        <button
                          key={asset.id}
                          onClick={() => setCurrentAssetIndex(index)}
                          className={`relative w-full rounded-md overflow-hidden transition-all duration-200 ${
                            index === currentAssetIndex
                              ? 'ring-1 ring-primary/60 shadow-sm'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ aspectRatio: '9/16' }}
                          title={`Image ${index + 1}`}
                        >
                          <img
                            src={asset.imageUrl}
                            alt={`${asset.metadata.type} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />

                          {/* Selection Indicator */}
                          {asset.selected && (
                            <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                              <Check className="w-2.5 h-2.5 text-primary-foreground" />
                            </div>
                          )}

                          {/* Active Indicator */}
                          {index === currentAssetIndex && (
                            <div className="absolute inset-0 bg-primary/5" />
                          )}

                          {/* Image Number Badge */}
                          <div className="absolute bottom-1 left-1 text-white text-[10px] font-semibold drop-shadow-md">
                            {index + 1}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: Large Active Image */}
                  <div className="flex-1 flex items-center justify-center bg-gray-50 p-8 overflow-hidden">
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        src={currentAsset.imageUrl}
                        alt={currentAsset.metadata.type}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                      />

                      {/* Metadata Text (No Frame) */}
                      <div className="absolute top-4 left-4 text-sm font-medium text-gray-600">
                        {currentAsset.metadata.type} • {currentAsset.metadata.aspectRatio}
                      </div>

                      {/* Action Buttons (Top Right) - On Image */}
                      <div className="absolute top-4 right-4 flex items-center gap-2">
                        {/* Download Button */}
                        <button
                          onClick={() => handleDownload(currentAsset)}
                          className="p-2 rounded-lg bg-white/90 hover:bg-white shadow-lg transition-colors backdrop-blur-sm"
                          title="Download"
                        >
                          <Download className="w-4 h-4 text-gray-700" />
                        </button>

                        {/* Save to Gallery Icon Button */}
                        <button
                          onClick={async () => {
                            if (currentAsset.selected) {
                              // Already saved, skip
                              return;
                            }

                            try {
                              setIsSaving(true);

                              // Save this single asset directly
                              const assetToSave = {
                                type: currentAsset.metadata.type,
                                name: `${currentAsset.metadata.type} ${Date.now()}`,
                                description: currentAsset.metadata.prompt,
                                aspectRatio: currentAsset.metadata.aspectRatio as unknown as AspectRatio,
                                imageBlob: currentAsset.blob,
                                prompt: currentAsset.metadata.prompt,
                                provider: 'gemini' as AssetProvider,
                              };

                              await onSaveAssets([assetToSave]);

                              // Mark as selected
                              toggleSelection(currentAsset.id);

                              // Add chat message notification
                              setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: `✓ Saved "${currentAsset.metadata.type}" to your asset gallery!`,
                                timestamp: Date.now(),
                              }]);

                              // Scroll to bottom of chat
                              setTimeout(() => {
                                chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                              }, 100);
                            } catch (error) {
                              console.error('Failed to save asset:', error);
                              setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: `Failed to save asset. Please try again.`,
                                timestamp: Date.now(),
                              }]);
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                          disabled={isSaving || currentAsset.selected}
                          className={`p-2 rounded-lg shadow-lg transition-colors backdrop-blur-sm ${
                            currentAsset.selected
                              ? 'bg-indigo-600 hover:bg-indigo-700 cursor-default'
                              : 'bg-white/90 hover:bg-white'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={currentAsset.selected ? "Already saved to gallery" : "Save to gallery"}
                        >
                          {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          ) : currentAsset.selected ? (
                            <Check className="w-4 h-4 text-white" />
                          ) : (
                            <Check className="w-4 h-4 text-gray-700" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Chat Panel (40%) */}
          <div className="w-[40%] border-l border-gray-200 bg-gray-50 flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">AI Assistant</h3>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Describe what you want to create
              </p>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    Start a conversation to generate assets
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    e.g., "Create a detective character in noir style"
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))
              )}

              {/* Loading Indicator */}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  </div>
                </div>
              )}

              {/* Scroll Anchor */}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form
              onSubmit={handleSubmit}
              className="p-4 border-t border-gray-200 bg-white flex-shrink-0"
            >
              <div className="flex gap-2 items-end">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm min-h-[40px] max-h-[120px] overflow-y-auto"
                  disabled={isGenerating}
                  style={{ height: 'auto' }}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isGenerating}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  title="Send message (Enter)"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Prompt Preview Overlay */}
      {showPromptPreview && (
        <div className="absolute inset-0 bg-white z-10 flex flex-col">
          {/* Preview Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Generation Prompts</h2>
                <p className="text-sm text-gray-500">Review all asset generation prompts</p>
              </div>
            </div>
            <button
              onClick={() => setShowPromptPreview(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto">
              <div className="screenplay">
                <div className="screenplay-transition">ASSET GENERATION SCRIPT</div>

                {generatedAssets.map((asset, index) => (
                  <div key={asset.id} className="mb-8">
                    <div className="screenplay-scene-heading">
                      ASSET {index + 1} - {asset.metadata.type.toUpperCase()}
                    </div>

                    <div className="screenplay-action">
                      Type: {asset.metadata.type}
                      <br />
                      Aspect Ratio: {asset.metadata.aspectRatio}
                      <br />
                      Generated: {new Date(asset.metadata.timestamp).toLocaleString()}
                    </div>

                    <div className="screenplay-character">GENERATION PROMPT</div>
                    <div className="screenplay-dialogue">{asset.metadata.prompt}</div>

                    {index < generatedAssets.length - 1 && (
                      <div className="screenplay-transition">---</div>
                    )}
                  </div>
                ))}

                <div className="screenplay-transition">END OF SCRIPT</div>
              </div>
            </div>
          </div>

          {/* Preview Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {generatedAssets.length} {generatedAssets.length === 1 ? 'asset' : 'assets'} generated
              </div>
              <button
                onClick={() => setShowPromptPreview(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
