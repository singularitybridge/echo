/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Loader2, Film, CheckCircle2, Settings, Settings2, MessageSquare, AlertCircle, Search, Copy, Check, ArrowLeft, ArrowRight, X, Image as ImageIcon, Download, ImagePlus, HelpCircle, Paperclip, Radio, Trash2, FileText, Edit3, Sparkles, Edit2, ExternalLink, Camera, Mic, Clapperboard, ChevronDown, ChevronUp } from 'lucide-react';
import { generateVideo, GeneratedVideo } from '../services/videoService';
import { GeneratedImage, generateImage } from '../services/imageService';
import { VeoModel, AspectRatio, Resolution } from '../types';
import { evaluateVideo } from '../services/evaluationService.agentHub';
import { extractFirstFrame, extractLastFrame } from '../services/frameExtractionService';
import { CostTracker } from './CostTracker';
import { videoStorage } from '../services/videoStorage.server';
import { evaluationStorage } from '../services/evaluationStorage.server';
import { projectStorage } from '../services/projectStorage.server';
import { frameStorage } from '../services/frameStorage.server';
import { Project, Scene, GenerationSettings, SceneAssetAttachment } from '../types/project';
import CharacterDesignChatModal from './CharacterDesignChatModal';
import { ReferenceSelectionModal } from './ReferenceSelectionModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { PlaybackBar } from './PlaybackBar';
import AssetPickerModal from './assets/AssetPickerModal';
import EditAssetModal from './assets/EditAssetModal';
import { StartFrameEditorModal } from './StartFrameEditorModal';
import { AssetLoader } from '../utils/assetLoader';
import type { Asset } from '@/types/asset';
import type { VideoGenerationModel, VideoGenerationResult } from '@/types/ai-models';
import VideoResultSelectionModal from './VideoResultSelectionModal';
import { getAllVideoGenerationModels } from '@/lib/ai-models';

interface SceneManagerProps {
  projectId: string;
}

const SceneManager: React.FC<SceneManagerProps> = ({ projectId }) => {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [generatingSceneIds, setGeneratingSceneIds] = useState<Set<string>>(new Set());
  const [characterRefs, setCharacterRefs] = useState<GeneratedImage[]>([]);
  const [combinedRefs, setCombinedRefs] = useState<GeneratedImage[]>([]); // Assets + character refs
  const [error, setError] = useState<{
    message: string;
    type?: string;
    input?: string;
    url?: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [evaluatingSceneIds, setEvaluatingSceneIds] = useState<Set<string>>(new Set());
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [evaluationExpanded, setEvaluationExpanded] = useState<boolean>(true);
  const [showRefsModal, setShowRefsModal] = useState<boolean>(false);
  const [showRefSelectModal, setShowRefSelectModal] = useState<boolean>(false);
  const [showProjectSettings, setShowProjectSettings] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showAssetPicker, setShowAssetPicker] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showScriptPreview, setShowScriptPreview] = useState<boolean>(false);
  const [showEditAssetModal, setShowEditAssetModal] = useState<boolean>(false);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
  const [showStartFrameEditor, setShowStartFrameEditor] = useState<boolean>(false);
  const [startFrameEditorMode, setStartFrameEditorMode] = useState<'generate' | 'edit'>('generate');

  // Right panel view toggle
  const [rightPanelView, setRightPanelView] = useState<'details' | 'chat' | 'analysis'>('details');

  // Chat state for script editing (story-level)
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant'; content: string; timestamp: number}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Chat state for shot editing (scene-level)
  const [shotMessages, setShotMessages] = useState<Array<{role: 'user' | 'assistant'; content: string; timestamp: number}>>([]);
  const [shotChatInput, setShotChatInput] = useState('');
  const [isEditingShot, setIsEditingShot] = useState(false);
  const shotChatEndRef = useRef<HTMLDivElement>(null);

  // Playback controls
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPlayingAll, setIsPlayingAll] = useState<boolean>(false);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Default generation settings (aspect ratio is now project-level)
  const [currentSettings, setCurrentSettings] = useState<Omit<GenerationSettings, 'aspectRatio'>>({
    model: VeoModel.VEO,
    resolution: Resolution.P720,
    isLooping: false,
  });

  // Multi-model video generation state
  const [selectedVideoModels, setSelectedVideoModels] = useState<VideoGenerationModel[]>(['veo-3.1']);
  const [videoResults, setVideoResults] = useState<VideoGenerationResult[]>([]);
  const [showVideoResultModal, setShowVideoResultModal] = useState<boolean>(false);

  // Load OpenAI API key from environment or localStorage
  useEffect(() => {
    // First try environment variable, then localStorage
    const envKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const savedKey = localStorage.getItem('openai_api_key');

    if (envKey) {
      setOpenaiApiKey(envKey);
    } else if (savedKey) {
      setOpenaiApiKey(savedKey);
    }
  }, []);

  // Auto-scroll chat to latest message (story-level)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages]);

  // Auto-scroll shot chat to latest message (scene-level)
  useEffect(() => {
    shotChatEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [shotMessages]);

  // Edit story using simple POST request (same as CreateStoryModal)
  const editStory = async (editRequest: string) => {
    if (!project) return;

    setIsRefining(true);

    // Add user message to chat
    setMessages(prev => [...prev, {role: 'user', content: editRequest, timestamp: Date.now()}]);

    try {
      // Convert Project to StoryDraft format for the API
      const storyDraft = {
        projectMetadata: {
          id: project.id,
          title: project.title,
          description: project.description,
          type: project.type,
          character: project.character,
        },
        config: {
          aspectRatio: project.aspectRatio,
          defaultModel: project.defaultModel,
          defaultResolution: project.defaultResolution,
        },
        scenes: project.scenes,
      };

      const response = await fetch('/api/story/edit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          storyDraft,
          editRequest,
        }),
      });

      if (!response.ok) {
        throw new Error(`Edit failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Update project with edited scenes
      const updatedProject = {
        ...project,
        title: result.updatedStory.projectMetadata.title,
        description: result.updatedStory.projectMetadata.description,
        character: result.updatedStory.projectMetadata.character,
        scenes: result.updatedStory.scenes,
      };

      setProject(updatedProject);

      // Save to server
      await projectStorage.saveProject(updatedProject);

      // Add assistant response to chat
      setMessages(prev => [...prev, {role: 'assistant', content: result.response, timestamp: Date.now()}]);

      console.log('[SceneManager] Edit successful:', result.changesSummary);
    } catch (error) {
      console.error('[SceneManager] Edit error:', error);

      // Provide more specific error messages
      let errorMessage = 'Sorry, I encountered an error while editing the story. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Too Many Requests')) {
          errorMessage = 'The AI service is currently experiencing high demand. Please wait a moment and try again. (API quota exceeded)';
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
          errorMessage = 'The editing service encountered an error. Please try again in a moment.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'The request took too long. Please try a simpler edit or try again.';
        }
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: errorMessage,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsRefining(false);
    }
  };

  // Edit shot (scene-level editing) using AI agent
  const editShot = async (editRequest: string) => {
    if (!project || !selectedSceneId) return;

    const selectedScene = scenes.find(s => s.id === selectedSceneId);
    if (!selectedScene) return;

    setIsEditingShot(true);

    // Add user message to shot chat
    setShotMessages(prev => [...prev, {role: 'user', content: editRequest, timestamp: Date.now()}]);

    try {
      // Prepare shot editing request with current shot details
      const shotEditRequest = {
        storyDraft: {
          projectMetadata: {
            id: project.id,
            title: project.title,
            description: project.description,
            type: project.type,
            character: project.character,
          },
          config: {
            aspectRatio: project.aspectRatio,
            defaultModel: project.defaultModel,
            defaultResolution: project.defaultResolution,
          },
          scenes: project.scenes,
        },
        currentShot: {
          id: selectedScene.id,
          title: selectedScene.title,
          duration: selectedScene.duration,
          prompt: selectedScene.prompt,
          cameraAngle: selectedScene.cameraAngle,
          voiceover: selectedScene.voiceover,
        },
        editRequest,
      };

      const response = await fetch('/api/story/edit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(shotEditRequest),
      });

      if (!response.ok) {
        throw new Error(`Shot edit failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Update project with edited scene
      const updatedProject = {
        ...project,
        scenes: result.updatedStory.scenes,
      };

      setProject(updatedProject);

      // Save to server
      await projectStorage.saveProject(updatedProject);

      // Add assistant response to shot chat
      setShotMessages(prev => [...prev, {role: 'assistant', content: result.response, timestamp: Date.now()}]);

      console.log('[SceneManager] Shot edit successful:', result.changesSummary);
    } catch (error) {
      console.error('[SceneManager] Shot edit error:', error);

      // Provide error message
      let errorMessage = 'Sorry, I encountered an error while editing the shot. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Too Many Requests')) {
          errorMessage = 'The AI service is currently experiencing high demand. Please wait a moment and try again.';
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
          errorMessage = 'The editing service encountered an error. Please try again in a moment.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'The request took too long. Please try a simpler edit or try again.';
        }
      }

      setShotMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: errorMessage,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsEditingShot(false);
    }
  };

  // Load the specific project from API (supports both new story storage and legacy projects)
  useEffect(() => {
    const loadProject = async () => {
      try {
        // Try new story storage API first
        const storyResponse = await fetch(`/api/stories/${projectId}`);

        if (storyResponse.ok) {
          const story = await storyResponse.json();

          // Convert story format to Project format for UI compatibility
          const projectData: Project = {
            id: story.metadata.id,
            title: story.metadata.title,
            description: story.metadata.description,
            type: story.metadata.type,
            character: story.metadata.character,
            aspectRatio: story.config.aspectRatio,
            defaultModel: story.config.defaultModel,
            defaultResolution: story.config.defaultResolution,
            scenes: story.script.scenes,
            createdAt: story.metadata.createdAt,
            updatedAt: story.metadata.updatedAt,
            tags: story.metadata.tags || [],
            generationMetadata: story.metadata.generationMetadata,
            deletedStoryStorageAssets: story.script.deletedStoryStorageAssets || [],
          };

          setProject(projectData);
          setSelectedSceneId(projectData.scenes[0]?.id);
          return;
        }

        // Fallback to legacy API for old projects
        const legacyResponse = await fetch('/api/projects');
        if (!legacyResponse.ok) {
          setError(`Failed to load projects`);
          return;
        }

        const data = await legacyResponse.json();
        const projectData = data.projects.find((p: Project) => p.id === projectId);

        if (!projectData) {
          setError(`Project ${projectId} not found`);
          return;
        }

        setProject(projectData);
        setSelectedSceneId(projectData.scenes[0]?.id);
      } catch (err) {
        console.error(`Failed to load project ${projectId}:`, err);
        setError(`Failed to load project ${projectId}`);
      }
    };

    loadProject();
  }, [projectId]);

  // Auto-load character reference images (per-project and aspect ratio)
  useEffect(() => {
    if (!projectId || !project) return;

    const loadCharacterRefs = async () => {
      const aspectRatio = (project.aspectRatio ?? AspectRatio.PORTRAIT) === AspectRatio.PORTRAIT ? '9:16' : '16:9';

      // Sync both story storage and legacy refs to database (so they appear in asset library)
      // Pass deletedStoryStorageAssets list to prevent re-importing user-deleted assets
      await Promise.all([
        AssetLoader.syncStoryStorageToDatabase(
          projectId,
          aspectRatio,
          project.deletedStoryStorageAssets || []
        ),
        AssetLoader.syncLegacyRefsToDatabase(projectId, aspectRatio),
      ]);

      // Load from unified asset database first, then fall back to story storage and legacy
      const dbAssets = await AssetLoader.loadProjectAssets(projectId);
      const dbRefs = AssetLoader.assetsToAssetReferences(dbAssets);

      // Only load story storage and legacy if no database assets
      let allRefs = dbRefs;
      if (dbRefs.length === 0) {
        const storyStorageRefs = await AssetLoader.loadStoryStorageCharacterRefs(projectId);
        const legacyRefs = await AssetLoader.loadLegacyCharacterRefs(projectId, aspectRatio);
        allRefs = [...storyStorageRefs, ...legacyRefs];
      }

      // Convert to full GeneratedImage format with blob data for video generation
      const refs: GeneratedImage[] = [];
      for (const ref of allRefs) {
        try {
          const response = await fetch(ref.objectUrl);
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

            refs.push({
              imageBytes,
              mimeType: 'image/png',
              objectUrl,
              blob,
              assetId: ref.id, // Preserve asset ID for thumbnail matching
            });
          }
        } catch (err) {
          console.log(`Failed to load ref: ${ref.objectUrl}`, err);
        }
      }

      setCharacterRefs(refs);
      const source = dbRefs.length > 0 ? 'database' : 'story storage/legacy';
      console.log(`Loaded ${refs.length} ${aspectRatio} character reference images from ${source}`);
    };

    loadCharacterRefs();
  }, [projectId, project?.aspectRatio]);

  // Load combined references (assets + character refs) when scene changes
  useEffect(() => {
    const loadCombinedRefs = async () => {
      if (!project || !selectedSceneId) {
        setCombinedRefs(characterRefs);
        return;
      }

      const selectedScene = project.scenes.find(s => s.id === selectedSceneId);
      if (!selectedScene) {
        setCombinedRefs(characterRefs);
        return;
      }

      // Load ALL project assets for reference picker (not just attached ones)
      // This allows users to select any character variation/pose as the starting frame
      const allProjectAssets = await AssetLoader.loadProjectAssets(project.id);
      const assetGeneratedImages = AssetLoader.assetsToAssetReferences(allProjectAssets);

      // Convert AssetLoader GeneratedImage format to full format with blob data for video generation
      const assetRefs: GeneratedImage[] = [];
      for (const assetImg of assetGeneratedImages) {
        try {
          const response = await fetch(assetImg.objectUrl);
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

            assetRefs.push({
              imageBytes,
              mimeType: blob.type || 'image/png',
              objectUrl,
              blob,
              assetId: assetImg.id, // Preserve asset ID for thumbnail matching
            });
          }
        } catch (err) {
          console.log(`Failed to load asset ref: ${assetImg.objectUrl}`, err);
        }
      }

      // Combine all project assets (priority) with legacy character refs (fallback)
      const combined = assetRefs.length > 0 ? assetRefs : characterRefs;
      setCombinedRefs(combined);
      console.log(`Available assets for scene "${selectedScene.title}": ${assetRefs.length} project assets + ${characterRefs.length} legacy refs = ${combined.length} total`);
    };

    loadCombinedRefs();
  }, [project, selectedSceneId, characterRefs]);

  // Note: Project data persistence removed from localStorage due to quota limits.
  // Videos and evaluations are now stored server-side via API routes.
  // Project metadata is loaded from /data/*.json files.

  // Auto-save project to server when it changes (debounced)
  useEffect(() => {
    if (!project) return;

    const timeoutId = setTimeout(async () => {
      try {
        // Save project using project storage service
        await projectStorage.saveProject(project);
        console.log('Project auto-saved:', project.id);
      } catch (error) {
        console.error('Failed to auto-save project:', error);
      }
    }, 1000); // Debounce: save 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [project]);

  // Load videos from server when project loads
  useEffect(() => {
    if (!project) return;

    const loadVideos = async () => {
      try {
        const videos = await videoStorage.getProjectVideos(projectId);

        setProject((prevProject) => {
          if (!prevProject) return prevProject;

          return {
            ...prevProject,
            scenes: prevProject.scenes.map((scene) => {
              const url = videos.get(scene.id);
              if (url) {
                return {
                  ...scene,
                  videoUrl: url,
                  generated: true,
                };
              }
              return scene;
            }),
          };
        });
      } catch (error) {
        console.error('Failed to load videos from server:', error);
      }
    };

    loadVideos();
  }, [project?.id, projectId]);

  // Load evaluations from server when project loads
  useEffect(() => {
    if (!project) return;

    const loadEvaluations = async () => {
      try {
        const evaluations = await evaluationStorage.getProjectEvaluations(projectId);

        setProject((prevProject) => {
          if (!prevProject) return prevProject;

          return {
            ...prevProject,
            scenes: prevProject.scenes.map((scene) => {
              const evaluation = evaluations.get(scene.id);
              if (evaluation) {
                return {
                  ...scene,
                  evaluation,
                };
              }
              return scene;
            }),
          };
        });
      } catch (error) {
        console.error('Failed to load evaluations from server:', error);
      }
    };

    loadEvaluations();
  }, [project?.id, projectId]);

  // Helper to get scenes
  const scenes = project?.scenes || [];
  const selectedScene = scenes.find((s) => s.id === selectedSceneId);

  // Keyboard navigation and playback controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Handle ? for help (always works, even with modals open)
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
        return;
      }

      // Handle Escape for closing modals and stopping playback
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showKeyboardShortcuts) {
          setShowKeyboardShortcuts(false);
        } else if (showRefsModal) {
          setShowRefsModal(false);
        } else if (showRefSelectModal) {
          setShowRefSelectModal(false);
        } else if (showProjectSettings) {
          setShowProjectSettings(false);
        } else if (isPlaying || isPlayingAll) {
          handleStop();
        }
        return;
      }

      // Don't handle other keys if modals are open
      if (showRefsModal || showRefSelectModal || showProjectSettings || showKeyboardShortcuts) return;

      const currentIndex = scenes.findIndex(s => s.id === selectedSceneId);

      switch (e.key) {
        case ' ': // Space bar
          e.preventDefault();
          handlePlayPause();
          break;
        case 'Enter':
          if (e.shiftKey) {
            e.preventDefault();
            handlePlayAll();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < scenes.length - 1) {
            setSelectedSceneId(scenes[currentIndex + 1].id);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedSceneId(scenes[currentIndex - 1].id);
          }
          break;
        case 'Home':
          e.preventDefault();
          if (scenes.length > 0) {
            setSelectedSceneId(scenes[0].id);
          }
          break;
        case 'End':
          e.preventDefault();
          if (scenes.length > 0) {
            setSelectedSceneId(scenes[scenes.length - 1].id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scenes, selectedSceneId, showRefsModal, showRefSelectModal, showProjectSettings, showKeyboardShortcuts, isPlaying, isPlayingAll]);

  /**
   * Build a proper Veo 3.1 prompt with dialogue syntax
   * Format: visual description + dialogue with proper syntax + camera info
   */
  const buildVeoPrompt = (scene: Scene): string => {
    let prompt = scene.prompt;

    // Add voiceover as dialogue if present
    if (scene.voiceover && scene.voiceover.trim()) {
      // Veo 3.1 requires dialogue in specific format: A woman says, "dialogue here" (no subtitles)
      // Keep dialogue concise (12-25 words max for 8 second clips)
      const dialogue = scene.voiceover.trim();
      prompt += `. A woman says, "${dialogue}" (no subtitles)`;
    }

    // Add camera angle
    if (scene.cameraAngle) {
      prompt += `. ${scene.cameraAngle}`;
    }

    return prompt;
  };

  const handleCopyPrompt = async () => {
    if (!selectedScene) return;

    const veoPrompt = buildVeoPrompt(selectedScene);

    try {
      await navigator.clipboard.writeText(veoPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  // Playback control functions
  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePlayAll = () => {
    if (!selectedScene || !videoRef.current) return;

    // Start playing current scene
    setIsPlayingAll(true);
    videoRef.current.play();
    setIsPlaying(true);
  };

  const handleStop = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsPlayingAll(false);
  };

  const handleToggleLoop = () => {
    setLoopEnabled(!loopEnabled);
  };

  // Reload video when videoUrl changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedScene?.videoUrl) return;

    // Force reload the video source
    video.load();
  }, [selectedScene?.videoUrl]);

  // Handle video ended event for Play All feature
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoEnded = () => {
      setIsPlaying(false);

      if (isPlayingAll) {
        // Move to next scene if available
        const currentIndex = scenes.findIndex(s => s.id === selectedSceneId);
        if (currentIndex < scenes.length - 1) {
          const nextScene = scenes[currentIndex + 1];
          if (nextScene.generated && nextScene.videoUrl) {
            setSelectedSceneId(nextScene.id);
            // Video will auto-play when scene changes due to key change
            setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.play();
                setIsPlaying(true);
              }
            }, 100);
          } else {
            // Stop if next scene has no video
            setIsPlayingAll(false);
          }
        } else {
          // Reached the end
          setIsPlayingAll(false);
        }
      } else if (loopEnabled) {
        // Loop current video
        video.currentTime = 0;
        video.play();
        setIsPlaying(true);
      }
    };

    video.addEventListener('ended', handleVideoEnded);
    return () => video.removeEventListener('ended', handleVideoEnded);
  }, [isPlayingAll, loopEnabled, scenes, selectedSceneId]);

  const handleGenerateScene = async (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    // Add to generating set
    setGeneratingSceneIds((prev) => new Set(prev).add(sceneId));
    setError(null);

    try {
      // Build proper prompt with dialogue syntax for Veo 3.1
      const veoPrompt = buildVeoPrompt(scene);
      console.log('Generated Veo prompt:', veoPrompt);

      // Get previous scene's last frame for shot continuity or use selected reference
      const sceneIndex = scenes.findIndex((s) => s.id === sceneId);
      let startFrameDataUrl: string | undefined;
      let selectedRefs: GeneratedImage[] | undefined;

      // Priority 1: Load attached assets (new system)
      let assetRefs: GeneratedImage[] = [];
      if (scene.attachedAssets && scene.attachedAssets.length > 0) {
        console.log(`Loading ${scene.attachedAssets.length} attached assets for scene "${scene.title}"`);

        // Use unified AssetLoader to load scene assets
        const attachedAssetIds = scene.attachedAssets.map(a => a.assetId);
        const assetReferences = await AssetLoader.loadSceneAssets(project.id, attachedAssetIds);

        // Convert to full GeneratedImage format with blob data
        for (const assetRef of assetReferences) {
          try {
            const response = await fetch(assetRef.objectUrl);
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

              assetRefs.push({
                imageBytes,
                mimeType: blob.type || 'image/png',
                objectUrl,
                blob,
              });
            }
          } catch (err) {
            console.log(`Failed to load asset ref: ${assetRef.objectUrl}`, err);
          }
        }

        console.log(`Loaded ${assetRefs.length} asset references`);
      }

      // Priority 2: Use referenceMode if specified
      if (scene.referenceMode !== undefined) {
        if (scene.referenceMode === 'previous') {
          // Use previous scene's last frame
          if (sceneIndex > 0) {
            const previousScene = scenes[sceneIndex - 1];
            // Support both new lastFrameUrl and legacy lastFrameDataUrl
            const lastFrame = previousScene.lastFrameUrl || previousScene.lastFrameDataUrl;
            if (lastFrame) {
              startFrameDataUrl = lastFrame;
              console.log(`Using last frame from previous scene "${previousScene.title}" for shot continuity`);
            } else {
              console.log('Previous scene has no last frame stored');
            }
          }
          // Don't send refs when using previous shot
          selectedRefs = undefined;
        } else {
          // Use specific reference image (1-based index)
          const refIndex = scene.referenceMode - 1;

          // Prefer asset refs, fall back to legacy characterRefs
          const availableRefs = assetRefs.length > 0 ? assetRefs : characterRefs;

          if (refIndex >= 0 && refIndex < availableRefs.length) {
            selectedRefs = [availableRefs[refIndex]];
            console.log(`Using reference ${scene.referenceMode} from ${assetRefs.length > 0 ? 'attached assets' : 'character refs'}`);
          } else {
            console.log(`Invalid reference mode ${scene.referenceMode}, using all available references`);
            selectedRefs = availableRefs.length > 0 ? availableRefs : undefined;
          }
        }
      } else {
        // Priority 3: Backward compatibility
        if (sceneIndex > 0) {
          const previousScene = scenes[sceneIndex - 1];
          // Support both new lastFrameUrl and legacy lastFrameDataUrl
          const lastFrame = previousScene.lastFrameUrl || previousScene.lastFrameDataUrl;
          if (lastFrame) {
            startFrameDataUrl = lastFrame;
            console.log(`Using last frame from previous scene "${previousScene.title}" for shot continuity`);
          } else {
            console.log('Previous scene has no last frame stored');
          }
        } else {
          console.log('First scene');
        }

        // Prefer asset refs, fall back to legacy characterRefs
        const availableRefs = assetRefs.length > 0 ? assetRefs : characterRefs;
        selectedRefs = availableRefs.length > 0 ? availableRefs : undefined;

        if (selectedRefs) {
          console.log(`Using ${assetRefs.length > 0 ? 'attached assets' : 'character refs'} (${selectedRefs.length} refs)`);
        }
      }

      // Generate video with optional start frame for continuity
      // If startFrame is provided, it takes priority over character references
      // Use project-level aspect ratio
      const sceneSettings: GenerationSettings = {
        ...currentSettings,
        aspectRatio: project.aspectRatio ?? AspectRatio.PORTRAIT,
      };

      const video = await generateVideo(
        veoPrompt,
        selectedRefs,
        sceneSettings,
        startFrameDataUrl
      );

      // Save video to server FIRST for persistence and get the server URL
      let serverUrl: string;
      try {
        serverUrl = await videoStorage.saveVideo(projectId, sceneId, video.blob);
        console.log(`Saved video for scene ${sceneId} in project ${projectId} to server`);
      } catch (saveErr) {
        console.error('Failed to save video to server:', saveErr);
        // Fall back to blob URL if server save fails
        serverUrl = video.objectUrl;
      }

      // Now extract frames using server-side FFmpeg for frame-perfect extraction
      let firstFrameUrl: string = '';
      let lastFrameUrl: string = '';

      try {
        // Extract first frame (frame #0) using server-side FFmpeg
        const firstFrameDataUrl = await extractFirstFrame(projectId, sceneId);
        console.log('Extracted first frame using server-side FFmpeg');

        // Save first frame as file instead of storing base64 in JSON
        firstFrameUrl = await frameStorage.saveFrame(projectId, sceneId, 'first', firstFrameDataUrl);
        console.log('Saved first frame to file:', firstFrameUrl);

        // Extract EXACT last frame using server-side FFmpeg
        const lastFrameDataUrl = await extractLastFrame(projectId, sceneId);
        console.log('Extracted last frame using server-side FFmpeg for shot continuity');

        // Save last frame as file instead of storing base64 in JSON
        lastFrameUrl = await frameStorage.saveFrame(projectId, sceneId, 'last', lastFrameDataUrl);
        console.log('Saved last frame to file:', lastFrameUrl);
      } catch (frameErr) {
        console.error('Failed to extract frames from server:', frameErr);
        // For now, use empty URLs as fallback
        firstFrameUrl = '';
        lastFrameUrl = '';
      }

      setProject((prevProject) => {
        if (!prevProject) return prevProject;

        return {
          ...prevProject,
          scenes: prevProject.scenes.map((s) =>
            s.id === sceneId
              ? {
                  ...s,
                  generated: true,
                  videoUrl: serverUrl,
                  settings: sceneSettings,
                  firstFrameUrl, // Store first frame file path for thumbnails
                  lastFrameUrl, // Store last frame file path for next scene
                  evaluation: undefined, // Clear previous evaluation
                }
              : s
          ),
        };
      });
    } catch (err) {
      console.error('Video generation failed:', err);

      // Extract Fal.ai error details if available
      if (err instanceof Error && (err as any).falDetails) {
        const falDetails = (err as any).falDetails;
        setError({
          message: falDetails.message,
          type: falDetails.type,
          input: falDetails.input,
          url: falDetails.url,
        });
      } else {
        setError({
          message: err instanceof Error ? err.message : 'Failed to generate video',
        });
      }
    } finally {
      // Remove from generating set
      setGeneratingSceneIds((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  /**
   * Multi-model video generation - Generate with multiple models and let user choose
   */
  const handleGenerateSceneMultiModel = async (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene || selectedVideoModels.length === 0) return;

    // Add to generating set
    setGeneratingSceneIds((prev) => new Set(prev).add(sceneId));
    setError(null);

    try {
      // Build proper prompt with dialogue syntax
      const veoPrompt = buildVeoPrompt(scene);
      console.log('Generated Veo prompt:', veoPrompt);

      // Get previous scene's last frame for shot continuity or use selected reference
      const sceneIndex = scenes.findIndex((s) => s.id === sceneId);
      let startFrameDataUrl: string | undefined;
      let selectedRefs: GeneratedImage[] | undefined;

      // Priority 1: Load attached assets (new system)
      let assetRefs: GeneratedImage[] = [];
      if (scene.attachedAssets && scene.attachedAssets.length > 0) {
        console.log(`Loading ${scene.attachedAssets.length} attached assets for scene "${scene.title}"`);

        // Use unified AssetLoader to load scene assets
        const attachedAssetIds = scene.attachedAssets.map(a => a.assetId);
        const assetReferences = await AssetLoader.loadSceneAssets(project.id, attachedAssetIds);

        // Convert to full GeneratedImage format with blob data
        for (const assetRef of assetReferences) {
          try {
            const response = await fetch(assetRef.objectUrl);
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

              assetRefs.push({
                imageBytes,
                mimeType: blob.type || 'image/png',
                objectUrl,
                blob,
              });
            }
          } catch (err) {
            console.log(`Failed to load asset ref: ${assetRef.objectUrl}`, err);
          }
        }

        console.log(`Loaded ${assetRefs.length} asset references`);
      }

      // Priority 2: Use referenceMode if specified
      if (scene.referenceMode !== undefined) {
        if (scene.referenceMode === 'previous') {
          // Use previous scene's last frame
          if (sceneIndex > 0) {
            const previousScene = scenes[sceneIndex - 1];
            // Support both new lastFrameUrl and legacy lastFrameDataUrl
            const lastFrame = previousScene.lastFrameUrl || previousScene.lastFrameDataUrl;
            if (lastFrame) {
              startFrameDataUrl = lastFrame;
              console.log(`Using last frame from previous scene "${previousScene.title}" for shot continuity`);
            }
          }
          selectedRefs = undefined;
        } else {
          // Use specific reference image (1-based index)
          const refIndex = scene.referenceMode - 1;
          const availableRefs = assetRefs.length > 0 ? assetRefs : characterRefs;

          if (refIndex >= 0 && refIndex < availableRefs.length) {
            selectedRefs = [availableRefs[refIndex]];
            console.log(`Using reference ${scene.referenceMode}`);
          } else {
            selectedRefs = availableRefs.length > 0 ? availableRefs : undefined;
          }
        }
      } else {
        // Backward compatibility
        if (sceneIndex > 0) {
          const previousScene = scenes[sceneIndex - 1];
          // Support both new lastFrameUrl and legacy lastFrameDataUrl
          const lastFrame = previousScene.lastFrameUrl || previousScene.lastFrameDataUrl;
          if (lastFrame) {
            startFrameDataUrl = lastFrame;
          }
        }

        const availableRefs = assetRefs.length > 0 ? assetRefs : characterRefs;
        selectedRefs = availableRefs.length > 0 ? availableRefs : undefined;
      }

      // Prepare reference images for API call
      const referenceImages = selectedRefs?.map(ref => ({
        base64: ref.imageBytes,
        mimeType: ref.mimeType,
      }));

      // Call multi-model API
      const response = await fetch('/api/generate-video-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          models: selectedVideoModels,
          prompt: veoPrompt,
          aspectRatio: project.aspectRatio ?? '9:16',
          resolution: currentSettings.resolution === Resolution.P1080 ? '1080p' : '720p',
          referenceImages,
          startFrameDataUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Multi-model generation failed');
      }

      const data = await response.json();
      console.log(`Multi-model generation complete: ${data.results.length} results`);

      // Convert base64 video data to blobs and extract thumbnails
      const resultsWithThumbnails = await Promise.all(
        data.results.map(async (result: VideoGenerationResult) => {
          if (result.videoBytes && !result.error && !result.loading) {
            try {
              // Convert base64 to blob
              const binaryString = atob(result.videoBytes);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: result.mimeType || 'video/mp4' });
              const blobUrl = URL.createObjectURL(blob);

              console.log(`Created blob URL for ${result.model}:`, blobUrl, 'size:', blob.size);

              // Extract thumbnail from blob URL
              const { extractFirstFrameFromBlob } = await import('@/services/frameExtractionService');
              console.log(`Extracting thumbnail for ${result.model} from:`, blobUrl);
              const thumbnailDataUrl = await extractFirstFrameFromBlob(blobUrl);
              console.log(`Extracted thumbnail for ${result.model}, length:`, thumbnailDataUrl.length);

              return { ...result, blob, videoUrl: blobUrl, thumbnailDataUrl };
            } catch (err) {
              console.error(`Failed to process video for ${result.model}:`, err);
              return result;
            }
          }
          return result;
        })
      );

      // Store results with thumbnails and show selection modal
      setVideoResults(resultsWithThumbnails);
      setShowVideoResultModal(true);

    } catch (err) {
      console.error('Multi-model video generation failed:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to generate videos'
      );
    } finally {
      // Remove from generating set
      setGeneratingSceneIds((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  /**
   * Handle user selecting a video result from multi-model generation
   */
  const handleSelectVideoResult = async (result: VideoGenerationResult) => {
    if (!selectedSceneId || !result.blob) return;

    setShowVideoResultModal(false);

    try {
      // Save selected video to server
      const serverUrl = await videoStorage.saveVideo(projectId, selectedSceneId, result.blob);
      console.log(`Saved selected video (${result.model}) for scene ${selectedSceneId}`);

      // Extract frames and save as files
      let firstFrameUrl = '';
      let lastFrameUrl = '';

      try {
        const firstFrameDataUrl = await extractFirstFrame(projectId, selectedSceneId);
        firstFrameUrl = await frameStorage.saveFrame(projectId, selectedSceneId, 'first', firstFrameDataUrl);

        const lastFrameDataUrl = await extractLastFrame(projectId, selectedSceneId);
        lastFrameUrl = await frameStorage.saveFrame(projectId, selectedSceneId, 'last', lastFrameDataUrl);

        console.log('Extracted and saved frames for selected video');
      } catch (frameErr) {
        console.error('Failed to extract frames:', frameErr);
      }

      // Update scene with selected video
      const sceneSettings: GenerationSettings = {
        ...currentSettings,
        aspectRatio: project.aspectRatio ?? AspectRatio.PORTRAIT,
      };

      setProject((prevProject) => {
        if (!prevProject) return prevProject;

        return {
          ...prevProject,
          scenes: prevProject.scenes.map((s) =>
            s.id === selectedSceneId
              ? {
                  ...s,
                  generated: true,
                  videoUrl: serverUrl,
                  settings: sceneSettings,
                  firstFrameUrl,
                  lastFrameUrl,
                  evaluation: undefined,
                }
              : s
          ),
        };
      });

      // Clear results
      setVideoResults([]);
    } catch (err) {
      console.error('Failed to save selected video:', err);
      setError(err instanceof Error ? err.message : 'Failed to save video');
    }
  };

  const handleEvaluateScene = async (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene || !scene.videoUrl) return;

    // Add to evaluating set
    setEvaluatingSceneIds((prev) => new Set(prev).add(sceneId));
    setError(null);

    try {
      // Fetch video blob from URL
      const response = await fetch(scene.videoUrl);
      const videoBlob = await response.blob();

      const evaluation = await evaluateVideo(
        projectId,
        sceneId,
        videoBlob,
        scene.duration,
        scene.prompt,
        scene.voiceover || '',
        openaiApiKey || undefined
      );

      // Save evaluation to server for persistence
      try {
        await evaluationStorage.saveEvaluation(projectId, sceneId, evaluation);
        console.log(`Saved evaluation for scene ${sceneId} in project ${projectId}`);
      } catch (saveErr) {
        console.error('Failed to save evaluation to server:', saveErr);
        // Continue even if save fails - the evaluation is still in state
      }

      // Update scene with evaluation results
      setProject((prevProject) => {
        if (!prevProject) return prevProject;

        return {
          ...prevProject,
          scenes: prevProject.scenes.map((s) =>
            s.id === sceneId ? { ...s, evaluation } : s
          ),
        };
      });
    } catch (err) {
      console.error('Video evaluation failed:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to evaluate video'
      );
    } finally {
      // Remove from evaluating set
      setEvaluatingSceneIds((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  const handleExportVideo = async () => {
    if (!project) return;

    // Get all scenes with generated videos
    const scenesWithVideos = project.scenes.filter(s => s.generated && s.videoUrl);

    if (scenesWithVideos.length === 0) {
      setError('No generated videos to export');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          sceneIds: scenesWithVideos.map(s => s.id),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export video');
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.id}-full.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('Video exported successfully');
    } catch (err) {
      console.error('Video export failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to export video');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveOpenAIKey = (key: string) => {
    setOpenaiApiKey(key);
    localStorage.setItem('openai_api_key', key);
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects?projectId=${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete story');
      }

      console.log('Story deleted successfully');

      // Close modal and reset state
      setIsDeleting(false);
      setShowDeleteConfirm(false);

      // Use window.location for hard navigation to ensure it works
      window.location.href = '/';
    } catch (err) {
      console.error('Story deletion failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete story');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSaveAssetAttachments = async (attachments: SceneAssetAttachment[]) => {
    if (!selectedScene) return;

    try {
      // Save attachments via API
      const response = await fetch(`/api/scenes/${selectedScene.id}/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attachments }),
      });

      if (!response.ok) {
        throw new Error('Failed to save asset attachments');
      }

      // Update local project state
      if (project) {
        const updatedProject = {
          ...project,
          scenes: project.scenes.map((scene) =>
            scene.id === selectedScene.id
              ? { ...scene, attachedAssets: attachments }
              : scene
          ),
        };
        setProject(updatedProject);

        // Also update selectedScene to reflect changes immediately
        setSelectedScene({ ...selectedScene, attachedAssets: attachments });
      }

      console.log('Asset attachments saved successfully');
    } catch (err) {
      console.error('Failed to save asset attachments:', err);
      setError(err instanceof Error ? err.message : 'Failed to save asset attachments');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar - Fixed Header */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-6">
          {/* Back to Stories Button */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Stories</span>
          </button>

          {/* Project Title and Info */}
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">{project?.title}</h1>
            <div className="flex items-center gap-3 text-sm">
              {project && (
                <>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">{project.type}</span>
                  <button
                    onClick={() => router.push(`/projects/${projectId}/assets`)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-medium transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Asset Library</span>
                    {characterRefs.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                        {characterRefs.length}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Story Settings Button */}
          {project && (
            <button
              onClick={() => setShowProjectSettings(true)}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Story Settings"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          )}

          {/* Character Design Button */}
          {project && (
            <button
              onClick={() => setShowRefsModal(true)}
              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Character Design"
            >
              <Sparkles className="w-5 h-5" />
            </button>
          )}

          {/* Preview Your Story Button */}
          {project && project.scenes.length > 0 && (
            <button
              onClick={() => setShowScriptPreview(true)}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Preview Your Story"
            >
              <FileText className="w-5 h-5" />
            </button>
          )}

          {/* Export Video Button */}
          <button
            onClick={handleExportVideo}
            disabled={isExporting || !project?.scenes.some(s => s.generated && s.videoUrl)}
            className="p-2 text-green-600 hover:bg-green-50 disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-lg transition-colors"
            title={isExporting ? "Exporting..." : "Export Video"}
          >
            {isExporting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
          </button>

          {/* Delete Story Button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Story"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Help Button - Keyboard Shortcuts */}
          <button
            onClick={() => setShowKeyboardShortcuts(true)}
            className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <CostTracker />
        </div>
      </div>

      {/* Main Content Area - 3 Columns */}
      <div className="flex flex-1 overflow-hidden pb-20">
        {/* Left Panel - Scenes List (1/4) */}
        <div className="w-1/4 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">

        <div className="p-2">
          {scenes.map((scene, index) => {
            const currentRef = scene.referenceMode ?? (index === 0 ? 1 : 'previous');
            const isReference = typeof currentRef === 'number';

            // Get thumbnail URL
            let thumbnailUrl: string | undefined;
            if (isReference && typeof currentRef === 'number') {
              const refIndex = currentRef - 1;
              if (combinedRefs[refIndex]) {
                thumbnailUrl = combinedRefs[refIndex].objectUrl;
              }
            } else if (!isReference && index > 0) {
              const previousScene = scenes[index - 1];
              // Support both new lastFrameUrl and legacy lastFrameDataUrl
              thumbnailUrl = previousScene.lastFrameUrl || previousScene.lastFrameDataUrl;
            }

            // Fallback: Try to get thumbnail from attachedAssets if no referenceMode is set
            if (!thumbnailUrl && scene.attachedAssets && scene.attachedAssets.length > 0) {
              const firstAsset = scene.attachedAssets[0];
              // Check if this asset exists in combinedRefs by matching assetId
              const matchingRef = combinedRefs.find(ref =>
                ref.assetId === firstAsset.assetId
              );
              if (matchingRef) {
                thumbnailUrl = matchingRef.objectUrl;
              }
            }

            return (
              <button
                key={scene.id}
                onClick={() => setSelectedSceneId(scene.id)}
                className={`w-full text-left p-2 mb-2 rounded-lg transition-all ${
                  selectedSceneId === scene.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex gap-2">
                  {/* Thumbnail */}
                  <div className="w-12 h-20 flex-shrink-0 rounded overflow-hidden bg-gray-50 border border-gray-200">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={`Scene ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : isReference ? (
                      <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                        <ImageIcon className="w-5 h-5 text-indigo-300" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                        <Film className="w-5 h-5 text-indigo-300" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${selectedSceneId === scene.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="font-medium text-sm">{scene.title}</span>
                        {/* Flow Indicator */}
                        {isReference ? (
                          <ImageIcon
                            className={`w-3.5 h-3.5 flex-shrink-0 ${selectedSceneId === scene.id ? 'text-indigo-200' : 'text-indigo-500'}`}
                            title={`Asset ${currentRef}`}
                          />
                        ) : (
                          <Film
                            className={`w-3.5 h-3.5 flex-shrink-0 ${selectedSceneId === scene.id ? 'text-purple-200' : 'text-purple-500'}`}
                            title="Continue from previous shot"
                          />
                        )}
                      </div>
                      {generatingSceneIds.has(scene.id) ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />
                      ) : scene.generated ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : null}
                    </div>
                    <p className={`text-xs line-clamp-2 mt-1 ${selectedSceneId === scene.id ? 'text-indigo-100' : 'text-gray-400'}`}>
                      {scene.prompt}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs ${selectedSceneId === scene.id ? 'text-indigo-200' : 'text-gray-500'}`}>{scene.duration}s</span>
                      <span className={`text-xs ${selectedSceneId === scene.id ? 'text-indigo-300' : 'text-gray-600'}`}>•</span>
                      <span className={`text-xs ${selectedSceneId === scene.id ? 'text-indigo-200' : 'text-gray-500'}`}>
                        {scene.cameraAngle}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle Column - Video Player (1/2) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-200">
        {selectedScene && (
          <>
            {/* Video Display Area */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
              {error && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4 max-w-2xl mb-2 mx-auto">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-red-900 font-medium mb-1">
                        {error.type === 'content_policy_violation'
                          ? 'Content Policy Violation'
                          : 'Video Generation Failed'}
                      </p>
                      <p className="text-red-700 text-sm mb-2">{error.message}</p>

                      {error.input && (
                        <div className="mt-2 bg-red-100 rounded p-2 border border-red-200">
                          <p className="text-red-800 text-xs font-medium mb-1">Flagged prompt:</p>
                          <p className="text-red-700 text-xs font-mono break-words">{error.input}</p>
                        </div>
                      )}

                      {error.url && (
                        <a
                          href={error.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 mt-2"
                        >
                          Learn more about this error
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {generatingSceneIds.has(selectedScene.id) ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-900 text-lg mb-2">Generating video...</p>
                    <p className="text-gray-600 text-sm">
                      This may take a few minutes
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center overflow-hidden">
                  {selectedScene.videoUrl ? (() => {
                    // Get start frame preview for "continue from previous" mode
                    const sceneIndex = scenes.findIndex((s) => s.id === selectedScene.id);
                    const currentRef = selectedScene.referenceMode ?? (sceneIndex === 0 ? 1 : 'previous');
                    const isPrevious = currentRef === 'previous';

                    let startFrameUrl: string | undefined;
                    if (isPrevious && sceneIndex > 0) {
                      const previousScene = scenes[sceneIndex - 1];
                      // Support both new lastFrameUrl and legacy lastFrameDataUrl
                      startFrameUrl = previousScene.lastFrameUrl || previousScene.lastFrameDataUrl;
                    }

                    return (
                      <>
                        {/* Start frame preview - shown when not playing and available */}
                        {startFrameUrl && !isPlaying && (
                          <img
                            src={startFrameUrl}
                            alt="Start frame preview"
                            className="max-h-full max-w-full rounded-lg shadow-2xl"
                          />
                        )}

                        {/* Video player - hidden when showing start frame */}
                        <video
                          ref={videoRef}
                          key={selectedScene.videoUrl}
                          className={`max-h-full max-w-full rounded-lg shadow-2xl ${
                            startFrameUrl && !isPlaying ? 'hidden' : ''
                          }`}
                        >
                          <source src={selectedScene.videoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      </>
                    );
                  })() : (() => {
                    // Show start frame preview when no video exists
                    const sceneIndex = scenes.findIndex((s) => s.id === selectedScene.id);
                    const currentRef = selectedScene.referenceMode ?? (sceneIndex === 0 ? 1 : 'previous');
                    const isPrevious = currentRef === 'previous';

                    // Recursive function to find the start frame by walking back through scenes
                    const findStartFrame = (index: number): string | undefined => {
                      if (index < 0) return undefined;

                      const scene = scenes[index];
                      const ref = scene.referenceMode ?? (index === 0 ? 1 : 'previous');

                      // If this scene uses an asset reference, return it
                      if (typeof ref === 'number') {
                        const refIndex = ref - 1;
                        if (refIndex >= 0 && refIndex < combinedRefs.length) {
                          return combinedRefs[refIndex].objectUrl;
                        }
                      }

                      // If this scene has a generated video with last frame, return it
                      // Support both new lastFrameUrl and legacy lastFrameDataUrl
                      const lastFrame = scene.lastFrameUrl || scene.lastFrameDataUrl;
                      if (lastFrame) {
                        return lastFrame;
                      }

                      // Otherwise, recurse to previous scene
                      return findStartFrame(index - 1);
                    };

                    // Get the start frame image URL
                    let startFrameUrl: string | undefined;
                    if (!isPrevious && typeof currentRef === 'number') {
                      // Use selected reference asset
                      const refIndex = currentRef - 1;
                      if (refIndex >= 0 && refIndex < combinedRefs.length) {
                        startFrameUrl = combinedRefs[refIndex].objectUrl;
                      }
                    } else if (isPrevious && sceneIndex > 0) {
                      // Walk back through previous scenes to find a start frame
                      startFrameUrl = findStartFrame(sceneIndex - 1);
                    }

                    return startFrameUrl ? (
                      <div className="flex flex-col items-center justify-center p-8 space-y-4">
                        <div className="relative max-w-sm">
                          <img
                            src={startFrameUrl}
                            alt="Start frame preview"
                            className="max-h-[60vh] max-w-full rounded-lg shadow-xl border-2 border-indigo-200"
                          />
                          <div className="absolute top-2 left-2 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
                            Start Frame Preview
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-700 text-lg font-medium">No video generated</p>
                          <p className="text-gray-500 text-sm mt-1">
                            {isPrevious ? 'Will continue from previous shot' : `Using Asset ${currentRef}`}
                          </p>
                          <p className="text-gray-400 text-xs mt-1">Use the controls on the right to generate</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-12">
                        <Radio className="w-16 h-16 text-indigo-400 mb-4" />
                        <p className="text-gray-700 text-lg font-medium">No video generated</p>
                        <p className="text-gray-500 text-sm mt-2">Use the controls on the right to generate</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right Column - Scene Controls (1/4) */}
      <div className={`w-1/4 bg-white border-l border-gray-200 flex-shrink-0 ${rightPanelView === 'details' ? 'overflow-y-auto' : 'flex flex-col'}`}>
        {selectedScene && (() => {
          const sceneIndex = scenes.findIndex((s) => s.id === selectedScene.id);
          return (
          <div className={rightPanelView === 'details' ? 'p-4 space-y-4' : 'flex flex-col flex-1 min-h-0'}>
            {/* Scene Info */}
            <div className={rightPanelView === 'chat' || rightPanelView === 'analysis' ? 'flex flex-col flex-1 min-h-0' : ''}>
              {/* View Toggle and Action Buttons */}
              <div className={`flex items-center justify-between gap-3 mb-4 ${rightPanelView === 'chat' || rightPanelView === 'analysis' ? 'p-4 pb-0 flex-shrink-0' : ''}`}>
                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setRightPanelView('details')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      rightPanelView === 'details'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setRightPanelView('chat')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      rightPanelView === 'chat'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3 inline mr-1" />
                    Chat
                  </button>
                  <button
                    onClick={() => setRightPanelView('analysis')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      rightPanelView === 'analysis'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Search className="w-3 h-3 inline mr-1" />
                    Analysis
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Generate Video Button - Icon Only, color indicates status */}
                  <button
                    onClick={() => {
                      if (selectedVideoModels.length > 1) {
                        handleGenerateSceneMultiModel(selectedScene.id);
                      } else {
                        handleGenerateScene(selectedScene.id);
                      }
                    }}
                    disabled={
                      combinedRefs.length === 0 ||
                      generatingSceneIds.has(selectedScene.id) ||
                      selectedVideoModels.length === 0
                    }
                    className={`p-1 transition-colors flex items-center justify-center flex-shrink-0 ${
                      selectedScene.generated
                        ? 'text-green-600 hover:text-green-700'
                        : 'text-orange-500 hover:text-orange-600'
                    } disabled:text-gray-300 disabled:cursor-not-allowed`}
                    title={selectedScene.generated ? 'Regenerate Video' : 'Generate Video'}
                  >
                    <Play className="w-5 h-5" fill="currentColor" />
                  </button>

                  {/* Settings Button - Icon Only */}
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-1 text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center flex-shrink-0"
                    title="Show Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Conditional View: Details, Chat, or Analysis */}
              {rightPanelView === 'details' ? (
                <>
              {/* Duration */}
              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <Film className="w-4 h-4 text-indigo-600" />
                  <span>{selectedScene.duration}s</span>
                </div>
              </div>

              {/* Camera Angle */}
              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  <span>{selectedScene.cameraAngle}</span>
                </div>
              </div>

              {/* Prompt */}
              <div className="mb-3">
                <div className="flex items-start gap-2 text-sm text-gray-900">
                  <Clapperboard className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <p className="flex-1">{selectedScene.prompt}</p>
                  <button
                    onClick={handleCopyPrompt}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
                    title="Copy full prompt"
                  >
                    {copiedPrompt ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Voiceover */}
              {selectedScene.voiceover && (
                <div className="mb-3">
                  <div className="flex items-start gap-2 text-sm text-gray-900">
                    <Mic className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <p className="flex-1 italic">&ldquo;{selectedScene.voiceover}&rdquo;</p>
                  </div>
                </div>
              )}

              {/* Reference Selection */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-2">Start Frame</label>
                <div className="bg-white border-2 border-gray-200 rounded-lg p-3">
                  {(() => {
                    const currentRef = selectedScene.referenceMode ?? (sceneIndex === 0 ? 1 : 'previous');
                    const isPrevious = currentRef === 'previous';

                    // Get the image URL
                    let imageUrl: string | undefined;
                    if (!isPrevious && typeof currentRef === 'number') {
                      // Use asset reference
                      const refIndex = currentRef - 1;
                      if (combinedRefs[refIndex]) {
                        imageUrl = combinedRefs[refIndex].objectUrl;
                      }
                    } else if (isPrevious && sceneIndex > 0) {
                      // Use previous scene's last frame if available
                      const previousScene = scenes[sceneIndex - 1];
                      // Support both new lastFrameUrl and legacy lastFrameDataUrl
                      imageUrl = previousScene.lastFrameUrl || previousScene.lastFrameDataUrl;
                    }

                    return (
                      <div className="space-y-3">
                        {/* Thumbnail and Info */}
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="w-16 h-28 flex-shrink-0 rounded overflow-hidden bg-gray-100 border border-gray-200">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt="Start frame"
                                className="w-full h-full object-cover"
                              />
                            ) : isPrevious ? (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                                <Film size={24} className="text-indigo-400" />
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                <ImageIcon size={24} className="text-gray-300" />
                              </div>
                            )}
                          </div>

                          {/* Label */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {isPrevious ? (
                                <>
                                  <Film size={16} className="text-indigo-600 flex-shrink-0" />
                                  <span className="text-sm font-medium text-gray-900">Previous Shot</span>
                                </>
                              ) : (
                                <>
                                  <ImageIcon size={16} className="text-indigo-600 flex-shrink-0" />
                                  <span className="text-sm font-medium text-gray-900">Asset {currentRef}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowRefSelectModal(true)}
                            className="flex-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
                          >
                            <ImagePlus size={14} />
                            <span>Change</span>
                          </button>

                          {/* Edit button - only show for asset references */}
                          {!isPrevious && typeof currentRef === 'number' && combinedRefs[currentRef - 1] && (
                            <button
                              onClick={async () => {
                                const refIndex = currentRef - 1;
                                const selectedRef = combinedRefs[refIndex];

                              console.log('🎨 [Edit Start Frame] Starting edit for reference:', {
                                refIndex,
                                assetId: selectedRef.assetId,
                                objectUrl: selectedRef.objectUrl,
                                hasAssetId: !!selectedRef.assetId
                              });

                              // Try to fetch the full Asset object directly by ID first
                              if (selectedRef.assetId) {
                                try {
                                  console.log('📡 Fetching asset by ID:', selectedRef.assetId);
                                  const response = await fetch(`/api/assets/${selectedRef.assetId}`);

                                  if (response.ok) {
                                    const asset = await response.json();
                                    console.log('✅ Fetched asset for editing:', {
                                      id: asset.id,
                                      name: asset.name,
                                      url: asset.url
                                    });

                                    // Parse dates and editHistory
                                    const parsedAsset: Asset = {
                                      ...asset,
                                      createdAt: new Date(asset.createdAt),
                                      updatedAt: new Date(asset.updatedAt),
                                      editHistory: asset.editHistory.map((h: any) => ({
                                        ...h,
                                        timestamp: new Date(h.timestamp)
                                      }))
                                    };

                                    // Open EditAssetModal with the asset
                                    setAssetToEdit(parsedAsset);
                                    setShowEditAssetModal(true);
                                    return;
                                  } else {
                                    console.error('❌ Failed to fetch asset:', response.status);
                                  }
                                } catch (error) {
                                  console.error('❌ Error fetching asset:', error);
                                }
                              }

                              // Fallback: try to find asset by matching URL
                              console.log('🔍 Fallback: Searching all assets...');
                              try {
                                const response = await fetch(`/api/assets?projectId=${projectId}`);
                                if (response.ok) {
                                  const data = await response.json();
                                  const matchingAsset = data.assets?.find((a: Asset) =>
                                    a.url === selectedRef.objectUrl ||
                                    selectedRef.objectUrl.includes(a.id)
                                  );

                                  if (matchingAsset) {
                                    console.log('✅ Found matching asset:', {
                                      id: matchingAsset.id,
                                      url: matchingAsset.url
                                    });

                                    // Parse dates and editHistory
                                    const parsedAsset: Asset = {
                                      ...matchingAsset,
                                      createdAt: new Date(matchingAsset.createdAt),
                                      updatedAt: new Date(matchingAsset.updatedAt),
                                      editHistory: matchingAsset.editHistory.map((h: any) => ({
                                        ...h,
                                        timestamp: new Date(h.timestamp)
                                      }))
                                    };

                                    setAssetToEdit(parsedAsset);
                                    setShowEditAssetModal(true);
                                  } else {
                                    console.warn('⚠️ No matching asset found');
                                    alert('Failed to load asset for editing. Please try again.');
                                  }
                                }
                              } catch (error) {
                                console.error('❌ Failed to load asset:', error);
                                alert('Failed to load asset for editing. Please try again.');
                              }
                              }}
                              className="flex-1 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
                              title="Edit this asset with AI"
                            >
                              <Edit2 size={14} />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                <h4 className="text-sm font-medium text-gray-900">Generation Settings</h4>

                {/* Multi-Model Selector */}
                <div>
                  <label className="block text-xs text-gray-600 mb-2">
                    Video Models
                    <span className="text-gray-400 ml-1">(select one or more)</span>
                  </label>
                  <div className="space-y-1.5">
                    {getAllVideoGenerationModels().map((modelDef) => (
                      <label
                        key={modelDef.id}
                        className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedVideoModels.includes(modelDef.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedVideoModels([...selectedVideoModels, modelDef.id]);
                            } else {
                              setSelectedVideoModels(selectedVideoModels.filter(m => m !== modelDef.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900">{modelDef.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              modelDef.speed === 'fast' ? 'bg-green-100 text-green-700' :
                              modelDef.speed === 'slow' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              ~{modelDef.estimatedTimeSeconds}s
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{modelDef.provider}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Resolution</label>
                  <select
                    value={currentSettings.resolution}
                    onChange={(e) => setCurrentSettings({ ...currentSettings, resolution: e.target.value as Resolution })}
                    className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-900"
                  >
                    <option value={Resolution.P720}>720p</option>
                    <option value={Resolution.P1080}>1080p</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="looping"
                    checked={currentSettings.isLooping}
                    onChange={(e) => setCurrentSettings({ ...currentSettings, isLooping: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <label htmlFor="looping" className="text-sm text-gray-700">Enable looping</label>
                </div>

              </div>
            )}

            </>
              ) : rightPanelView === 'chat' ? (
                /* Chat View for Shot Editing */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Shot Details - Same styling as Details mode */}
                  <div className="p-4 border-b border-gray-200 flex-shrink-0">
                    {/* Duration */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Film className="w-4 h-4 text-indigo-600" />
                        <span>{selectedScene.duration}s</span>
                      </div>
                    </div>

                    {/* Camera Angle */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Camera className="w-4 h-4 text-indigo-600" />
                        <span>{selectedScene.cameraAngle}</span>
                      </div>
                    </div>

                    {/* Prompt */}
                    <div className="mb-3">
                      <div className="flex items-start gap-2 text-sm text-gray-900">
                        <Clapperboard className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                        <p className="flex-1">{selectedScene.prompt}</p>
                        <button
                          onClick={handleCopyPrompt}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
                          title="Copy full prompt"
                        >
                          {copiedPrompt ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Voiceover */}
                    {selectedScene.voiceover && (
                      <div className="mb-3">
                        <div className="flex items-start gap-2 text-sm text-gray-900">
                          <Mic className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                          <p className="flex-1 italic">&ldquo;{selectedScene.voiceover}&rdquo;</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {shotMessages.length === 0 ? (
                      <div className="text-center py-8">
                        <Edit3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">
                          Start a conversation to edit this shot
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          e.g., "Change the camera angle to close-up" or "Make the narration more dramatic"
                        </p>
                      </div>
                    ) : (
                      shotMessages.map((message) => (
                        <div
                          key={message.timestamp}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className="space-y-2 max-w-[85%]">
                            {message.content && (
                              <div
                                className={`rounded-lg px-4 py-2.5 ${
                                  message.role === 'user'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white border border-gray-200 text-gray-900'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                <p
                                  className={`text-xs mt-1 ${
                                    message.role === 'user' ? 'text-indigo-200' : 'text-gray-400'
                                  }`}
                                >
                                  {new Date(message.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    {/* Loading indicator */}
                    {isEditingShot && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                            <p className="text-sm text-gray-600">Updating shot...</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scroll anchor */}
                    <div ref={shotChatEndRef} />
                  </div>

                  {/* Chat Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (shotChatInput.trim() && !isEditingShot) {
                        editShot(shotChatInput);
                        setShotChatInput('');
                      }
                    }}
                    className="p-4 border-t border-gray-200 bg-white flex-shrink-0"
                  >
                    <div className="flex gap-2 items-end">
                      <textarea
                        value={shotChatInput}
                        onChange={(e) => {
                          setShotChatInput(e.target.value);
                          // Auto-grow textarea
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (shotChatInput.trim() && !isEditingShot) {
                              editShot(shotChatInput);
                              setShotChatInput('');
                              // Reset height
                              e.currentTarget.style.height = 'auto';
                            }
                          }
                        }}
                        rows={1}
                        placeholder="Describe your edit (Enter to send, Shift+Enter for new line)..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 text-sm min-h-[40px] max-h-[120px] overflow-y-auto"
                        style={{ height: 'auto' }}
                        disabled={isEditingShot}
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!shotChatInput.trim() || isEditingShot}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                        title="Send message (Enter)"
                      >
                        {isEditingShot ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <ArrowRight className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : rightPanelView === 'analysis' ? (
                /* Analysis View */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Analysis Header */}
                  <div className="p-4 border-b border-gray-200 flex-shrink-0">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Search className="w-5 h-5 text-purple-600" />
                      AI Analysis
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      Evaluate video quality against prompt and voiceover
                    </p>
                  </div>

                  {/* Analysis Content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Evaluate Button */}
                    {!selectedScene.evaluation && (
                      <div className="text-center py-8">
                        <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 mb-4">
                          {selectedScene.videoUrl
                            ? 'Run AI analysis to evaluate this video'
                            : 'Generate a video first to run analysis'
                          }
                        </p>

                        {/* OpenAI API Key Input */}
                        {!openaiApiKey && selectedScene.generated && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-left max-w-md mx-auto">
                            <p className="text-xs text-yellow-800 mb-2 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" />
                              Optional: Add OpenAI API key for audio transcription
                            </p>
                            <input
                              type="password"
                              placeholder="sk-..."
                              className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-900"
                              onBlur={(e) => handleSaveOpenAIKey(e.target.value)}
                            />
                          </div>
                        )}

                        <button
                          onClick={() => handleEvaluateScene(selectedScene.id)}
                          disabled={!selectedScene.videoUrl || evaluatingSceneIds.has(selectedScene.id)}
                          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                        >
                          {evaluatingSceneIds.has(selectedScene.id) ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Analyzing...</span>
                            </>
                          ) : (
                            <>
                              <Search className="w-5 h-5" />
                              <span>Run Analysis</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Evaluation Results */}
                    {selectedScene.evaluation && (
                      <>
                        {/* Score Badge */}
                        <div className="text-center mb-6">
                          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-semibold ${
                            selectedScene.evaluation.overallScore >= 70
                              ? 'bg-green-50 border-2 border-green-200 text-green-700'
                              : selectedScene.evaluation.overallScore >= 40
                              ? 'bg-yellow-50 border-2 border-yellow-200 text-yellow-700'
                              : 'bg-red-50 border-2 border-red-200 text-red-700'
                          }`}>
                            <Search className="w-5 h-5" />
                            Overall Score: {selectedScene.evaluation.overallScore}%
                          </span>
                        </div>

                        {/* Audio Score */}
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-indigo-600" />
                            Audio Evaluation ({selectedScene.evaluation.audioEvaluation.score}%)
                          </h5>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-gray-600 font-medium">Expected:</span>
                              <p className="text-gray-800 italic mt-1">&ldquo;{selectedScene.evaluation.audioEvaluation.expectedText}&rdquo;</p>
                            </div>
                            <div>
                              <span className="text-gray-600 font-medium">Transcribed:</span>
                              <p className="text-gray-800 mt-1">{selectedScene.evaluation.audioEvaluation.transcribedText}</p>
                            </div>
                          </div>
                        </div>

                        {/* Frame Evaluations */}
                        <div className="space-y-3">
                          {/* First Frame */}
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h5 className="text-sm font-semibold text-gray-900 mb-2">
                              First Frame ({selectedScene.evaluation.firstFrameEvaluation.score}%)
                            </h5>
                            <img
                              src={selectedScene.evaluation.firstFrameEvaluation.imageUrl}
                              alt="First frame"
                              className="w-full rounded-lg mb-3 border border-gray-300"
                            />
                            <p className="text-sm text-gray-700">
                              {selectedScene.evaluation.firstFrameEvaluation.analysis}
                            </p>
                          </div>

                          {/* Last Frame */}
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h5 className="text-sm font-semibold text-gray-900 mb-2">
                              Last Frame ({selectedScene.evaluation.lastFrameEvaluation.score}%)
                            </h5>
                            <img
                              src={selectedScene.evaluation.lastFrameEvaluation.imageUrl}
                              alt="Last frame"
                              className="w-full rounded-lg mb-3 border border-gray-300"
                            />
                            <p className="text-sm text-gray-700">
                              {selectedScene.evaluation.lastFrameEvaluation.analysis}
                            </p>
                          </div>
                        </div>

                        {/* Re-run Analysis Button */}
                        <div className="pt-4 border-t border-gray-200">
                          <button
                            onClick={() => handleEvaluateScene(selectedScene.id)}
                            disabled={evaluatingSceneIds.has(selectedScene.id)}
                            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {evaluatingSceneIds.has(selectedScene.id) ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Re-analyzing...</span>
                              </>
                            ) : (
                              <>
                                <Search className="w-4 h-4" />
                                <span>Re-run Analysis</span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          );
        })()}
      </div>
      </div>

      {/* Character Design Chat Modal */}
      {showRefsModal && project && (
        <CharacterDesignChatModal
          isOpen={showRefsModal}
          onClose={() => setShowRefsModal(false)}
          story={{
            title: project.title,
            description: project.description,
            type: project.type,
            character: project.character,
            scenes: project.scenes.map(s => ({
              sceneNumber: parseInt(s.id.split('-')[1]) || 1,
              title: s.title,
              duration: s.duration,
              visualPrompt: s.prompt,
              voiceover: s.voiceover || '',
              cameraAngle: s.cameraAngle,
            })),
          }}
          projectId={projectId}
          onCharacterRefsGenerated={async (refUrls) => {
            // Reload character references after generation
            await loadCharacterReferences();
          }}
        />
      )}

      {/* Reference Selection Modal */}
      {selectedScene && (
        <ReferenceSelectionModal
          isOpen={showRefSelectModal}
          onClose={() => setShowRefSelectModal(false)}
          characterRefs={combinedRefs.map((ref) => ref.objectUrl)}
          selectedReference={
            selectedScene.referenceMode ??
            (scenes.findIndex((s) => s.id === selectedScene.id) === 0 ? 1 : 'previous')
          }
          onEditReference={async (refIndex) => {
            // Get the reference from combinedRefs
            if (refIndex >= 0 && refIndex < combinedRefs.length) {
              const selectedRef = combinedRefs[refIndex];

              console.log('🎨 [Edit Reference] Starting edit for reference:', {
                refIndex,
                assetId: selectedRef.assetId,
                objectUrl: selectedRef.objectUrl,
                hasAssetId: !!selectedRef.assetId
              });

              // Try to fetch the full Asset object
              if (selectedRef.assetId) {
                try {
                  console.log('📡 Fetching asset by ID:', selectedRef.assetId);
                  const response = await fetch(`/api/assets/${selectedRef.assetId}`);

                  if (response.ok) {
                    const asset = await response.json();
                    console.log('✅ Fetched asset for editing:', {
                      id: asset.id,
                      name: asset.name,
                      url: asset.url
                    });

                    // Parse dates and editHistory
                    const parsedAsset: Asset = {
                      ...asset,
                      createdAt: new Date(asset.createdAt),
                      updatedAt: new Date(asset.updatedAt),
                      editHistory: asset.editHistory.map((h: any) => ({
                        ...h,
                        timestamp: new Date(h.timestamp)
                      }))
                    };

                    // Open EditAssetModal with the asset
                    setAssetToEdit(parsedAsset);
                    setShowEditAssetModal(true);
                  } else {
                    console.error('❌ Failed to fetch asset:', response.status);
                    alert('Failed to load asset for editing. Please try again.');
                  }
                } catch (error) {
                  console.error('❌ Error fetching asset:', error);
                  alert('Failed to load asset for editing. Please try again.');
                }
              } else {
                // Legacy character ref without assetId
                console.warn('⚠️ Legacy character ref without assetId');
                alert('This reference cannot be edited. Please use the new asset system by uploading or generating new character references.');
              }
            }
          }}
          onSelectReference={async (ref) => {
            // Get the asset's persistent URL if a numbered reference is selected
            let firstFrameDataUrl: string | undefined = undefined;
            if (typeof ref === 'number') {
              const refIndex = ref - 1;
              if (refIndex >= 0 && refIndex < combinedRefs.length) {
                const selectedRef = combinedRefs[refIndex];

                console.log('🔍 [Asset Selection Debug] Selected reference:', {
                  refIndex,
                  assetId: selectedRef.assetId,
                  objectUrl: selectedRef.objectUrl,
                  hasAssetId: !!selectedRef.assetId
                });

                // If we have an assetId, try to fetch the real asset
                if (selectedRef.assetId) {
                  try {
                    console.log('📡 Attempting to fetch asset by ID:', selectedRef.assetId);
                    const response = await fetch(`/api/assets/${selectedRef.assetId}`);
                    console.log('📡 Asset fetch response:', response.status, response.ok);
                    if (response.ok) {
                      const asset = await response.json();
                      console.log('✅ Fetched asset:', {
                        id: asset.id,
                        url: asset.url
                      });
                      firstFrameDataUrl = asset.url; // Use asset.url, not asset.imageUrl
                    }
                  } catch (error) {
                    console.error('❌ Failed to fetch asset by assetId:', error);
                  }
                }

                // If no assetId or API fetch failed, try to find asset by matching URL
                if (!firstFrameDataUrl) {
                  console.log('🔍 No url from direct fetch, searching all assets...');
                  try {
                    const response = await fetch(`/api/assets?projectId=${projectId}`);
                    if (response.ok) {
                      const data = await response.json();
                      console.log('📦 All project assets:', {
                        count: data.assets?.length,
                        assets: data.assets?.map((a: Asset) => ({
                          id: a.id,
                          url: a.url
                        }))
                      });

                      // Find asset by checking if the blob URL or objectUrl contains the asset ID
                      const matchingAsset = data.assets?.find((a: Asset) => {
                        const urlMatch = selectedRef.objectUrl.includes(a.id);
                        const exactMatch = a.url === selectedRef.objectUrl;
                        console.log(`🔎 Checking asset ${a.id}:`, {
                          urlMatch,
                          exactMatch,
                          assetUrl: a.url,
                          selectedUrl: selectedRef.objectUrl
                        });
                        return urlMatch || exactMatch;
                      });

                      if (matchingAsset) {
                        console.log('✅ Found matching asset:', {
                          id: matchingAsset.id,
                          url: matchingAsset.url
                        });
                        firstFrameDataUrl = matchingAsset.url; // Use asset.url
                      } else {
                        console.log('❌ No matching asset found');
                      }
                    }
                  } catch (error) {
                    console.error('❌ Failed to find matching asset:', error);
                  }
                }

                // Last resort: use the objectUrl (might be blob or API URL)
                if (!firstFrameDataUrl) {
                  console.log('⚠️ Using fallback objectUrl:', selectedRef.objectUrl);
                  firstFrameDataUrl = selectedRef.objectUrl;
                }

                console.log('💾 Final firstFrameDataUrl to save:', firstFrameDataUrl);
              }
            }

            setProject((prevProject) => {
              if (!prevProject) return prevProject;

              return {
                ...prevProject,
                scenes: prevProject.scenes.map((s) =>
                  s.id === selectedScene.id
                    ? {
                        ...s,
                        referenceMode: ref,
                        // Set firstFrameDataUrl so homepage can use it for thumbnails
                        firstFrameDataUrl: firstFrameDataUrl ?? s.firstFrameDataUrl
                      }
                    : s
                ),
              };
            });
          }}
          sceneIndex={scenes.findIndex((s) => s.id === selectedScene.id)}
          previousSceneTitle={
            (() => {
              const sceneIndex = scenes.findIndex((s) => s.id === selectedScene.id);
              return sceneIndex > 0 ? scenes[sceneIndex - 1].title : undefined;
            })()
          }
          projectId={projectId}
        />
      )}

      {/* Project Settings Modal */}
      {project && (
        <ProjectSettingsModal
          isOpen={showProjectSettings}
          onClose={() => setShowProjectSettings(false)}
          projectName={project.title}
          projectDescription={project.description}
          aspectRatio={project.aspectRatio ?? AspectRatio.PORTRAIT}
          defaultModel={project.defaultModel ?? VeoModel.VEO}
          defaultResolution={project.defaultResolution ?? Resolution.P720}
          generationMetadata={project.generationMetadata}
          onSave={async (settings) => {
            try {
              // Update metadata (title, description)
              await fetch(`/api/stories/${projectId}/metadata`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: settings.title,
                  description: settings.description,
                }),
              });

              // Update config (aspectRatio, model, resolution)
              await fetch(`/api/stories/${projectId}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  aspectRatio: settings.aspectRatio,
                  defaultModel: settings.defaultModel,
                  defaultResolution: settings.defaultResolution,
                }),
              });

              // Update local state
              setProject((prevProject) => {
                if (!prevProject) return prevProject;
                return {
                  ...prevProject,
                  title: settings.title,
                  description: settings.description,
                  aspectRatio: settings.aspectRatio,
                  defaultModel: settings.defaultModel,
                  defaultResolution: settings.defaultResolution,
                };
              });
            } catch (error) {
              console.error('Failed to save project settings:', error);
              alert('Failed to save project settings. Please try again.');
            }
          }}
        />
      )}

      {/* Asset Picker Modal */}
      {selectedScene && (
        <AssetPickerModal
          isOpen={showAssetPicker}
          onClose={() => setShowAssetPicker(false)}
          projectId={projectId}
          sceneId={selectedScene.id}
          currentAttachments={selectedScene.attachedAssets || []}
          onSaveAttachments={handleSaveAssetAttachments}
        />
      )}

      {/* Edit Asset Modal */}
      {assetToEdit && (
        <EditAssetModal
          isOpen={showEditAssetModal}
          onClose={() => {
            setShowEditAssetModal(false);
            setAssetToEdit(null);
          }}
          asset={assetToEdit}
          projectId={projectId}
          onEditComplete={async () => {
            // Reload combined refs after editing
            setShowEditAssetModal(false);
            setAssetToEdit(null);

            // Reload assets from the AssetLoader
            try {
              const assetLoader = new AssetLoader(projectId);
              const loadedAssets = await assetLoader.loadAssets();
              const assetRefs = loadedAssets.map((asset: any) => ({
                objectUrl: asset.url,
                width: asset.width || 1024,
                height: asset.height || 1792,
              }));

              // Combine with existing character refs
              setCombinedRefs([...assetRefs, ...characterRefs]);
            } catch (error) {
              console.error('Failed to reload assets:', error);
            }
          }}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />

      {/* Video Result Selection Modal */}
      <VideoResultSelectionModal
        isOpen={showVideoResultModal}
        onClose={() => setShowVideoResultModal(false)}
        results={videoResults}
        onSelect={handleSelectVideoResult}
        isLoading={false}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Delete Story
                  </h3>
                  <p className="text-sm text-gray-600">
                    Are you sure you want to delete "{project?.title}"? This will permanently delete all scenes, videos, and associated files. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-200">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Story</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Script Preview Modal */}
      {showScriptPreview && project && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Preview Your Story</h2>
                  <p className="text-sm text-gray-500">Screenplay format</p>
                </div>
              </div>
              <button
                onClick={() => setShowScriptPreview(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Story Metadata */}
            <div className="px-6 py-4 border-b border-gray-200 bg-indigo-50 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {project.title}
              </h3>
              <p className="text-sm text-gray-700 mb-2">
                {project.description}
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                  {project.scenes.length} scenes
                </span>
                <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                  {project.scenes.reduce((sum, s) => sum + s.duration, 0)} seconds total
                </span>
                <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                  {project.aspectRatio} aspect ratio
                </span>
                {project.character && (
                  <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                    Character: {project.character}
                  </span>
                )}
              </div>
            </div>

            {/* Main Content: 2-Column Layout */}
            <div className="flex-1 overflow-hidden flex">
              {/* Left: Screenplay */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto">
                  <div className="screenplay">
                    <div className="screenplay-transition">FADE IN:</div>

                    {project.scenes.map((scene, index) => (
                      <div key={scene.id}>
                        <div className="screenplay-scene-heading">
                          {scene.title.toUpperCase()}
                        </div>

                        <div className="screenplay-action">{scene.prompt}</div>

                        {scene.voiceover && (
                          <>
                            <div className="screenplay-character">
                              {project.character?.toUpperCase() || 'CHARACTER'}
                            </div>
                            <div className="screenplay-dialogue">{scene.voiceover}</div>
                          </>
                        )}

                        {scene.cameraAngle && (
                          <div className="screenplay-action">
                            Camera: {scene.cameraAngle}
                          </div>
                        )}

                        {index < project.scenes.length - 1 && (
                          <div className="screenplay-transition">CUT TO:</div>
                        )}
                      </div>
                    ))}

                    <div className="screenplay-transition">FADE OUT.</div>
                  </div>
                </div>
              </div>

              {/* Right: Chat-based Refinement Panel */}
              <div className="w-96 border-l border-gray-200 bg-gray-50 flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Refine Your Story</h3>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Chat with AI to make changes
                  </p>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">
                        Start a conversation to refine your story
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        e.g., "Change the character's name" or "Add a new scene"
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.timestamp}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="space-y-2 max-w-[85%]">
                          {message.content && (
                            <div
                              className={`rounded-lg px-4 py-2.5 ${
                                message.role === 'user'
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white border border-gray-200 text-gray-900'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              <p
                                className={`text-xs mt-1 ${
                                  message.role === 'user' ? 'text-indigo-200' : 'text-gray-400'
                                }`}
                              >
                                {new Date(message.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Loading indicator */}
                  {isRefining && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-lg px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                          <p className="text-sm text-gray-600">Updating story...</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scroll anchor */}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (chatInput.trim() && !isRefining) {
                      editStory(chatInput);
                      setChatInput('');
                    }
                  }}
                  className="p-4 border-t border-gray-200 bg-white flex-shrink-0"
                >
                  <div className="flex gap-2">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (chatInput.trim() && !isRefining) {
                            editStory(chatInput);
                            setChatInput('');
                          }
                        }
                      }}
                      rows={1}
                      placeholder="Type your message... (Enter to send)"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      disabled={isRefining}
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isRefining}
                      className="px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      title="Send message (Enter)"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Playback Bar */}
      {project && selectedScene && (
        <PlaybackBar
          isPlaying={isPlaying}
          isPlayingAll={isPlayingAll}
          loopEnabled={loopEnabled}
          currentSceneIndex={scenes.findIndex((s) => s.id === selectedSceneId)}
          totalScenes={scenes.length}
          currentSceneTitle={selectedScene.title}
          onPlayPause={handlePlayPause}
          onPlayAll={handlePlayAll}
          onStop={handleStop}
          onToggleLoop={handleToggleLoop}
        />
      )}

      {/* Start Frame Editor Modal (AI-powered) */}
      {project && selectedScene && (
        <StartFrameEditorModal
          isOpen={showStartFrameEditor}
          onClose={() => setShowStartFrameEditor(false)}
          project={project}
          scene={selectedScene}
          sceneIndex={scenes.findIndex((s) => s.id === selectedSceneId)}
          mode={startFrameEditorMode}
          currentFrameUrl={(() => {
            // Get current frame URL for edit mode
            const currentRef = selectedScene.referenceMode ?? (scenes.findIndex((s) => s.id === selectedSceneId) === 0 ? 1 : 'previous');
            const isPrevious = currentRef === 'previous';

            if (!isPrevious && typeof currentRef === 'number') {
              const refIndex = currentRef - 1;
              if (combinedRefs[refIndex]) {
                return combinedRefs[refIndex].objectUrl;
              }
            } else if (isPrevious && scenes.findIndex((s) => s.id === selectedSceneId) > 0) {
              const sceneIndex = scenes.findIndex((s) => s.id === selectedSceneId);
              const previousScene = scenes[sceneIndex - 1];
              return previousScene.lastFrameUrl || previousScene.lastFrameDataUrl;
            }
            return undefined;
          })()}
          onPromptGenerated={async (prompt) => {
            try {
              console.log('[Start Frame Generator] Generating image with AI prompt:', prompt);

              // Generate image using Fal.ai
              const aspectRatio = project.aspectRatio || '9:16';
              const result = await generateImage({ prompt, aspectRatio });

              // Convert base64 to blob
              const byteCharacters = atob(result.imageBytes);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'image/png' });

              // Upload to assets API
              const formData = new FormData();
              formData.append('file', blob, `start-frame-${selectedSceneId}-${Date.now()}.png`);
              formData.append('projectId', project.id);
              formData.append('type', 'character');
              formData.append('category', 'characters');
              formData.append('name', `${selectedScene?.title || 'Scene'} - AI Generated Start Frame`);
              formData.append('description', 'AI-generated start frame');
              formData.append('provider', 'fal');
              formData.append('generationPrompt', prompt);

              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3039';
              const uploadResponse = await fetch(`${baseUrl}/api/assets/upload`, {
                method: 'POST',
                body: formData,
              });

              if (!uploadResponse.ok) {
                throw new Error('Failed to upload generated image');
              }

              const uploadedAsset = await uploadResponse.json();
              console.log('[Start Frame Generator] Image uploaded:', uploadedAsset.id);

              // Set as start frame for this scene
              setProject((prevProject) => {
                if (!prevProject) return prevProject;

                return {
                  ...prevProject,
                  scenes: prevProject.scenes.map((scene) =>
                    scene.id === selectedSceneId
                      ? {
                          ...scene,
                          referenceMode: uploadedAsset.id, // Asset ID instead of number
                        }
                      : scene
                  ),
                };
              });

              // Reload assets to show the new image
              const dbAssets = await AssetLoader.loadProjectAssets(projectId);
              const assetRefs = AssetLoader.assetsToAssetReferences(dbAssets);

              // Convert to full GeneratedImage format with blob data
              const newAssetImages: GeneratedImage[] = [];
              for (const assetRef of assetRefs) {
                try {
                  const response = await fetch(assetRef.objectUrl);
                  if (response.ok) {
                    const blob = await response.blob();
                    newAssetImages.push({
                      objectUrl: assetRef.objectUrl,
                      blob,
                      width: 1024,
                      height: 1792,
                    });
                  }
                } catch (error) {
                  console.warn(`Failed to load asset ${assetRef.id}:`, error);
                }
              }

              // Combine with existing character refs
              setCombinedRefs([...newAssetImages, ...characterRefs]);

              // Return the uploaded asset URL for preview in modal
              return uploadedAsset.url;
            } catch (error) {
              console.error('[Start Frame Generator] Error:', error);
              throw error;
            }
          }}
        />
      )}
    </div>
  );
};

export default SceneManager;
