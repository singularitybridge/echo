/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Home,
  ChevronsRight,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { Asset } from '@/types/asset';
import { ImageEditingModel, ModelEditResult } from '@/types/ai-models';
import { getModelDefinition } from '@/lib/ai-models';
import { ModelSelector } from './ModelSelector';

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
  results?: ModelEditResult[];
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
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isLoadingLineage, setIsLoadingLineage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Multi-model state - all editing models selected by default
  const [selectedModels, setSelectedModels] = useState<ImageEditingModel[]>([
    'gemini-flash',
    'flux-kontext',
    'qwen-edit',
    'seededit',
    'seededit-v4',
    'nano-banana-pro',
  ]);
  const [hoveredPreview, setHoveredPreview] = useState<ModelEditResult | null>(null);
  const [selectedResult, setSelectedResult] = useState<ImageEditingModel | null>(null);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Load version lineage when modal opens
  useEffect(() => {
    if (!isOpen || !asset) return;

    const loadLineage = async () => {
      setIsLoadingLineage(true);
      try {
        // Check if this is a storyboard asset (synthetic ID from story storage)
        const isStoryboardAsset = asset.id.startsWith('storyboard-') || asset.type === 'storyboard';

        if (isStoryboardAsset) {
          // Storyboard assets don't have version history in the database
          // Initialize with just the current asset as version 1
          const storyboardAsset: Asset = {
            ...asset,
            version: 1,
            editHistory: [],
          };
          setVersionHistory([storyboardAsset]);
          setCurrentVersionIndex(0);

          // Initialize with the generation prompt as the first message
          const initialMessages: ChatMessage[] = [];

          // Show the prompt that was used to generate this storyboard frame
          // Priority: generationPrompt > description
          const promptToShow = asset.generationPrompt || asset.description || '';

          if (promptToShow && promptToShow !== 'Storyboard frame') {
            initialMessages.push({
              role: 'assistant',
              content: `Created with storyboard prompt:\n\n"${promptToShow}"`,
              timestamp: Date.now() - 1,
            });
          } else {
            // Fallback if no prompt available
            initialMessages.push({
              role: 'assistant',
              content: `Storyboard frame for: ${asset.name}`,
              timestamp: Date.now() - 1,
            });
          }

          setMessages(initialMessages);

          // Ensure chat input is cleared (prevent browser autocomplete)
          setChatInput('');
        } else {
          // Regular assets - load from database
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

              // Show the generation prompt if this is a new root asset with one
              if (version.generationPrompt && data.lineage.length === 1) {
                initialMessages.push({
                  role: 'assistant',
                  content: `Last edit prompt: "${version.generationPrompt}"`,
                  timestamp: new Date(version.createdAt).getTime() + 1,
                });
              }
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

          // Ensure chat input is cleared (prevent browser autocomplete from restoring previous values)
          setChatInput('');
        }
      } catch (error) {
        console.error('Failed to load version history:', error);
        alert('Failed to load version history. Please try again.');
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

  // Auto-grow textarea
  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto';
      chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
    }
  }, [chatInput]);

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

      // Arrow navigation (only when chat input is not focused)
      if (document.activeElement === chatInputRef.current) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          navigateVersion(-1);
          break;
        case 'ArrowRight':
        case 'ArrowDown':
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
      setIsRegenerating(false);
      // Reset to all editing models selected
      setSelectedModels([
        'gemini-flash',
        'flux-kontext',
        'qwen-edit',
        'seededit',
        'seededit-v4',
        'nano-banana-pro',
      ]);
      setSelectedResult(null);
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

      // Check if this is a storyboard asset (synthetic ID from story storage)
      const isStoryboardAsset = asset.id.startsWith('storyboard-') || asset.type === 'storyboard';

      if (isStoryboardAsset) {
        // Storyboard assets need to be saved via the stories API
        // Extract project ID from the asset
        const projectId = asset.projectId;
        if (!projectId) {
          throw new Error('Missing project ID for storyboard asset');
        }

        // Generate a unique filename for the edited storyboard frame
        const timestamp = Date.now();
        const filename = `storyboard-edited-${timestamp}.png`;

        const response = await fetch(`/api/stories/${projectId}/assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'storyboard',
            filename,
            imageBase64: base64Image,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to save storyboard asset');
        }
      } else {
        // Regular assets - update via the assets API
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
      }

      onEditComplete();
      onClose();
    } catch (error) {
      console.error('Failed to save asset:', error);
      alert(`Failed to save asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsNew = async () => {
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

      // Check if this is a storyboard asset (synthetic ID from story storage)
      const isStoryboardAsset = asset.id.startsWith('storyboard-') || asset.type === 'storyboard';

      if (isStoryboardAsset) {
        // Storyboard assets need to be saved via the stories API
        const projectId = asset.projectId;
        if (!projectId) {
          throw new Error('Missing project ID for storyboard asset');
        }

        // Generate a unique filename for the new storyboard frame
        const timestamp = Date.now();
        const filename = `storyboard-new-${timestamp}.png`;

        const response = await fetch(`/api/stories/${projectId}/assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'storyboard',
            filename,
            imageBase64: base64Image,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to save storyboard asset as new');
        }
      } else {
        // Regular assets - create a new asset via the assets API
        // Get the last edit prompt used for this version
        let editPrompt = '';
        if (currentAsset.editHistory?.length > 0) {
          editPrompt = currentAsset.editHistory[currentAsset.editHistory.length - 1].editPrompt || '';
        } else if (currentAsset.generationPrompt) {
          editPrompt = currentAsset.generationPrompt;
        }

        const response = await fetch(`/api/assets/${currentAsset.id}/save-as-new`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Image,
            metadata: currentAsset,
            editPrompt,  // Include the edit prompt that was used to create this version
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to save as new asset');
        }
      }

      onEditComplete();
      onClose();
    } catch (error) {
      console.error('Failed to save as new asset:', error);
      alert(`Failed to save as new asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (isGenerating || isRegenerating) return;

    const currentAsset = versionHistory[currentVersionIndex];

    // Can only regenerate edited versions (not the original)
    if (currentAsset.version === 1 || currentAsset.editHistory.length === 0) {
      return;
    }

    // Get the last edit prompt used for this version
    const lastEdit = currentAsset.editHistory[currentAsset.editHistory.length - 1];
    const editPrompt = lastEdit.editPrompt;

    setIsRegenerating(true);

    // Add regeneration message to chat
    const regenerateMessage: ChatMessage = {
      role: 'assistant',
      content: `Regenerating with: "${editPrompt}"`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, regenerateMessage]);

    try {
      // Use the parent version for regeneration (one version before current)
      const parentAsset = versionHistory[currentVersionIndex - 1];

      const response = await fetch(`/api/assets/${parentAsset.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editPrompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate asset');
      }

      const newAsset: Asset = await response.json();

      // Add success message
      const successMessage: ChatMessage = {
        role: 'assistant',
        content: `New variation created successfully. This is an alternative version based on the same prompt.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, successMessage]);

      // Update version history - add new variation after current
      setVersionHistory((prev) => {
        const updated = [...prev];
        updated.splice(currentVersionIndex + 1, 0, newAsset);
        return updated;
      });

      // Move to the new variation
      setCurrentVersionIndex(currentVersionIndex + 1);
    } catch (error) {
      console.error('Failed to regenerate asset:', error);

      // Add error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Failed to regenerate. Please try again.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSelectCompareResult = async (result: ModelEditResult) => {
    if (!result.imageBytes || !result.mimeType) return;

    setIsGenerating(true);

    try {
      const currentAsset = versionHistory[currentVersionIndex];

      // Get the edit prompt from the last user message
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
      const editPrompt = lastUserMessage?.content || 'Multi-model edit';

      // Convert base64 to data URL
      const imageDataUrl = `data:${result.mimeType};base64,${result.imageBytes}`;

      // Create a new temporary asset object for the version history
      // This will use a data URL temporarily until saved
      const newAsset: Asset = {
        ...currentAsset,
        id: `${currentAsset.id}-temp-${Date.now()}`,
        version: currentAsset.version + 1,
        url: imageDataUrl, // Temporary data URL
        parentAssetId: currentAsset.id, // Link to parent for version lineage
        editHistory: [
          ...currentAsset.editHistory,
          {
            editPrompt,
            timestamp: new Date(),
            previousAssetId: currentAsset.id,
          },
        ],
        updatedAt: new Date(),
      };

      // Set selected result for visual indication
      setSelectedResult(result.model);

      // Add success message
      const successMessage: ChatMessage = {
        role: 'assistant',
        content: `Selected result from ${getModelDefinition(result.model).name}. Click "Save" to update this asset or "Save as New" to create a new version.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, successMessage]);

      // Update version history and set current index
      setVersionHistory((prev) => {
        const newHistory = [...prev, newAsset];
        const newIndex = newHistory.length - 1; // Last item in new array

        console.log('Version history updated:', {
          previousLength: prev.length,
          newLength: newHistory.length,
          newIndex,
          versions: newHistory.map(v => ({ id: v.id, version: v.version }))
        });

        // Set current index inside callback to use updated length
        setCurrentVersionIndex(newIndex);
        return newHistory;
      });
    } catch (error) {
      console.error('Failed to save selected result:', error);

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Failed to save selected result. Please try again.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isGenerating) return;

    const editPrompt = chatInput.trim();
    const modelsToUse = selectedModels.length > 0 ? selectedModels : ['flux-kontext'] as ImageEditingModel[];
    setChatInput('');
    setIsGenerating(true);
    setSelectedResult(null); // Reset selection when generating new results

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: editPrompt,
      timestamp: Date.now(),
    };

    // Create initial loading results for all selected models
    const loadingResults: ModelEditResult[] = modelsToUse.map((model) => ({
      model,
      loading: true,
    }));

    // Add assistant message with loading states immediately
    const assistantMessageTimestamp = Date.now();
    const loadingMessage: ChatMessage = {
      role: 'assistant',
      content: `Generating with ${modelsToUse.length} model${modelsToUse.length > 1 ? 's' : ''}...`,
      timestamp: assistantMessageTimestamp,
      results: loadingResults,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);

    try {
      const currentAsset = versionHistory[currentVersionIndex];

      // Convert current asset to data URL
      const imageResponse = await fetch(currentAsset.url);
      const imageBlob = await imageResponse.blob();
      const imageDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imageBlob);
      });

      // Determine aspect ratio from asset dimensions
      const img = new Image();
      const aspectRatio = await new Promise<string>((resolve) => {
        img.onload = () => {
          const ratio = img.width / img.height;
          if (Math.abs(ratio - 9/16) < 0.1) resolve('9:16');
          else if (Math.abs(ratio - 16/9) < 0.1) resolve('16:9');
          else if (Math.abs(ratio - 1) < 0.1) resolve('1:1');
          else if (Math.abs(ratio - 4/3) < 0.1) resolve('4:3');
          else if (Math.abs(ratio - 3/4) < 0.1) resolve('3:4');
          else resolve('16:9'); // Default
        };
        img.src = imageDataUrl;
      });

      // Use streaming API for progressive results
      const response = await fetch('/api/edit-image-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          models: modelsToUse,
          imageDataUrl,
          editPrompt,
          aspectRatio,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate with selected models';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Use default message
        }
        throw new Error(errorMessage);
      }

      // Process streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let completedCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === 'result') {
                completedCount++;
                const result = event.result as ModelEditResult;

                // Update the specific model's result in the message
                setMessages((prev) =>
                  prev.map((msg) => {
                    // Match by both timestamp AND role to avoid collision with user message
                    if (msg.timestamp !== assistantMessageTimestamp || msg.role !== 'assistant') return msg;

                    const updatedResults = msg.results?.map((r) =>
                      r.model === result.model ? result : r
                    );

                    return {
                      ...msg,
                      content: `Generated ${completedCount}/${modelsToUse.length} results...`,
                      results: updatedResults,
                    };
                  })
                );
              } else if (event.type === 'done') {
                // Final update - match by both timestamp AND role
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.timestamp === assistantMessageTimestamp && msg.role === 'assistant'
                      ? {
                          ...msg,
                          content: `Generated ${completedCount} result${completedCount > 1 ? 's' : ''}`,
                        }
                      : msg
                  )
                );
              }
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to edit asset:', error);

      // Update the loading message with error - match by both timestamp AND role
      setMessages((prev) =>
        prev.map((msg) =>
          msg.timestamp === assistantMessageTimestamp && msg.role === 'assistant'
            ? {
                ...msg,
                content: error instanceof Error ? error.message : 'Failed to edit asset. Please try again.',
                results: modelsToUse.map((model) => ({
                  model,
                  error: 'Generation failed',
                })),
              }
            : msg
        )
      );
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div className="max-w-[50%] min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate" title={asset.name}>
                {asset.name}
              </h2>
              {asset.description ? (
                <p className="text-sm text-gray-500 line-clamp-3">
                  {asset.description}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  Iterative AI Editing • Chat to refine
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAsNew}
              disabled={isGenerating || isRegenerating || isSaving || currentVersionIndex === 0}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
              data-debug={JSON.stringify({ isGenerating, isRegenerating, isSaving, currentVersionIndex, historyLength: versionHistory.length })}
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save as New
            </button>
            <button
              onClick={handleSave}
              disabled={isGenerating || isRegenerating || isSaving || currentVersionIndex === 0}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
              data-debug={JSON.stringify({ isGenerating, isRegenerating, isSaving, currentVersionIndex, historyLength: versionHistory.length })}
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isGenerating || isRegenerating || isSaving}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Main Content: Three-column layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Version List (15%) */}
          <div className="w-[15%] flex flex-col bg-white border-r border-gray-200">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-600 uppercase">Versions</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingLineage ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {versionHistory.map((version, index) => {
                    const lastEdit = version.editHistory.length > 0
                      ? version.editHistory[version.editHistory.length - 1]
                      : null;

                    return (
                      <button
                        key={version.id}
                        onClick={() => setCurrentVersionIndex(index)}
                        disabled={isGenerating || isRegenerating}
                        className={`w-full text-left p-2 rounded-lg transition-colors disabled:cursor-not-allowed ${
                          index === currentVersionIndex
                            ? 'bg-purple-100 border-2 border-purple-500'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            index === currentVersionIndex ? 'bg-purple-600' : 'bg-gray-300'
                          }`} />
                          <span className={`text-xs font-medium ${
                            index === currentVersionIndex ? 'text-purple-900' : 'text-gray-700'
                          }`}>
                            v{version.version}
                          </span>
                        </div>
                        {index === 0 && (
                          <span className="text-xs text-gray-500 mt-1 block ml-3.5">Original</span>
                        )}
                        {lastEdit && (
                          <div className="mt-1 ml-3.5 space-y-0.5">
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {lastEdit.editPrompt}
                            </p>
                          </div>
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
              {isLoadingLineage ? (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm">Loading version history...</p>
                </div>
              ) : currentAsset ? (
                <div className="relative h-full w-full flex items-center justify-center">
                  <img
                    src={
                      hoveredPreview && hoveredPreview.imageBytes
                        ? `data:${hoveredPreview.mimeType};base64,${hoveredPreview.imageBytes}`
                        : currentAsset.url
                    }
                    alt={hoveredPreview ? getModelDefinition(hoveredPreview.model).name : currentAsset.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />

                  {/* Version Badge Overlay */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {hoveredPreview ? (
                      <div className="px-3 py-1.5 bg-purple-600/90 text-white text-sm rounded-lg font-medium">
                        Previewing: {getModelDefinition(hoveredPreview.model).name}
                      </div>
                    ) : (
                      <>
                        <div className="px-3 py-1.5 bg-black/70 text-white text-sm rounded-lg font-medium">
                          v{currentAsset.version}
                        </div>

                        {/* Show edit prompt for non-original versions */}
                        {currentAsset.version > 1 && currentAsset.editHistory.length > 0 && (
                          <div className="px-3 py-1.5 bg-purple-600/90 text-white text-xs rounded-lg max-w-xs">
                            {currentAsset.editHistory[currentAsset.editHistory.length - 1].editPrompt}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Regenerate Button - only for edited versions */}
                  {currentAsset.version > 1 && currentAsset.editHistory.length > 0 && (
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={handleRegenerate}
                        disabled={isGenerating || isRegenerating || isLoadingLineage || isSaving}
                        className="p-2 bg-white/90 hover:bg-white/100 text-purple-600 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                        title="Generate another variation with the same prompt"
                      >
                        {isRegenerating ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Column: Chat Interface (35%) */}
          <div className="w-[35%] flex flex-col bg-white">
            {/* Model Selection */}
            <div className="border-b border-gray-200 px-3 py-2 bg-gray-50">
              <ModelSelector
                selectedModels={selectedModels}
                onModelsChange={setSelectedModels as any}
              />
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div key={index} className="space-y-2">
                  <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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

                  {/* Inline Results */}
                  {message.results && message.results.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pl-2">
                      {message.results.map((result) => {
                        const modelDef = getModelDefinition(result.model);
                        const isSelected = selectedResult === result.model;
                        return (
                          <button
                            key={result.model}
                            onClick={() => handleSelectCompareResult(result)}
                            onMouseEnter={() => !result.loading && !result.error && setHoveredPreview(result)}
                            onMouseLeave={() => setHoveredPreview(null)}
                            disabled={result.loading || !!result.error}
                            className={`relative rounded-lg overflow-hidden bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group ${
                              isSelected ? 'ring-2 ring-purple-500' : 'hover:ring-2 hover:ring-purple-400'
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
                                  <p className="text-xs text-red-500 text-center">
                                    {(() => {
                                      // Handle string errors
                                      if (typeof result.error === 'string') {
                                        return result.error;
                                      }
                                      // Handle validation error objects {loc, msg, type}
                                      if (result.error && typeof result.error === 'object' && 'msg' in result.error) {
                                        return (result.error as any).msg;
                                      }
                                      // Handle array of validation errors
                                      if (Array.isArray(result.error) && (result.error as any[]).length > 0 && 'msg' in (result.error as any[])[0]) {
                                        return (result.error as any[]).map((e: any) => e.msg).join(', ');
                                      }
                                      // Fallback: stringify the object
                                      return JSON.stringify(result.error);
                                    })()}
                                  </p>
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
                                    <div className="absolute top-2 right-2 bg-purple-600 rounded-full p-1">
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

              {isRegenerating && (
                <div className="flex justify-start">
                  <div className="bg-purple-100 text-purple-900 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <p className="text-sm">Regenerating variation...</p>
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
                  disabled={isGenerating || isRegenerating || isLoadingLineage}
                  autoComplete="off"
                  placeholder="Describe your edit (Enter to send, Shift+Enter for new line)..."
                  rows={1}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 text-sm min-h-[40px] max-h-[120px] overflow-y-auto"
                  style={{ height: 'auto' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isGenerating || isRegenerating || isLoadingLineage}
                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  title="Send message (Cmd+Enter)"
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
                  <span>← → ↑ ↓ Navigate</span>
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
