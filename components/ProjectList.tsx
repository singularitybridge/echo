/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Video as VideoIcon, Package, Plus, User, Bot, LogOut, BookOpen } from 'lucide-react';
import { Project } from '../types/project';
import { StoryDraft } from '../types/story-creation';
import { Asset } from '../types/asset';
import CreateStoryModal from './CreateStoryModal';
import AssetGenerationFlowModal from './AssetGenerationFlowModal';

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssetGenerationModal, setShowAssetGenerationModal] = useState(false);
  const [currentStoryDraft, setCurrentStoryDraft] = useState<StoryDraft | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isGeneratingInBackground, setIsGeneratingInBackground] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('authToken');
    // Clear cookie
    document.cookie = 'authToken=; path=/; max-age=0';
    // Redirect to login
    router.push('/login');
  };

  useEffect(() => {
    const loadProjects = async () => {
      try {
        // Fetch all stories from new story storage API
        const response = await fetch('/api/stories');
        if (!response.ok) {
          console.error('Failed to load stories');
          setLoading(false);
          return;
        }

        const data = await response.json();

        // Convert story format to Project format for UI compatibility
        const loadedProjects: Project[] = (data.stories || []).map((story: any) => ({
          id: story.id,
          title: story.title,
          description: story.description,
          type: story.type,
          character: story.character,
          personaId: story.personaId,
          aspectRatio: story.aspectRatio,
          defaultModel: story.defaultModel,
          defaultResolution: story.defaultResolution,
          // Create empty scenes array with correct length for display
          scenes: Array(story.sceneCount || 0).fill(null).map((_, i) => ({
            id: `scene-${i + 1}`,
            title: '',
            duration: 8,
            prompt: '',
            cameraAngle: '',
            voiceover: '',
            generated: false,
          })),
          createdAt: story.createdAt,
          updatedAt: story.updatedAt,
          tags: story.tags || [],
        }));

        setProjects(loadedProjects);

        // Load thumbnails for each project
        await loadProjectThumbnails(loadedProjects);

        setLoading(false);
      } catch (err) {
        console.error('Failed to load stories:', err);
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const loadProjectThumbnails = async (projects: Project[]) => {
    const thumbnailMap: Record<string, string> = {};

    for (const project of projects) {
      try {
        // Try to get first scene's video frame from story API
        const storyResponse = await fetch(`/api/stories/${project.id}`);
        if (storyResponse.ok) {
          const story = await storyResponse.json();
          const firstScene = story.script?.scenes?.[0];

          // First priority: Use firstFrameDataUrl if available (start frame of video)
          // Skip blob URLs as they don't persist across sessions
          if (firstScene?.firstFrameDataUrl && !firstScene.firstFrameDataUrl.startsWith('blob:')) {
            thumbnailMap[project.id] = firstScene.firstFrameDataUrl;
            continue;
          }

          // Second priority: Use video URL's first frame if available
          if (firstScene?.videoUrl) {
            thumbnailMap[project.id] = firstScene.videoUrl;
            continue;
          }

          // Third priority: Use attached storyboard asset from first scene
          const storyboardAsset = firstScene?.attachedAssets?.find(
            (a: any) => a.role === 'storyboard-frame' && a.url
          );
          if (storyboardAsset?.url) {
            thumbnailMap[project.id] = storyboardAsset.url;
            continue;
          }
        }
      } catch (err) {
        // Continue to fallback options
      }

      try {
        // Fallback 1: Storyboard assets from story storage
        const storyboardResponse = await fetch(`/api/stories/${project.id}/assets?type=storyboard`);
        if (storyboardResponse.ok) {
          const data = await storyboardResponse.json();
          const storyboardAssets = data.assets?.storyboards || [];

          if (storyboardAssets.length > 0) {
            const firstAsset = storyboardAssets[0];
            const filename = firstAsset.split('/').pop();
            thumbnailMap[project.id] = `/api/stories/${project.id}/assets/storyboards/${filename}`;
            continue;
          }
        }
      } catch (err) {
        // Continue to next fallback
      }

      try {
        // Fallback 2: Character assets from new storage
        const response = await fetch(`/api/stories/${project.id}/assets?type=character`);
        if (response.ok) {
          const data = await response.json();
          const characterAssets = data.assets?.characters || [];

          if (characterAssets.length > 0) {
            const firstAsset = characterAssets[0];
            const filename = firstAsset.split('/').pop();
            thumbnailMap[project.id] = `/api/stories/${project.id}/assets/characters/${filename}`;
            continue;
          }
        }
      } catch (err) {
        // Continue to next fallback
      }

      // Fallback 3: Check old generated-refs location
      const isPortrait = project.aspectRatio === '9:16';
      const oldRefPath = isPortrait
        ? `/generated-refs/${project.id}/character-ref-portrait-1.png`
        : `/generated-refs/${project.id}/character-ref-1.png`;

      try {
        const response = await fetch(oldRefPath, { method: 'HEAD' });
        if (response.ok) {
          thumbnailMap[project.id] = oldRefPath;
        }
      } catch (err) {
        // No thumbnail available
      }
    }

    setThumbnails(thumbnailMap);
  };

  const handleStoryCreated = async (story: StoryDraft) => {
    setShowCreateModal(false);
    setCurrentStoryDraft(story);
    setShowAssetGenerationModal(true);
  };

  const handleBackToStoryEdit = () => {
    setShowAssetGenerationModal(false);
    setShowCreateModal(true);
    // currentStoryDraft is preserved so user can continue editing
  };

  const handleMinimizeAssetGeneration = () => {
    setShowAssetGenerationModal(false);
    setIsGeneratingInBackground(true);
    // currentStoryDraft is preserved so generation can complete in background
  };

  const handleReopenAssetGeneration = () => {
    setIsGeneratingInBackground(false);
    setShowAssetGenerationModal(true);
  };

  const handleAssetsGenerated = async (assets: Asset[]) => {
    if (!currentStoryDraft) {
      console.error('No story draft available');
      return;
    }

    setShowAssetGenerationModal(false);
    setIsGeneratingInBackground(false);
    setIsCreatingProject(true);

    try {
      // Create story using new story storage API
      console.log('Creating story with generated assets...');

      // Prepare scenes with storyboard frame references
      // Each scene gets its own storyboard asset as reference (indexed by scene position)
      // Storyboards are loaded into combinedRefs in scene order, so scene 1 uses ref 1, scene 2 uses ref 2, etc.
      let storyboardRefIndex = 0;
      const scenesWithAssets = currentStoryDraft.scenes.map((scene, index) => {
        // Find matching storyboard asset for this scene
        const storyboardAsset = assets.find(a => a.usedInScenes?.includes(scene.id));

        // If this scene has a storyboard, assign incrementing reference index
        let referenceMode: 'previous' | number;
        if (storyboardAsset) {
          storyboardRefIndex++;
          referenceMode = storyboardRefIndex; // 1-based index matching asset order
        } else {
          referenceMode = index === 0 ? 1 : 'previous';
        }

        return {
          ...scene,
          referenceMode,
          attachedAssets: scene.attachedAssets || [],
          // Preserve the imagePrompt from the storyboard asset if scene doesn't have one
          imagePrompt: scene.imagePrompt || storyboardAsset?.generationPrompt,
        };
      });

      const storyRequest = {
        title: currentStoryDraft.projectMetadata.title,
        description: currentStoryDraft.projectMetadata.description,
        type: currentStoryDraft.projectMetadata.type,
        character: currentStoryDraft.projectMetadata.character,
        personaId: currentStoryDraft.projectMetadata.personaId, // Director persona for style
        script: {
          scenes: scenesWithAssets,
        },
        config: {
          aspectRatio: currentStoryDraft.projectMetadata.aspectRatio,
          defaultModel: currentStoryDraft.projectMetadata.defaultModel,
          defaultResolution: currentStoryDraft.projectMetadata.defaultResolution,
          characterReferences: [],
        },
        tags: [],
        generationMetadata: currentStoryDraft.generationMetadata,
      };

      const storyResponse = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyRequest),
      });

      if (!storyResponse.ok) {
        const errorData = await storyResponse.json().catch(() => ({}));
        const errorMsg = errorData.error || 'Failed to create story';

        // If story already exists, redirect to it
        if (errorMsg.includes('already exists')) {
          // Extract story ID from error message: 'Story with ID "story-id-2025" already exists'
          const match = errorMsg.match(/"([^"]+)"/);
          const existingStoryId = match ? match[1] : storyRequest.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-') + '-' + new Date().getFullYear();
          console.log('Story already exists, redirecting to:', existingStoryId);
          router.push(`/projects/${existingStoryId}`);
          return;
        }

        throw new Error(errorMsg);
      }

      const storyResult = await storyResponse.json();
      const storyId = storyResult.story.metadata.id;

      console.log('Story created successfully:', storyId);

      // Upload generated storyboard assets to story storage
      if (assets && assets.length > 0) {
        console.log('Uploading storyboard assets to story storage...');

        // Map to track uploaded asset URLs by scene ID
        const uploadedAssetUrls: Record<string, string> = {};

        for (let i = 0; i < assets.length; i++) {
          const asset = assets[i];
          const sceneId = asset.usedInScenes?.[0];

          try {
            // Convert blob URL to base64 data URL
            const blobResponse = await fetch(asset.url);
            const blob = await blobResponse.blob();

            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            // Upload as storyboard type with scene reference
            const filename = sceneId
              ? `storyboard-${sceneId}.png`
              : `storyboard-frame-${i + 1}.png`;

            const assetResponse = await fetch(`/api/stories/${storyId}/assets`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'storyboard',
                filename,
                imageBase64: base64,
                sceneId, // Include scene association
              }),
            });

            if (!assetResponse.ok) {
              console.warn(`Failed to upload storyboard asset for ${sceneId || `frame ${i + 1}`}`);
            } else {
              const uploadResult = await assetResponse.json();
              console.log(`Storyboard asset uploaded: ${filename}`);

              // Store the uploaded URL for this scene
              if (sceneId && uploadResult.url) {
                uploadedAssetUrls[sceneId] = uploadResult.url;
              }
            }
          } catch (err) {
            console.warn(`Error uploading storyboard asset:`, err);
          }
        }

        // Update scenes with the uploaded asset URLs
        if (Object.keys(uploadedAssetUrls).length > 0) {
          console.log('Updating scenes with storyboard asset URLs...');

          const updatedScenes = scenesWithAssets.map((scene, index) => {
            const uploadedUrl = uploadedAssetUrls[scene.id];
            if (uploadedUrl) {
              return {
                ...scene,
                attachedAssets: [{
                  assetId: `storyboard-${scene.id}`,
                  url: uploadedUrl,
                  role: 'storyboard-frame',
                  order: 0,
                }],
                referenceMode: 1, // Use the storyboard frame as reference
              };
            }
            return scene;
          });

          // Update the story with scene asset references
          await fetch(`/api/stories/${storyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              script: { scenes: updatedScenes },
            }),
          });
        }

        console.log('Storyboard assets uploaded successfully');
      }

      // Navigate to the new story
      router.push(`/projects/${storyId}`);
    } catch (error) {
      console.error('Error creating story:', error);
      alert('Failed to create story. Please try again.');
      setIsCreatingProject(false);
    } finally {
      setCurrentStoryDraft(null);
    }
  };

  const getProjectIcon = (type: string) => {
    switch (type) {
      case 'movie':
        return <Film className="w-8 h-8" />;
      case 'short':
        return <VideoIcon className="w-8 h-8" />;
      case 'commercial':
        return <Package className="w-8 h-8" />;
      default:
        return <Film className="w-8 h-8" />;
    }
  };

  const getProjectTypeBadge = (type: string) => {
    const colors = {
      movie: 'bg-purple-100/90 text-purple-700',
      short: 'bg-blue-100/90 text-blue-700',
      commercial: 'bg-green-100/90 text-green-700',
    };
    return colors[type as keyof typeof colors] || colors.movie;
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-purple-600" />
          <p className="text-gray-600 text-sm">Loading stories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-start">
              <h1 className="text-4xl font-[var(--font-logo)] font-light tracking-wide text-slate-600">echo:</h1>
              <p className="text-sm text-gray-400">
                ai video studio by <span className="bg-gradient-to-r from-gray-500 to-gray-300 bg-clip-text text-transparent">95% ai</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/docs')}
                className="p-2.5 text-gray-600 hover:text-gray-900 transition-all hover:scale-105 cursor-pointer"
                title="Documentation"
                aria-label="Documentation"
              >
                <BookOpen className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push('/agents')}
                className="p-2.5 text-gray-600 hover:text-gray-900 transition-all hover:scale-105 cursor-pointer"
                title="AI Agents"
                aria-label="AI Agents"
              >
                <Bot className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-2.5 text-indigo-600 hover:text-indigo-700 transition-all hover:scale-105 cursor-pointer"
                title="Create New Story"
                aria-label="Create New Story"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2.5 text-gray-600 hover:text-red-600 transition-all hover:scale-105 cursor-pointer"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Project Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8 pt-28">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const thumbnail = thumbnails[project.id];

            return (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-purple-300 hover:shadow-xl cursor-pointer transition-all group"
              >
                {/* Thumbnail Section */}
                <div className="relative w-full bg-gray-100">
                  {thumbnail ? (
                    <div className="relative w-full aspect-[9/16] overflow-hidden">
                      {thumbnail.endsWith('.mp4') ? (
                        <video
                          src={thumbnail}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={thumbnail}
                          alt={project.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      {/* Gradient overlay for better text contrast */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {/* Type badge overlay */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm ${getProjectTypeBadge(
                            project.type
                          )}`}
                        >
                          {project.type}
                        </span>
                      </div>

                      {/* Title, Description, and Stats overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="text-xl font-semibold text-white mb-2 drop-shadow-lg">
                          {project.title}
                        </h3>
                        <p className="text-white/90 text-sm mb-3 line-clamp-2 drop-shadow">
                          {project.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-white/80">
                          <div className="flex items-center gap-1.5">
                            <VideoIcon className="w-3.5 h-3.5" />
                            <span>{project.scenes.length} scenes</span>
                          </div>
                          {project.character && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" />
                              <span className="truncate">
                                {typeof project.character === 'string'
                                  ? project.character
                                  : (project.character as any).name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Fallback when no thumbnail exists
                    <div className="relative w-full aspect-[9/16] bg-gray-100 flex flex-col">
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className="p-4 bg-white rounded-xl mb-3 inline-block shadow-sm">
                            {getProjectIcon(project.type)}
                          </div>
                        </div>
                      </div>

                      {/* Type badge overlay */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${getProjectTypeBadge(
                            project.type
                          )}`}
                        >
                          {project.type}
                        </span>
                      </div>

                      {/* Content overlay for cards without thumbnails */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-900/80 to-transparent">
                        <h3 className="text-lg font-semibold text-white mb-2 drop-shadow">
                          {project.title}
                        </h3>
                        <p className="text-white/90 text-sm mb-3 line-clamp-2">
                          {project.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-white/80">
                          <div className="flex items-center gap-1.5">
                            <VideoIcon className="w-3.5 h-3.5" />
                            <span>{project.scenes.length} scenes</span>
                          </div>
                          {project.character && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" />
                              <span className="truncate">
                                {typeof project.character === 'string'
                                  ? project.character
                                  : (project.character as any).name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-16">
            <div className="mb-6">
              <img
                src="/empty-state.png"
                alt="No stories"
                className="w-64 h-64 mx-auto"
              />
            </div>
            <p className="text-gray-600 text-lg font-medium">No stories found</p>
            <p className="text-gray-500 text-sm mt-1">Create your first story to get started</p>
          </div>
        )}
      </main>

      {/* Story Creation Modal */}
      <CreateStoryModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          // Only clear draft when user explicitly closes without going to asset generation
          if (!showAssetGenerationModal) {
            setCurrentStoryDraft(null);
          }
        }}
        onStoryCreated={handleStoryCreated}
        initialDraft={currentStoryDraft}
      />

      {/* Asset Generation Modal */}
      {currentStoryDraft && (
        <AssetGenerationFlowModal
          isOpen={showAssetGenerationModal}
          onClose={() => {
            setShowAssetGenerationModal(false);
            setCurrentStoryDraft(null);
            setIsGeneratingInBackground(false);
          }}
          onBack={handleBackToStoryEdit}
          onMinimize={handleMinimizeAssetGeneration}
          storyDraft={currentStoryDraft}
          onComplete={handleAssetsGenerated}
        />
      )}

      {/* Creating Story Loading Overlay */}
      {isCreatingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-indigo-600" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Creating Your Story
                </h3>
                <p className="text-sm text-gray-600">
                  Setting up your story with generated assets...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Background Generation Progress Notification */}
      {isGeneratingInBackground && (
        <div
          onClick={handleReopenAssetGeneration}
          className="fixed bottom-6 right-6 bg-white rounded-xl shadow-2xl p-4 max-w-sm cursor-pointer hover:shadow-3xl transition-all z-50 border border-gray-200 hover:border-indigo-300"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-200 border-t-indigo-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                Generating Assets
              </h4>
              <p className="text-xs text-gray-600">
                Character designs are being created in the background. Click to view progress.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
