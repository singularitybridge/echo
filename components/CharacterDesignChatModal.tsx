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
  Download,
} from 'lucide-react';
import type { StoryDraft } from '@/types/story-creation';

interface CharacterDesignChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: StoryDraft;
  projectId: string;
  onCharacterRefsGenerated: (refUrls: string[]) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  designOptions?: DesignOption[];
}

interface DesignOption {
  name: string;
  concept: string;
  prompt: string;
  imageUrl?: string;
  imageBlob?: Blob;
  loading?: boolean;
  error?: string;
}

interface CharacterDesignModel {
  id: string;
  name: string;
  description: string;
}

const AVAILABLE_MODELS: CharacterDesignModel[] = [
  {
    id: 'fal-instant-character',
    name: 'Instant Character',
    description: 'Fast character consistency (4-6s)',
  },
  {
    id: 'flux-context-pro',
    name: 'Flux Context Pro',
    description: 'Industry-leading 99.7% consistency (20-30s)',
  },
  {
    id: 'flux-dev',
    name: 'Flux Dev',
    description: 'High quality general purpose (8-12s)',
  },
];

export default function CharacterDesignChatModal({
  isOpen,
  onClose,
  story,
  projectId,
  onCharacterRefsGenerated,
}: CharacterDesignChatModalProps) {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('flux-context-pro');
  const [allDesigns, setAllDesigns] = useState<DesignOption[]>([]);
  const [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(new Set());
  const [hoveredPreview, setHoveredPreview] = useState<DesignOption | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Refs
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

  // Initialize with first generation on mount
  useEffect(() => {
    if (!isOpen || messages.length > 0) return;

    // Add initial system message
    const welcomeMessage: ChatMessage = {
      role: 'assistant',
      content: 'Welcome! I\'ll help you design character references for your story. Let me generate 3 initial design options based on your story...',
      timestamp: Date.now(),
    };
    setMessages([welcomeMessage]);

    // Trigger initial generation
    handleInitialGeneration();
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setChatInput('');
      setIsGenerating(false);
      setAllDesigns([]);
      setSelectedDesigns(new Set());
      setHoveredPreview(null);
    }
  }, [isOpen]);

  const handleInitialGeneration = async () => {
    setIsGenerating(true);

    try {
      // Build context from story
      const storyContext = `
Story Title: ${story.projectMetadata.title}
Description: ${story.projectMetadata.description}
Story Type: ${story.projectMetadata.type || 'short'}
Character: ${story.projectMetadata.character || 'Main character'}

First Scene: ${story.scenes[0]?.title || ''}
${story.scenes[0]?.prompt || ''}
`.trim();

      // Call Agent Hub character design agent with persona guide
      const personaId = story.projectMetadata.personaId;
      const response = await fetch('/api/agent-hub/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: 'character-design-expert',
          userInput: `Create 3 creative character design options for this story:

${storyContext}

Requirements:
- Aspect Ratio: 9:16 portrait
- Create 3 MEANINGFULLY DIFFERENT design variations
- Each design should have a complete, detailed prompt ready for AI image generation
- Focus on the character's visual appearance, not the scene/environment

Return ONLY valid JSON with designOptions array.`,
          responseFormat: { type: 'json_object' },
          personaId, // Pass persona ID for style guide injection
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate character designs');
      }

      const data = await response.json();
      const designData = JSON.parse(data.content);

      if (!designData.designOptions || designData.designOptions.length === 0) {
        throw new Error('No design options generated');
      }

      // Add assistant message with design options
      const designMessage: ChatMessage = {
        role: 'assistant',
        content: `I've created ${designData.designOptions.length} character design options for you. Now generating images...`,
        timestamp: Date.now(),
        designOptions: designData.designOptions.map((opt: any) => ({
          ...opt,
          loading: true,
        })),
      };
      setMessages((prev) => [...prev, designMessage]);

      // Generate images for each design
      const updatedDesigns = await Promise.all(
        designData.designOptions.map(async (design: DesignOption) => {
          try {
            const imgResponse = await fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: design.prompt,
                model: selectedModel,
                aspectRatio: '9:16',
              }),
            });

            if (!imgResponse.ok) {
              throw new Error('Image generation failed');
            }

            const imgData = await imgResponse.json();

            // Convert base64 to blob
            const base64Data = imgData.imageBytes;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: imgData.mimeType });
            const imageUrl = URL.createObjectURL(blob);

            return {
              ...design,
              imageUrl,
              imageBlob: blob,
              loading: false,
            };
          } catch (error) {
            console.error('Failed to generate image for design:', design.name, error);
            return {
              ...design,
              loading: false,
              error: 'Failed to generate image',
            };
          }
        })
      );

      // Update designs in all designs array
      setAllDesigns((prev) => [...prev, ...updatedDesigns]);

      // Update message with loaded images
      setMessages((prev) =>
        prev.map((msg) =>
          msg.designOptions
            ? { ...msg, designOptions: updatedDesigns, content: `Here are ${updatedDesigns.length} character design options. Click to select your favorites, or send a message to refine them!` }
            : msg
        )
      );
    } catch (error) {
      console.error('Initial generation error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error generating the initial designs. Please try sending a message with your requirements.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isGenerating) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsGenerating(true);

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      },
    ]);

    try {
      // Build context from story + conversation history
      const storyContext = `
Story Title: ${story.projectMetadata.title}
Description: ${story.projectMetadata.description}
Character: ${story.projectMetadata.character || 'Main character'}
`.trim();

      const conversationContext = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n');

      // Call Agent Hub character design agent with persona guide
      const personaId = story.projectMetadata.personaId;
      const response = await fetch('/api/agent-hub/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: 'character-design-expert',
          userInput: `User's refinement request: ${userMessage}

Story Context:
${storyContext}

Previous conversation:
${conversationContext}

Create 3 new character design variations based on the user's request.
Requirements:
- Aspect Ratio: 9:16 portrait
- Create 3 MEANINGFULLY DIFFERENT design variations
- Each design should have a complete, detailed prompt ready for AI image generation

Return ONLY valid JSON with designOptions array.`,
          responseFormat: { type: 'json_object' },
          personaId, // Pass persona ID for style guide injection
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate refined designs');
      }

      const data = await response.json();
      const designData = JSON.parse(data.content);

      if (!designData.designOptions || designData.designOptions.length === 0) {
        throw new Error('No design options generated');
      }

      // Add assistant message
      const designMessage: ChatMessage = {
        role: 'assistant',
        content: `I've created ${designData.designOptions.length} new design variations. Generating images...`,
        timestamp: Date.now(),
        designOptions: designData.designOptions.map((opt: any) => ({
          ...opt,
          loading: true,
        })),
      };
      setMessages((prev) => [...prev, designMessage]);

      // Generate images for each design
      const updatedDesigns = await Promise.all(
        designData.designOptions.map(async (design: DesignOption) => {
          try {
            const imgResponse = await fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: design.prompt,
                model: selectedModel,
                aspectRatio: '9:16',
              }),
            });

            if (!imgResponse.ok) {
              throw new Error('Image generation failed');
            }

            const imgData = await imgResponse.json();

            // Convert base64 to blob
            const base64Data = imgData.imageBytes;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: imgData.mimeType });
            const imageUrl = URL.createObjectURL(blob);

            return {
              ...design,
              imageUrl,
              imageBlob: blob,
              loading: false,
            };
          } catch (error) {
            console.error('Failed to generate image for design:', design.name, error);
            return {
              ...design,
              loading: false,
              error: 'Failed to generate image',
            };
          }
        })
      );

      // Update designs in all designs array
      setAllDesigns((prev) => [...prev, ...updatedDesigns]);

      // Update message with loaded images
      setMessages((prev) =>
        prev.map((msg) =>
          msg.designOptions
            ? { ...msg, designOptions: updatedDesigns, content: `Here are ${updatedDesigns.length} new variations. Click to select your favorites!` }
            : msg
        )
      );
    } catch (error) {
      console.error('Generation error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSelection = (designName: string) => {
    setSelectedDesigns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(designName)) {
        newSet.delete(designName);
      } else {
        // Limit to 3 selections
        if (newSet.size >= 3) {
          // Remove oldest selection
          const firstItem = newSet.values().next().value;
          newSet.delete(firstItem);
        }
        newSet.add(designName);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    const selectedDesignObjects = allDesigns.filter((d) =>
      selectedDesigns.has(d.name)
    );

    if (selectedDesignObjects.length === 0) {
      alert('Please select at least one character design');
      return;
    }

    setIsSaving(true);

    try {
      // Upload blobs to server
      const uploadPromises = selectedDesignObjects.map(async (design, index) => {
        if (!design.imageBlob) throw new Error('No image blob');

        const formData = new FormData();
        formData.append('file', design.imageBlob, `character-ref-${index + 1}.png`);
        formData.append('projectId', projectId);
        formData.append('index', String(index + 1));

        const response = await fetch('/api/character-refs/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload character reference');
        }

        const data = await response.json();
        return data.url;
      });

      const refUrls = await Promise.all(uploadPromises);
      onCharacterRefsGenerated(refUrls);

      // Add success message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `✓ Saved ${refUrls.length} character reference${refUrls.length > 1 ? 's' : ''} to your project!`,
          timestamp: Date.now(),
        },
      ]);

      // Close after short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Failed to save character references:', error);
      alert('Failed to save character references. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = (design: DesignOption) => {
    if (!design.imageUrl) return;

    const a = document.createElement('a');
    a.href = design.imageUrl;
    a.download = `${design.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Character Design</h2>
              <p className="text-sm text-gray-500">
                Chat to create and refine character references
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isGenerating || isSaving || selectedDesigns.size === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save Selected ({selectedDesigns.size})
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

        {/* Main Content: 60/40 Split Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Image Gallery (60%) */}
          <div className="w-[60%] bg-gray-50 flex flex-col border-r border-gray-200">
            {allDesigns.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-2" />
                      <p className="text-gray-500 text-lg font-medium">
                        Generating character designs...
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-500 text-lg font-medium mb-2">
                        No designs generated yet
                      </p>
                      <p className="text-gray-400 text-sm">
                        Waiting for initial generation...
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-y-auto">
                {allDesigns.map((design, index) => {
                  const isSelected = selectedDesigns.has(design.name);
                  return (
                    <div
                      key={`${design.name}-${index}`}
                      className="relative group"
                    >
                      <button
                        onClick={() => !design.loading && !design.error && toggleSelection(design.name)}
                        onMouseEnter={() => !design.loading && !design.error && setHoveredPreview(design)}
                        onMouseLeave={() => setHoveredPreview(null)}
                        disabled={design.loading || !!design.error}
                        className={`relative w-full rounded-lg overflow-hidden bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSelected ? 'ring-2 ring-purple-500 scale-105' : 'hover:ring-2 hover:ring-purple-400'
                        }`}
                        style={{ aspectRatio: '9/16' }}
                      >
                        {design.loading && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-2" />
                            <p className="text-xs text-gray-500">{design.name}</p>
                          </div>
                        )}
                        {design.error && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 p-4">
                            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                            <p className="text-xs text-red-500 text-center">{design.error}</p>
                          </div>
                        )}
                        {!design.loading && !design.error && design.imageUrl && (
                          <>
                            <img
                              src={design.imageUrl}
                              alt={design.name}
                              className="w-full h-full object-cover"
                            />

                            {/* Selected Checkmark */}
                            {isSelected && (
                              <div className="absolute top-2 right-2 bg-purple-600 rounded-full p-1.5 shadow-lg">
                                <Check className="w-4 h-4 text-white" strokeWidth={3} />
                              </div>
                            )}

                            {/* Download Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(design);
                              }}
                              className="absolute bottom-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Download"
                            >
                              <Download className="w-4 h-4 text-gray-700" />
                            </button>

                            {/* Design Name Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                              <p className="text-white text-xs font-medium truncate">{design.name}</p>
                            </div>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Chat Panel (40%) */}
          <div className="w-[40%] flex flex-col bg-white">
            {/* Model Selection */}
            <div className="border-b border-gray-200 p-4 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 text-sm"
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
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

                  {/* Inline Design Previews */}
                  {message.designOptions && message.designOptions.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 pl-2">
                      {message.designOptions.map((design, designIndex) => {
                        const isSelected = selectedDesigns.has(design.name);
                        return (
                          <button
                            key={`${design.name}-preview-${designIndex}`}
                            onClick={() => !design.loading && !design.error && toggleSelection(design.name)}
                            disabled={design.loading || !!design.error}
                            className={`relative rounded-lg overflow-hidden bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group ${
                              isSelected ? 'ring-2 ring-purple-500' : 'hover:ring-2 hover:ring-purple-400'
                            }`}
                          >
                            <div className="relative aspect-square bg-gray-50">
                              {design.loading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <Loader2 className="w-4 h-4 animate-spin text-purple-600 mb-1" />
                                </div>
                              )}
                              {design.error && (
                                <div className="absolute inset-0 flex items-center justify-center p-1">
                                  <AlertCircle className="w-4 h-4 text-red-400" />
                                </div>
                              )}
                              {!design.loading && !design.error && design.imageUrl && (
                                <>
                                  <img
                                    src={design.imageUrl}
                                    alt={design.name}
                                    className="w-full h-full object-cover"
                                  />
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 bg-purple-600 rounded-full p-0.5">
                                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                    </div>
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
                      <p className="text-sm">Generating designs...</p>
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
                  disabled={isGenerating}
                  placeholder="Refine the designs (e.g., 'Make them more futuristic', 'Add cyberpunk elements')..."
                  rows={1}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 text-sm min-h-[40px] max-h-[120px] overflow-y-auto"
                  style={{ height: 'auto' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isGenerating}
                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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
                <span>Click images to select (max 3)</span>
                <span>Enter to send</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
