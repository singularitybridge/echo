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
  Film,
  RefreshCw,
  Image as ImageIcon,
  Volume2,
  Mic,
  MessageSquare,
  Play,
  Pause,
} from 'lucide-react';
import type { StoryDraft, GeneratedScene } from '@/types/story-creation';
import { DIRECTOR_PERSONAS, type DirectorPersona } from '@/types/director-personas';

interface StoryboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: StoryDraft;
  projectId: string;
  onStoryboardGenerated: (frames: StoryboardFrame[]) => void;
  existingFrames?: StoryboardFrame[]; // Pass existing frames to avoid regeneration
}

export interface StoryboardFrame {
  sceneId: string;
  sceneTitle: string;
  frameDescription?: string; // Deprecated - use imagePrompt instead
  imagePrompt: string;
  cameraAngle: string;
  direction?: string; // Acting/performance direction for the scene
  mood?: string; // Deprecated - no longer generated
  keyElements?: string[]; // Deprecated - no longer generated
  speechType: 'voiceover' | 'narration'; // 'voiceover' = character speaking on-screen, 'narration' = off-screen narrator
  voiceoverText?: string; // The spoken text for this scene
  imageUrl?: string;
  imageBlob?: Blob;
  loading?: boolean;
  error?: string;
  // Audio generation
  audioBase64?: string; // Generated TTS audio (base64)
  audioUrl?: string; // Blob URL for playback
  audioLoading?: boolean;
  audioError?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface StoryboardModel {
  id: string;
  name: string;
  description: string;
}

const AVAILABLE_MODELS: StoryboardModel[] = [
  {
    id: 'flux-dev',
    name: 'Flux Dev',
    description: 'High quality cinematic images (8-12s)',
  },
  {
    id: 'flux-context-pro',
    name: 'Flux Context Pro',
    description: 'Best consistency across frames (20-30s)',
  },
  {
    id: 'fal-instant-character',
    name: 'Instant Character',
    description: 'Fast generation (4-6s)',
  },
];

export default function StoryboardModal({
  isOpen,
  onClose,
  story,
  projectId,
  onStoryboardGenerated,
  existingFrames,
}: StoryboardModalProps) {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('flux-dev');
  const [storyboardFrames, setStoryboardFrames] = useState<StoryboardFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get director persona info
  const personaId = story.projectMetadata.personaId as DirectorPersona | undefined;
  const directorInfo = personaId ? DIRECTOR_PERSONAS[personaId] : null;

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

  // Initialize with existing frames or trigger new generation
  useEffect(() => {
    if (!isOpen || messages.length > 0) return;

    // Check if we have existing frames with images
    if (existingFrames && existingFrames.length > 0 && existingFrames.some(f => f.imageUrl)) {
      // Use existing frames - no regeneration needed
      setStoryboardFrames(existingFrames);
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: `Welcome back! Your storyboard for "${story.projectMetadata.title}" is ready. ${existingFrames.length} frames loaded. You can refine any scene or generate audio for voiceovers.`,
        timestamp: Date.now(),
      };
      setMessages([welcomeMessage]);
    } else {
      // Add initial system message and trigger new generation
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: `Welcome! I'll create storyboard frames for your story "${story.projectMetadata.title}". Each frame will serve as the starting image for video generation. Generating frames for ${story.scenes.length} scenes...`,
        timestamp: Date.now(),
      };
      setMessages([welcomeMessage]);

      // Trigger initial generation
      handleInitialGeneration();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setChatInput('');
      setIsGenerating(false);
      setStoryboardFrames([]);
      setSelectedFrame(null);
    }
  }, [isOpen]);

  const handleInitialGeneration = async () => {
    setIsGenerating(true);

    try {
      // Build comprehensive context from story
      const scenesContext = story.scenes.map((scene, index) => `
Scene ${index + 1}: ${scene.title}
- Prompt: ${scene.prompt}
- Camera Angle: ${scene.cameraAngle}
- Duration: ${scene.duration}s
- Voiceover: ${scene.voiceover || 'None'}
`).join('\n');

      const storyContext = `
Story Title: ${story.projectMetadata.title}
Description: ${story.projectMetadata.description}
Character: ${story.projectMetadata.character || 'Various subjects'}
Director Style: ${directorInfo?.name || 'Cinematic'} (${directorInfo?.tagline || 'Professional quality'})
Aspect Ratio: ${story.projectMetadata.aspectRatio || '9:16'}

SCENES:
${scenesContext}
`.trim();

      // Call Agent Hub storyboard designer agent
      const response = await fetch('/api/agent-hub/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: 'storyboard-designer',
          userInput: `Create storyboard frames for each scene in this story:

${storyContext}

Requirements:
- Generate one storyboard frame per scene
- Each frame should capture the ENTIRE SCENE as it would appear in the video
- Include environment, lighting, mood, and any subjects/characters in context
- Optimize prompts for AI image generation (Flux model)
- Match the director's visual style throughout
- For each scene, determine the speechType:
  - "voiceover": Use when the image prompt shows a character speaking/talking (e.g., "woman talking to camera", "close-up of man speaking", "character addressing viewer")
  - "narration": Use when the image prompt does NOT show a character speaking (e.g., wide shots, action scenes, environmental shots, hands doing things)
- Include the voiceoverText from the original scene

Return ONLY valid JSON with storyboardFrames array. Each frame must include:
- sceneId, sceneTitle, imagePrompt, cameraAngle, direction
- speechType: "voiceover" or "narration" based on the visual content
- voiceoverText: the spoken text from the original scene`,
          responseFormat: { type: 'json_object' },
          personaId: personaId, // Pass persona ID for style guide injection
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate storyboard frames');
      }

      const data = await response.json();
      const storyboardData = JSON.parse(data.content);

      if (!storyboardData.storyboardFrames || storyboardData.storyboardFrames.length === 0) {
        throw new Error('No storyboard frames generated');
      }

      // Initialize frames with loading state
      const initialFrames: StoryboardFrame[] = storyboardData.storyboardFrames.map((frame: any) => ({
        ...frame,
        loading: true,
      }));
      setStoryboardFrames(initialFrames);

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Created ${initialFrames.length} storyboard frame prompts. Now generating images...`,
          timestamp: Date.now(),
        },
      ]);

      // Generate images for each frame
      const updatedFrames = await Promise.all(
        initialFrames.map(async (frame: StoryboardFrame) => {
          try {
            const imgResponse = await fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: frame.imagePrompt,
                model: selectedModel,
                aspectRatio: story.projectMetadata.aspectRatio || '9:16',
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
              ...frame,
              imageUrl,
              imageBlob: blob,
              loading: false,
            };
          } catch (error) {
            console.error('Failed to generate image for scene:', frame.sceneTitle, error);
            return {
              ...frame,
              loading: false,
              error: 'Failed to generate image',
            };
          }
        })
      );

      setStoryboardFrames(updatedFrames);

      // Add success message
      const successCount = updatedFrames.filter(f => !f.error).length;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `✓ Generated ${successCount}/${updatedFrames.length} storyboard frames! Click on any frame to view details, or send a message to refine specific scenes.`,
          timestamp: Date.now(),
        },
      ]);
    } catch (error) {
      console.error('Initial generation error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error generating the storyboard. Please try again or send a message with specific requirements.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateFrame = async (frameIndex: number) => {
    const frame = storyboardFrames[frameIndex];
    if (!frame) return;

    // Mark frame as loading
    setStoryboardFrames(prev => prev.map((f, i) =>
      i === frameIndex ? { ...f, loading: true, error: undefined } : f
    ));

    try {
      const imgResponse = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: frame.imagePrompt,
          model: selectedModel,
          aspectRatio: story.projectMetadata.aspectRatio || '9:16',
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

      setStoryboardFrames(prev => prev.map((f, i) =>
        i === frameIndex ? { ...f, imageUrl, imageBlob: blob, loading: false } : f
      ));
    } catch (error) {
      console.error('Failed to regenerate frame:', error);
      setStoryboardFrames(prev => prev.map((f, i) =>
        i === frameIndex ? { ...f, loading: false, error: 'Failed to regenerate' } : f
      ));
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
      // Build context from current storyboard
      const currentFramesContext = storyboardFrames.map((frame, index) => `
Scene ${index + 1}: ${frame.sceneTitle}
- Current prompt: ${frame.imagePrompt}
- Camera: ${frame.cameraAngle}
- Direction: ${frame.direction || 'Not specified'}
`).join('\n');

      // Call Agent Hub storyboard designer agent
      const response = await fetch('/api/agent-hub/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: 'storyboard-designer',
          userInput: `User refinement request: ${userMessage}

Current storyboard:
${currentFramesContext}

Story context:
- Title: ${story.projectMetadata.title}
- Director Style: ${directorInfo?.name || 'Cinematic'}
- Aspect Ratio: ${story.projectMetadata.aspectRatio || '9:16'}

Update the storyboard frames based on the user's request. You can modify prompts, direction, or other visual elements.

Return ONLY valid JSON with storyboardFrames array (include ALL scenes, even unchanged ones).`,
          responseFormat: { type: 'json_object' },
          personaId: personaId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refine storyboard');
      }

      const data = await response.json();
      const storyboardData = JSON.parse(data.content);

      if (!storyboardData.storyboardFrames || storyboardData.storyboardFrames.length === 0) {
        throw new Error('No storyboard frames returned');
      }

      // Identify which frames changed
      const newFrames: StoryboardFrame[] = storyboardData.storyboardFrames.map((newFrame: any, index: number) => {
        const oldFrame = storyboardFrames[index];
        const promptChanged = !oldFrame || oldFrame.imagePrompt !== newFrame.imagePrompt;

        return {
          ...newFrame,
          // Keep existing image if prompt hasn't changed
          imageUrl: promptChanged ? undefined : oldFrame?.imageUrl,
          imageBlob: promptChanged ? undefined : oldFrame?.imageBlob,
          loading: promptChanged,
        };
      });

      setStoryboardFrames(newFrames);

      // Add assistant message
      const changedCount = newFrames.filter(f => f.loading).length;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: changedCount > 0
            ? `Updated ${changedCount} frame(s). Regenerating images...`
            : 'No visual changes needed. The storyboard remains the same.',
          timestamp: Date.now(),
        },
      ]);

      // Generate images for changed frames
      if (changedCount > 0) {
        const updatedFrames = await Promise.all(
          newFrames.map(async (frame: StoryboardFrame) => {
            if (!frame.loading) return frame;

            try {
              const imgResponse = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: frame.imagePrompt,
                  model: selectedModel,
                  aspectRatio: story.projectMetadata.aspectRatio || '9:16',
                }),
              });

              if (!imgResponse.ok) {
                throw new Error('Image generation failed');
              }

              const imgData = await imgResponse.json();

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
                ...frame,
                imageUrl,
                imageBlob: blob,
                loading: false,
              };
            } catch (error) {
              console.error('Failed to generate image:', error);
              return {
                ...frame,
                loading: false,
                error: 'Failed to generate image',
              };
            }
          })
        );

        setStoryboardFrames(updatedFrames);
      }
    } catch (error) {
      console.error('Refinement error:', error);
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

  const handleSave = async () => {
    const validFrames = storyboardFrames.filter(f => f.imageUrl && f.imageBlob);

    if (validFrames.length === 0) {
      alert('No storyboard frames to save');
      return;
    }

    setIsSaving(true);

    try {
      // Upload frames to server
      const uploadPromises = validFrames.map(async (frame, index) => {
        if (!frame.imageBlob) throw new Error('No image blob');

        const formData = new FormData();
        formData.append('file', frame.imageBlob, `storyboard-${frame.sceneId}.png`);
        formData.append('projectId', projectId);
        formData.append('sceneId', frame.sceneId);
        formData.append('index', String(index + 1));
        formData.append('type', 'storyboard');

        const response = await fetch('/api/character-refs/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload storyboard frame');
        }

        const data = await response.json();
        return { ...frame, serverUrl: data.url };
      });

      const savedFrames = await Promise.all(uploadPromises);
      onStoryboardGenerated(savedFrames);

      // Add success message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `✓ Saved ${savedFrames.length} storyboard frame${savedFrames.length > 1 ? 's' : ''} to your project! These will be used as starting images for video generation.`,
          timestamp: Date.now(),
        },
      ]);

      // Close after short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Failed to save storyboard:', error);
      alert('Failed to save storyboard frames. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = (frame: StoryboardFrame) => {
    if (!frame.imageUrl) return;

    const a = document.createElement('a');
    a.href = frame.imageUrl;
    a.download = `storyboard-${frame.sceneId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Generate audio for all frames
  const handleGenerateAllAudio = async () => {
    const framesWithVoiceover = storyboardFrames.filter(f => f.voiceoverText?.trim());
    if (framesWithVoiceover.length === 0) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'No voiceover text found in any scenes. Add voiceover text to generate audio.',
        timestamp: Date.now(),
      }]);
      return;
    }

    setIsGeneratingAudio(true);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `Generating audio for ${framesWithVoiceover.length} scene(s)...`,
      timestamp: Date.now(),
    }]);

    // Mark all frames with voiceover as loading
    setStoryboardFrames(prev => prev.map(f => ({
      ...f,
      audioLoading: !!f.voiceoverText?.trim(),
    })));

    try {
      // Call batch audio generation API
      const scenes = framesWithVoiceover.map(f => ({
        sceneId: f.sceneId,
        text: f.voiceoverText!,
        speechType: f.speechType,
        voiceGender: 'female' as const,
      }));

      const response = await fetch('/api/generate-audio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const data = await response.json();
      const results = data.results as Record<string, { audioBase64: string; mimeType: string } | { error: string }>;

      // Update frames with audio data
      setStoryboardFrames(prev => prev.map(f => {
        const result = results[f.sceneId];
        if (!result) {
          return { ...f, audioLoading: false };
        }

        if ('error' in result) {
          return { ...f, audioLoading: false, audioError: result.error };
        }

        // Convert base64 to blob URL
        const byteCharacters = atob(result.audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.mimeType });
        const audioUrl = URL.createObjectURL(blob);

        return {
          ...f,
          audioBase64: result.audioBase64,
          audioUrl,
          audioLoading: false,
        };
      }));

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✓ Generated audio for ${data.successCount}/${data.totalScenes} scenes! Click the play button on each frame to preview.`,
        timestamp: Date.now(),
      }]);
    } catch (error) {
      console.error('Audio generation error:', error);
      setStoryboardFrames(prev => prev.map(f => ({
        ...f,
        audioLoading: false,
        audioError: f.voiceoverText?.trim() ? 'Generation failed' : undefined,
      })));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, failed to generate audio. Please try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Play/pause audio for a frame
  const handlePlayAudio = (frame: StoryboardFrame) => {
    if (!frame.audioUrl) return;

    if (playingAudio === frame.sceneId) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudio(null);
    } else {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // Play new audio
      const audio = new Audio(frame.audioUrl);
      audio.onended = () => {
        setPlayingAudio(null);
        audioRef.current = null;
      };
      audio.play();
      audioRef.current = audio;
      setPlayingAudio(frame.sceneId);
    }
  };

  if (!isOpen) return null;

  const selectedFrameData = selectedFrame
    ? storyboardFrames.find(f => f.sceneId === selectedFrame)
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Film className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Storyboard</h2>
              <p className="text-sm text-gray-500">
                {story.scenes.length} scenes
              </p>
            </div>
            {/* Director Badge */}
            {directorInfo && (
              <div className="flex items-center gap-2 bg-white rounded-md px-2 py-1 border border-gray-200 ml-4">
                <img
                  src={directorInfo.avatar}
                  alt={directorInfo.directorName}
                  className="w-6 h-6 rounded-full object-cover"
                />
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 leading-tight">Directed by</span>
                  <span className="text-xs font-medium text-gray-900 leading-tight">
                    {directorInfo.directorName}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateAllAudio}
              disabled={isGenerating || isGeneratingAudio || storyboardFrames.filter(f => f.voiceoverText?.trim()).length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Generate voiceover/narration audio for all scenes"
            >
              {isGeneratingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
              Generate Audio
            </button>
            <button
              onClick={handleSave}
              disabled={isGenerating || isSaving || storyboardFrames.filter(f => f.imageUrl).length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Storyboard
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

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Storyboard Grid (65%) */}
          <div className="w-[65%] bg-gray-50 flex flex-col border-r border-gray-200">
            {storyboardFrames.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Film className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                      <p className="text-gray-500 text-lg font-medium">
                        Generating storyboard frames...
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        Creating visuals for {story.scenes.length} scenes
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-500 text-lg font-medium mb-2">
                        No storyboard frames yet
                      </p>
                      <p className="text-gray-400 text-sm">
                        Waiting for generation...
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-4">
                  {storyboardFrames.map((frame, index) => (
                    <div
                      key={frame.sceneId}
                      className={`bg-white rounded-lg border overflow-hidden transition-all cursor-pointer ${
                        selectedFrame === frame.sceneId
                          ? 'ring-2 ring-indigo-500 border-indigo-500'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                      onClick={() => setSelectedFrame(frame.sceneId === selectedFrame ? null : frame.sceneId)}
                    >
                      {/* Scene Header */}
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {frame.sceneTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {frame.imageUrl && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRegenerateFrame(index);
                                }}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title="Regenerate"
                                disabled={frame.loading}
                              >
                                <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${frame.loading ? 'animate-spin' : ''}`} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(frame);
                                }}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Frame Image */}
                      <div className="relative" style={{ aspectRatio: (story.projectMetadata.aspectRatio as string) === '16:9' ? '16/9' : (story.projectMetadata.aspectRatio as string) === '1:1' ? '1/1' : '9/16' }}>
                        {frame.loading && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                            <p className="text-xs text-gray-500">Generating...</p>
                          </div>
                        )}
                        {frame.error && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 p-4">
                            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                            <p className="text-xs text-red-500 text-center">{frame.error}</p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRegenerateFrame(index);
                              }}
                              className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
                            >
                              Try again
                            </button>
                          </div>
                        )}
                        {!frame.loading && !frame.error && frame.imageUrl && (
                          <img
                            src={frame.imageUrl}
                            alt={frame.sceneTitle}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {!frame.loading && !frame.error && !frame.imageUrl && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                            <ImageIcon className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>

                      {/* Scene Info */}
                      <div className="px-3 py-2 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">Type:</span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              frame.speechType === 'voiceover'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {frame.speechType === 'voiceover' ? (
                                <>
                                  <Mic className="w-2.5 h-2.5" />
                                  Voiceover
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  Narration
                                </>
                              )}
                            </span>
                          </div>
                          {/* Audio controls */}
                          {frame.voiceoverText && (
                            <div className="flex items-center gap-1">
                              {frame.audioLoading ? (
                                <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin" />
                              ) : frame.audioUrl ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlayAudio(frame);
                                  }}
                                  className={`p-1 rounded transition-colors ${
                                    playingAudio === frame.sceneId
                                      ? 'bg-purple-100 text-purple-600'
                                      : 'hover:bg-gray-200 text-gray-500'
                                  }`}
                                  title={playingAudio === frame.sceneId ? 'Stop' : 'Play audio'}
                                >
                                  {playingAudio === frame.sceneId ? (
                                    <Pause className="w-3.5 h-3.5" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : frame.audioError ? (
                                <span className="text-red-500 text-[10px]">Error</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                        {frame.voiceoverText && (
                          <div className="mt-1 pt-1 border-t border-gray-100">
                            <span className="text-gray-400">Speech:</span>
                            <p className="text-gray-600 italic line-clamp-2 mt-0.5">"{frame.voiceoverText}"</p>
                          </div>
                        )}
                        {frame.direction && (
                          <div className="mt-1 pt-1 border-t border-gray-100">
                            <span className="text-gray-400">Direction:</span>
                            <p className="text-gray-600 text-xs line-clamp-2 mt-0.5">{frame.direction}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Details Panel + Chat (35%) */}
          <div className="w-[35%] flex flex-col bg-white">
            {/* Model Selection */}
            <div className="border-b border-gray-200 p-4 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 text-sm"
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Frame Details */}
            {selectedFrameData && (
              <div className="border-b border-gray-200 p-4 bg-indigo-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{selectedFrameData.sceneTitle}</h3>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedFrameData.speechType === 'voiceover'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {selectedFrameData.speechType === 'voiceover' ? (
                      <>
                        <Mic className="w-3 h-3" />
                        Voiceover
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-3 h-3" />
                        Narration
                      </>
                    )}
                  </span>
                </div>
                {selectedFrameData.voiceoverText && (
                  <div className="mb-2 p-2 bg-white/50 rounded border border-indigo-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">Speech Text:</p>
                    <p className="text-xs text-gray-700 italic">"{selectedFrameData.voiceoverText}"</p>
                    {selectedFrameData.audioUrl && (
                      <button
                        onClick={() => handlePlayAudio(selectedFrameData)}
                        className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          playingAudio === selectedFrameData.sceneId
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                        }`}
                      >
                        {playingAudio === selectedFrameData.sceneId ? (
                          <>
                            <Pause className="w-3 h-3" />
                            Stop Audio
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            Play Audio
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
                {selectedFrameData.direction && (
                  <div className="p-2 bg-white/50 rounded border border-indigo-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">Direction:</p>
                    <p className="text-xs text-gray-700">{selectedFrameData.direction}</p>
                  </div>
                )}
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
              ))}

              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-900 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <p className="text-sm">Working on storyboard...</p>
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
                  placeholder="Refine the storyboard (e.g., 'Make scene 2 more dramatic', 'Add warmer lighting')..."
                  rows={1}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 text-sm min-h-[40px] max-h-[120px] overflow-y-auto"
                  style={{ height: 'auto' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isGenerating}
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
                <span>Click frames to view details</span>
                <span>Enter to send</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
