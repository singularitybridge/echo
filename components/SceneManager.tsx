/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Loader2, Film, CheckCircle2, Settings, Settings2, MessageSquare, AlertCircle, Search, Copy, Check, ArrowLeft, X, Image as ImageIcon, Download, ImagePlus, HelpCircle, Paperclip, Radio, Trash2 } from 'lucide-react';
import { generateVideo, GeneratedVideo } from '../services/videoService';
import { GeneratedImage } from '../services/imageService';
import { VeoModel, AspectRatio, Resolution } from '../types';
import { evaluateVideo, extractFrameFromVideo } from '../services/evaluationService';
import { CostTracker } from './CostTracker';
import { videoStorage } from '../services/videoStorage.server';
import { evaluationStorage } from '../services/evaluationStorage.server';
import { projectStorage } from '../services/projectStorage.server';
import { Project, Scene, GenerationSettings, SceneAssetAttachment } from '../types/project';
import CharacterRefsModal from './CharacterRefsModal';
import { ReferenceSelectionModal } from './ReferenceSelectionModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { PlaybackBar } from './PlaybackBar';
import AssetPickerModal from './assets/AssetPickerModal';
import { AssetLoader } from '../utils/assetLoader';

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
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [evaluatingSceneIds, setEvaluatingSceneIds] = useState<Set<string>>(new Set());
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [showRefsModal, setShowRefsModal] = useState<boolean>(false);
  const [showRefSelectModal, setShowRefSelectModal] = useState<boolean>(false);
  const [showProjectSettings, setShowProjectSettings] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showAssetPicker, setShowAssetPicker] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

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

  // Load the specific project from API (merges runtime db + seed data)
  useEffect(() => {
    const loadProject = async () => {
      try {
        // Fetch all projects from API
        const response = await fetch('/api/projects');
        if (!response.ok) {
          setError(`Failed to load projects`);
          return;
        }

        const data = await response.json();
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

      // Use unified AssetLoader
      const legacyRefs = await AssetLoader.loadLegacyCharacterRefs(projectId, aspectRatio);

      // Convert to full GeneratedImage format with blob data for video generation
      const refs: GeneratedImage[] = [];
      for (const ref of legacyRefs) {
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
            });
          }
        } catch (err) {
          console.log(`Failed to load legacy ref: ${ref.objectUrl}`, err);
        }
      }

      setCharacterRefs(refs);
      console.log(`Loaded ${refs.length} ${aspectRatio} character reference images`);
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
            if (previousScene.lastFrameDataUrl) {
              startFrameDataUrl = previousScene.lastFrameDataUrl;
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
          if (previousScene.lastFrameDataUrl) {
            startFrameDataUrl = previousScene.lastFrameDataUrl;
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

      // Extract last frame from generated video for next scene's continuity
      const lastFrameDataUrl = await extractFrameFromVideo(video.blob, Math.max(0, scene.duration - 0.5));
      console.log('Extracted last frame from generated video for shot continuity');

      // Save video to server for persistence and get the server URL
      let serverUrl: string;
      try {
        serverUrl = await videoStorage.saveVideo(projectId, sceneId, video.blob);
        console.log(`Saved video for scene ${sceneId} in project ${projectId} to server`);
      } catch (saveErr) {
        console.error('Failed to save video to server:', saveErr);
        // Fall back to blob URL if server save fails
        serverUrl = video.objectUrl;
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
                  lastFrameDataUrl, // Store last frame for next scene
                  evaluation: undefined, // Clear previous evaluation
                }
              : s
          ),
        };
      });
    } catch (err) {
      console.error('Video generation failed:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to generate video'
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
      // Navigate back to home
      router.push('/');
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
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              <span className="text-sm font-medium">Story Settings</span>
            </button>
          )}

          {/* Export Video Button */}
          <button
            onClick={handleExportVideo}
            disabled={isExporting || !project?.scenes.some(s => s.generated && s.videoUrl)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export Video</span>
              </>
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
      <div className="flex flex-1 overflow-hidden">
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
              thumbnailUrl = previousScene.lastFrameDataUrl;
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
                <div className="bg-red-50 border border-red-300 rounded-lg p-2 max-w-md mb-2 mx-auto">
                  <p className="text-red-700 text-sm">{error}</p>
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
                  {selectedScene.videoUrl ? (
                    <video
                      ref={videoRef}
                      key={selectedScene.videoUrl}
                      className="max-h-full max-w-full rounded-lg shadow-2xl"
                    >
                      <source src={selectedScene.videoUrl} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12">
                      <Radio className="w-16 h-16 text-indigo-400 mb-4" />
                      <p className="text-gray-700 text-lg font-medium">No video generated</p>
                      <p className="text-gray-500 text-sm mt-2">Use the controls on the right to generate</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right Column - Scene Controls (1/4) */}
      <div className="w-1/4 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
        {selectedScene && (() => {
          const sceneIndex = scenes.findIndex((s) => s.id === selectedScene.id);
          return (
          <div className="p-4 space-y-4">
            {/* Scene Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {selectedScene.title}
              </h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                  {selectedScene.cameraAngle}
                </span>
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <Film className="w-3 h-3" />
                  {selectedScene.duration}s
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex items-center gap-2 mb-3">
                {selectedScene.generated ? (
                  <span className="px-2 py-1 bg-green-50 border border-green-200 rounded text-green-700 text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Generated
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 rounded text-gray-600 text-xs">
                    Not generated
                  </span>
                )}
                {selectedScene.evaluation && (
                  <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                    selectedScene.evaluation.overallScore >= 70
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : selectedScene.evaluation.overallScore >= 40
                      ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <Search className="w-3 h-3" />
                    {selectedScene.evaluation.overallScore}%
                  </span>
                )}
              </div>

              {/* Prompt */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Prompt</label>
                <div className="flex items-start gap-2">
                  <p className="text-sm text-gray-600 flex-1 bg-gray-50 rounded-lg p-2">{selectedScene.prompt}</p>
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Voiceover</label>
                  <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg p-2">
                    <MessageSquare className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-900 italic">&ldquo;{selectedScene.voiceover}&rdquo;</p>
                  </div>
                </div>
              )}

              {/* Reference Selection */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-2">Start Frame</label>
                <button
                  onClick={() => setShowRefSelectModal(true)}
                  className="w-full bg-white border-2 border-gray-200 hover:border-indigo-300 rounded-lg p-3 transition-all group text-left"
                >
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
                      imageUrl = previousScene.lastFrameDataUrl;
                    }

                    return (
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

                        {/* Label and Change Hint */}
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
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 group-hover:text-indigo-600 transition-colors">
                            <ImagePlus size={12} />
                            <span>Click to change</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </button>
              </div>

            </div>

            {/* Settings Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                showSettings ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              {showSettings ? 'Hide Settings' : 'Show Settings'}
            </button>

            {/* Settings Panel */}
            {showSettings && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                <h4 className="text-sm font-medium text-gray-900">Generation Settings</h4>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Model</label>
                  <select
                    value={currentSettings.model}
                    onChange={(e) => setCurrentSettings({ ...currentSettings, model: e.target.value as VeoModel })}
                    className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-900"
                  >
                    <option value={VeoModel.VEO}>Veo 3.1</option>
                  </select>
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

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => handleGenerateScene(selectedScene.id)}
                disabled={
                  combinedRefs.length === 0 ||
                  generatingSceneIds.has(selectedScene.id)
                }
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                {selectedScene.generated ? 'Regenerate Video' : 'Generate Video'}
              </button>

              <button
                onClick={() => handleEvaluateScene(selectedScene.id)}
                disabled={!selectedScene.videoUrl || evaluatingSceneIds.has(selectedScene.id)}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {evaluatingSceneIds.has(selectedScene.id) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Evaluate Video
                  </>
                )}
              </button>
            </div>

            {/* OpenAI API Key Input */}
            {!openaiApiKey && selectedScene.generated && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
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

            {/* Evaluation Results */}
            {selectedScene.evaluation && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Evaluation Results
                </h4>

                {/* Overall Score */}
                <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Overall Score</span>
                    <span className={`text-xl font-bold ${
                      selectedScene.evaluation.overallScore >= 70
                        ? 'text-green-600'
                        : selectedScene.evaluation.overallScore >= 40
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}>
                      {selectedScene.evaluation.overallScore}%
                    </span>
                  </div>
                </div>

                {/* Audio Score */}
                <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <h5 className="text-xs font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" />
                    Audio ({selectedScene.evaluation.audioEvaluation.score}%)
                  </h5>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-gray-500">Expected:</span>
                      <p className="text-gray-700 italic mt-0.5">&ldquo;{selectedScene.evaluation.audioEvaluation.expectedText}&rdquo;</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Transcribed:</span>
                      <p className="text-gray-700 mt-0.5">{selectedScene.evaluation.audioEvaluation.transcribedText}</p>
                    </div>
                  </div>
                </div>

                {/* Frame Scores */}
                <div className="space-y-2">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h5 className="text-xs font-medium text-gray-900 mb-2">
                      First Frame ({selectedScene.evaluation.firstFrameEvaluation.score}%)
                    </h5>
                    <img
                      src={selectedScene.evaluation.firstFrameEvaluation.imageUrl}
                      alt="First frame"
                      className="w-full rounded mb-2"
                    />
                    <p className="text-xs text-gray-600">
                      {selectedScene.evaluation.firstFrameEvaluation.analysis}
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h5 className="text-xs font-medium text-gray-900 mb-2">
                      Last Frame ({selectedScene.evaluation.lastFrameEvaluation.score}%)
                    </h5>
                    <img
                      src={selectedScene.evaluation.lastFrameEvaluation.imageUrl}
                      alt="Last frame"
                      className="w-full rounded mb-2"
                    />
                    <p className="text-xs text-gray-600">
                      {selectedScene.evaluation.lastFrameEvaluation.analysis}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          );
        })()}
      </div>
      </div>

      {/* Character Assets Modal */}
      {showRefsModal && (
        <CharacterRefsModal
          projectId={projectId}
          currentAspectRatio={currentSettings.aspectRatio}
          onClose={() => setShowRefsModal(false)}
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
          onSelectReference={(ref) => {
            setProject((prevProject) => {
              if (!prevProject) return prevProject;
              return {
                ...prevProject,
                scenes: prevProject.scenes.map((s) =>
                  s.id === selectedScene.id ? { ...s, referenceMode: ref } : s
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
          onSave={(settings) => {
            setProject((prevProject) => {
              if (!prevProject) return prevProject;
              const updatedProject = {
                ...prevProject,
                title: settings.title,
                description: settings.description,
                aspectRatio: settings.aspectRatio,
                defaultModel: settings.defaultModel,
                defaultResolution: settings.defaultResolution,
              };
              // Save to server
              projectStorage.saveProject(updatedProject);
              return updatedProject;
            });
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

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
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
    </div>
  );
};

export default SceneManager;
