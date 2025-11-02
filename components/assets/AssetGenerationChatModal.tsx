/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Check, Loader2, Send, Edit3, Download } from 'lucide-react';
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
  const [isSaving, setIsSaving] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

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
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
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
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isGenerating || isSaving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Main Content: 2-Column Layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Asset Preview Grid */}
          <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
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
              <div>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">
                    Generated Assets ({generatedAssets.length})
                  </h3>
                  <p className="text-xs text-gray-500">
                    Click to select assets for saving ({selectedCount} selected)
                  </p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {generatedAssets.map(asset => (
                    <div
                      key={asset.id}
                      className={`group relative border-2 rounded-lg overflow-hidden transition-all cursor-pointer ${
                        asset.selected
                          ? 'border-indigo-600 ring-2 ring-indigo-600 ring-offset-2'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleSelection(asset.id)}
                    >
                      <div className="aspect-video bg-gray-100 relative">
                        <img
                          src={asset.imageUrl}
                          alt={`Asset ${asset.id}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />

                        {/* Selection Indicator */}
                        <div
                          className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            asset.selected
                              ? 'bg-indigo-600'
                              : 'bg-white border-2 border-gray-300 group-hover:border-gray-400'
                          }`}
                        >
                          {asset.selected && <Check className="w-4 h-4 text-white" />}
                        </div>

                        {/* Download Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(asset);
                          }}
                          className="absolute bottom-2 right-2 p-2 bg-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                        >
                          <Download className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>

                      <div className="p-2 bg-white">
                        <p className="text-xs text-gray-600 truncate">
                          {asset.metadata.type} • {asset.metadata.aspectRatio}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Chat Panel */}
          <div className="w-96 border-l border-gray-200 bg-gray-50 flex flex-col">
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
              <div className="flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder="Type your message... (Cmd+Enter to send)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                  disabled={isGenerating}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isGenerating}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedCount > 0 && (
              <span>{selectedCount} asset{selectedCount !== 1 ? 's' : ''} selected</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isGenerating || isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || selectedCount === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
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
          </div>
        </div>
      </div>
    </div>
  );
}
