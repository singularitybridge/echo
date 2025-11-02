/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Home,
  ChevronsRight,
  Sparkles,
} from 'lucide-react';
import type { Asset } from '@/types/asset';

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onEditComplete: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function EditAssetModal({
  isOpen,
  onClose,
  asset,
  onEditComplete,
}: EditAssetModalProps) {
  // State
  const [versionHistory, setVersionHistory] = useState<Asset[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingLineage, setIsLoadingLineage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Load version lineage when modal opens
  useEffect(() => {
    if (!isOpen || !asset) return;

    const loadLineage = async () => {
      setIsLoadingLineage(true);
      try {
        const response = await fetch(`/api/assets/${asset.id}/lineage`);
        if (!response.ok) {
          throw new Error('Failed to load version history');
        }

        const data = await response.json();
        setVersionHistory(data.lineage);
        setCurrentVersionIndex(data.lineage.length - 1); // Start at latest version

        // Initialize messages with edit history
        const initialMessages: ChatMessage[] = [];
        data.lineage.forEach((version: Asset, index: number) => {
          if (index === 0) {
            // First version - original asset
            initialMessages.push({
              role: 'assistant',
              content: `Asset created: ${version.name}`,
              timestamp: new Date(version.createdAt).getTime(),
            });
          } else {
            // Subsequent versions - show edit prompts
            const editEntry = version.editHistory[version.editHistory.length - 1];
            if (editEntry) {
              initialMessages.push({
                role: 'user',
                content: editEntry.editPrompt,
                timestamp: new Date(editEntry.timestamp).getTime(),
              });
              initialMessages.push({
                role: 'assistant',
                content: `Version ${version.version} created with your changes.`,
                timestamp: new Date(version.createdAt).getTime(),
              });
            }
          }
        });
        setMessages(initialMessages);
      } catch (error) {
        console.error('Failed to load version history:', error);
        alert('Failed to load version history');
      } finally {
        setIsLoadingLineage(false);
      }
    };

    loadLineage();
  }, [isOpen, asset]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Enter to send message
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
        return;
      }

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

      // Arrow navigation (only when chat input is not focused)
      if (document.activeElement === chatInputRef.current) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigateVersion(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateVersion(1);
          break;
        case 'Home':
          e.preventDefault();
          setCurrentVersionIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentVersionIndex(versionHistory.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, versionHistory, currentVersionIndex, chatInput]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setVersionHistory([]);
      setCurrentVersionIndex(0);
      setMessages([]);
      setChatInput('');
      setIsGenerating(false);
    }
  }, [isOpen]);

  const navigateVersion = (delta: number) => {
    const newIndex = currentVersionIndex + delta;
    if (newIndex >= 0 && newIndex < versionHistory.length) {
      setCurrentVersionIndex(newIndex);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const currentAsset = versionHistory[currentVersionIndex];

      // Download the edited image as blob and convert to base64
      const imageResponse = await fetch(currentAsset.url);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch edited image');
      }

      const imageBlob = await imageResponse.blob();

      // Convert blob to base64
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      // Update the original asset with the edited image
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Image,
          editHistory: currentAsset.editHistory,
          version: currentAsset.version,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save asset');
      }

      onEditComplete();
      onClose();
    } catch (error) {
      console.error('Failed to save asset:', error);
      alert('Failed to save asset. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsNew = async () => {
    setIsSaving(true);
    try {
      const currentAsset = versionHistory[currentVersionIndex];

      // Create a new asset based on the current version
      const response = await fetch(`/api/assets/${currentAsset.id}/save-as-new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to save as new asset');
      }

      onEditComplete();
      onClose();
    } catch (error) {
      console.error('Failed to save as new asset:', error);
      alert('Failed to save as new asset. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isGenerating) return;

    const editPrompt = chatInput.trim();
    setChatInput('');
    setIsGenerating(true);

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: editPrompt,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Edit the current version
      const currentAsset = versionHistory[currentVersionIndex];
      const response = await fetch(`/api/assets/${currentAsset.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editPrompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to edit asset');
      }

      const newAsset: Asset = await response.json();

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: `Changes applied successfully. Click "Save" to update this asset or "Save as New" to create a new version.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update version history
      setVersionHistory((prev) => [...prev, newAsset]);
      setCurrentVersionIndex(versionHistory.length); // Move to new version
    } catch (error) {
      console.error('Failed to edit asset:', error);

      // Add error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Failed to edit asset. Please try again.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen || !asset) return null;

  const currentAsset = versionHistory[currentVersionIndex];
  const canNavigateLeft = currentVersionIndex > 0;
  const canNavigateRight = currentVersionIndex < versionHistory.length - 1;
  const isAtLatestVersion = currentVersionIndex === versionHistory.length - 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {asset.name}
              </h2>
              <p className="text-sm text-gray-500">
                Iterative AI Editing • Chat to refine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAsNew}
              disabled={isGenerating || isSaving || currentVersionIndex === 0}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save as New
            </button>
            <button
              onClick={handleSave}
              disabled={isGenerating || isSaving || currentVersionIndex === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

        {/* Main Content: Two-column layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Image Preview (60%) */}
          <div className="w-[60%] flex flex-col bg-gray-50 border-r border-gray-200">
            {/* Version Navigation */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentVersionIndex(0)}
                    disabled={!canNavigateLeft || isLoadingLineage}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="First version (Home)"
                  >
                    <Home className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => navigateVersion(-1)}
                    disabled={!canNavigateLeft || isLoadingLineage}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Previous version (←)"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => navigateVersion(1)}
                    disabled={!canNavigateRight || isLoadingLineage}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next version (→)"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setCurrentVersionIndex(versionHistory.length - 1)}
                    disabled={!canNavigateRight || isLoadingLineage}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Latest version (End)"
                  >
                    <ChevronsRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    Version {currentVersionIndex + 1} of {versionHistory.length}
                  </span>
                  {currentVersionIndex === 0 && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      Original
                    </span>
                  )}
                  {!isAtLatestVersion && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                      Viewing Past
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Image Display */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
              {isLoadingLineage ? (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm">Loading version history...</p>
                </div>
              ) : currentAsset ? (
                <div className="relative h-full w-full flex items-center justify-center">
                  <img
                    src={currentAsset.url}
                    alt={currentAsset.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />

                  {/* Version Badge Overlay */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    <div className="px-3 py-1.5 bg-black bg-opacity-70 text-white text-sm rounded-lg font-medium">
                      v{currentAsset.version}
                    </div>

                    {/* Show edit prompt for non-original versions */}
                    {currentAsset.version > 1 && currentAsset.editHistory.length > 0 && (
                      <div className="px-3 py-1.5 bg-purple-600 bg-opacity-90 text-white text-xs rounded-lg max-w-xs">
                        {currentAsset.editHistory[currentAsset.editHistory.length - 1].editPrompt}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Column: Chat Interface (40%) */}
          <div className="w-[40%] flex flex-col bg-white">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.role === 'user' ? 'text-purple-200' : 'text-gray-500'
                      }`}
                    >
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-900 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <p className="text-sm">Generating new version...</p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              {!isAtLatestVersion && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    You are viewing a past version. New edits will be based on Version {currentVersionIndex + 1}.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isGenerating || isLoadingLineage}
                  placeholder="Describe your edit (Cmd+Enter to send)..."
                  rows={3}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 text-sm"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isGenerating || isLoadingLineage}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span>← → Navigate versions</span>
                  <span>/ Focus input</span>
                </div>
                <span>Cmd+Enter Send</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
