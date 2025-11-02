/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import {useState, useEffect, useRef} from 'react';
import {
  X,
  Sparkles,
  Lightbulb,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Edit3,
  Film,
  Check,
  RefreshCw,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  Genre,
  StoryType,
  Energy,
  QuickPathParams,
  CustomPathParams,
  StoryDraft,
  GeneratedScene,
} from '../types/story-creation';
import UploadAssetModal from './assets/UploadAssetModal';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: (story: StoryDraft) => void;
}

type Step = 'choice' | 'quick' | 'custom' | 'character-method' | 'edit';

export default function CreateStoryModal({
  isOpen,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const [step, setStep] = useState<Step>('choice');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Path state
  const [genre, setGenre] = useState<Genre | null>(null);
  const [storyType, setStoryType] = useState<StoryType | null>(null);
  const [energy, setEnergy] = useState<Energy | null>(null);

  // Custom Path state
  const [concept, setConcept] = useState('');
  const [character, setCharacter] = useState('');
  const [mood, setMood] = useState('');

  // Character creation method
  const [characterMethod, setCharacterMethod] = useState<'upload' | 'generate' | null>(null);
  const [uploadedCharacterAssetId, setUploadedCharacterAssetId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Generated story (for editing)
  const [storyDraft, setStoryDraft] = useState<StoryDraft | null>(null);

  // Track the original generation mode and params for refinement
  const [generationMode, setGenerationMode] = useState<'quick' | 'custom'>('quick');
  const [originalParams, setOriginalParams] = useState<QuickPathParams | CustomPathParams | null>(null);

  // Edit messages for chat-like experience
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant'; content: string; timestamp: number}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Edit story using simple POST request (no AI SDK streaming needed)
  const editStory = async (editRequest: string) => {
    if (!storyDraft) return;

    setIsRefining(true);

    // Add user message to chat
    setMessages(prev => [...prev, {role: 'user', content: editRequest, timestamp: Date.now()}]);

    try {
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

      // Update story with edited version
      setStoryDraft(result.updatedStory);

      // Add assistant response to chat
      setMessages(prev => [...prev, {role: 'assistant', content: result.response, timestamp: Date.now()}]);

      console.log('[CreateStoryModal] Edit successful:', result.changesSummary);
    } catch (error) {
      console.error('[CreateStoryModal] Edit error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error while editing the story. Please try again.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsRefining(false);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages]);

  const handleChooseQuick = () => {
    setStep('quick');
    setError(null);
  };

  const handleChooseCustom = () => {
    setStep('custom');
    setError(null);
  };

  const handleBack = () => {
    if (step === 'edit') {
      setStoryDraft(null);
      if (generationMode === 'custom') {
        setStep('character-method');
      } else {
        setStep('quick');
      }
    } else if (step === 'character-method') {
      setStep('custom');
    } else if (step === 'quick' || step === 'custom') {
      setStep('choice');
    } else {
      setStep('choice');
    }
    setError(null);
  };

  const handleGenerateQuick = async () => {
    if (!genre || !storyType || !energy) return;

    setIsGenerating(true);
    setError(null);

    const params = {genre, type: storyType, energy} as QuickPathParams;

    try {
      const response = await fetch('/api/story/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          mode: 'quick',
          params,
        }),
      });

      const data = await response.json();

      if (data.success && data.story) {
        setStoryDraft(data.story);
        setGenerationMode('quick');
        setOriginalParams(params);
        setStep('edit');
      } else {
        setError(data.error || 'Failed to generate story');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Story generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCustom = async () => {
    if (!concept.trim()) return;

    setIsGenerating(true);
    setError(null);

    const params = {
      concept: concept.trim(),
      character: character.trim() || undefined,
      mood: mood.trim() || undefined,
    } as CustomPathParams;

    try {
      const response = await fetch('/api/story/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          mode: 'custom',
          params,
        }),
      });

      const data = await response.json();

      if (data.success && data.story) {
        setStoryDraft(data.story);
        setGenerationMode('custom');
        setOriginalParams(params);
        setStep('edit');
      } else {
        setError(data.error || 'Failed to generate story');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Story generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateStory = (updates: Partial<StoryDraft['projectMetadata']>) => {
    if (!storyDraft) return;
    setStoryDraft({
      ...storyDraft,
      projectMetadata: {
        ...storyDraft.projectMetadata,
        ...updates,
      },
    });
  };

  const handleUpdateScene = (sceneIndex: number, updates: Partial<GeneratedScene>) => {
    if (!storyDraft) return;
    const updatedScenes = [...storyDraft.scenes];
    updatedScenes[sceneIndex] = {
      ...updatedScenes[sceneIndex],
      ...updates,
    };
    setStoryDraft({
      ...storyDraft,
      scenes: updatedScenes,
    });
  };

  const handleCreateProject = () => {
    if (!storyDraft) return;
    onStoryCreated(storyDraft);
    handleClose();
  };

  const handleClose = () => {
    setStep('choice');
    setGenre(null);
    setStoryType(null);
    setEnergy(null);
    setConcept('');
    setCharacter('');
    setMood('');
    setCharacterMethod(null);
    setUploadedCharacterAssetId(null);
    setShowUploadModal(false);
    setStoryDraft(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white rounded-xl shadow-xl w-full ${
          step === 'edit'
            ? 'max-w-7xl h-[90vh] overflow-hidden flex flex-col'
            : 'max-w-4xl h-[90vh] overflow-hidden flex flex-col'
        }`}
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'choice' && (
              <button
                onClick={handleBack}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isGenerating}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {step === 'choice' && 'Create New Story'}
                  {step === 'quick' && 'Quick Start'}
                  {step === 'custom' && 'Custom Story'}
                  {step === 'character-method' && 'Character Setup'}
                  {step === 'edit' && 'Preview Your Story'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {step === 'choice' && 'Choose your creative approach'}
                  {step === 'quick' && 'Select genre, type, and energy'}
                  {step === 'custom' && 'Describe your concept'}
                  {step === 'character-method' && 'Upload or generate character'}
                  {step === 'edit' && 'Review your generated screenplay'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isGenerating}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className={step === 'edit' ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 overflow-y-auto p-8'}>
          {/* Step 1: Choice */}
          {step === 'choice' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Quick Start Card */}
              <div
                className="group relative bg-gradient-to-br from-indigo-50 to-white border-2 border-indigo-200 rounded-xl p-6 hover:shadow-xl transition-all cursor-pointer"
                onClick={handleChooseQuick}
              >
                <div className="flex flex-col h-full">
                  <div className="mb-4">
                    <div className="w-full h-40 rounded-xl overflow-hidden mb-4 bg-white">
                      <img
                        src="/docs/quick-start-illustration-16x9.png"
                        alt="Quick Start"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Quick Start</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      AI generates a complete story from genre and mood selections. Perfect when
                      inspiration strikes.
                    </p>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Pick genre & energy level</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>AI crafts complete story</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Ready in ~30 seconds</span>
                    </div>
                  </div>

                  <button
                    onClick={handleChooseQuick}
                    className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors group-hover:shadow-lg"
                  >
                    Get Started
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Custom Story Card */}
              <div
                className="group relative bg-gradient-to-br from-purple-50 to-white border-2 border-purple-200 rounded-xl p-6 hover:shadow-xl transition-all cursor-pointer"
                onClick={handleChooseCustom}
              >
                <div className="flex flex-col h-full">
                  <div className="mb-4">
                    <div className="w-full h-40 rounded-xl overflow-hidden mb-4 bg-white">
                      <img
                        src="/docs/custom-story-illustration-16x9.png"
                        alt="Custom Story"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Custom Story</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Describe your vision and AI crafts a tailored story. Full creative control over
                      concept and characters.
                    </p>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Describe your concept</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>More creative freedom</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Ready in ~45 seconds</span>
                    </div>
                  </div>

                  <button
                    onClick={handleChooseCustom}
                    className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors group-hover:shadow-lg"
                  >
                    Start Creating
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Quick Start Form */}
          {step === 'quick' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Genre Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Genre <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {value: 'drama', label: 'Drama', desc: 'Emotional & heartfelt', image: 'princess-drama.png'},
                    {value: 'action', label: 'Action', desc: 'Fast-paced & thrilling', image: 'princess-action.png'},
                    {value: 'comedy', label: 'Comedy', desc: 'Light & funny', image: 'princess-comedy.png'},
                    {value: 'horror', label: 'Horror', desc: 'Dark & suspenseful', image: 'princess-horror.png'},
                  ].map((g) => (
                    <button
                      key={g.value}
                      onClick={() => setGenre(g.value as Genre)}
                      className={`p-4 border-2 rounded-lg transition-all text-left ${
                        genre === g.value
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={`/docs/${g.image}`}
                            alt={g.label}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{g.label}</div>
                          <div className="text-xs text-gray-500">{g.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Story Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Story Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {value: 'character-journey', label: 'Character Journey', image: 'princess-character-journey.png'},
                    {value: 'situation', label: 'Situation', image: 'princess-situation.png'},
                    {value: 'discovery', label: 'Discovery', image: 'princess-discovery.png'},
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setStoryType(type.value as StoryType)}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        storyType === type.value
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-2 rounded-lg overflow-hidden">
                          <img
                            src={`/docs/${type.image}`}
                            alt={type.label}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="font-medium text-sm text-gray-900">{type.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Energy <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {value: 'fast', label: 'Fast', desc: 'Quick cuts & action', image: 'princess-fast.png'},
                    {value: 'medium', label: 'Medium', desc: 'Balanced pacing', image: 'princess-medium.png'},
                    {value: 'contemplative', label: 'Contemplative', desc: 'Slower & thoughtful', image: 'princess-contemplative.png'},
                  ].map((e) => (
                    <button
                      key={e.value}
                      onClick={() => setEnergy(e.value as Energy)}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        energy === e.value
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-2 rounded-lg overflow-hidden">
                          <img
                            src={`/docs/${e.image}`}
                            alt={e.label}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="font-medium text-sm text-gray-900">{e.label}</div>
                        <div className="text-xs text-gray-500 mt-1">{e.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Character Method Selection */}
          {step === 'character-method' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How would you like to create your character?
                </h3>
                <p className="text-sm text-gray-600">
                  Upload a photo or let AI generate character references
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Upload Character Card */}
                <button
                  onClick={() => {
                    setCharacterMethod('upload');
                    setShowUploadModal(true);
                  }}
                  className={`group relative bg-gradient-to-br from-blue-50 to-white border-2 rounded-xl p-6 hover:shadow-xl transition-all text-left ${
                    characterMethod === 'upload' && uploadedCharacterAssetId
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-blue-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex flex-col h-full">
                    <div className="mb-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <Upload className="w-8 h-8 text-blue-600" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 mb-2">Upload Photo</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Use your own character image or photo for reference
                      </p>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>Use your own images</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>Full creative control</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>Instant results</span>
                      </div>
                    </div>

                    {characterMethod === 'upload' && uploadedCharacterAssetId && (
                      <div className="mt-auto p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <Check className="w-4 h-4" />
                          <span className="font-medium">Character uploaded</span>
                        </div>
                      </div>
                    )}
                  </div>
                </button>

                {/* Generate Character Card */}
                <button
                  onClick={() => {
                    setCharacterMethod('generate');
                  }}
                  className={`group relative bg-gradient-to-br from-purple-50 to-white border-2 rounded-xl p-6 hover:shadow-xl transition-all text-left ${
                    characterMethod === 'generate'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-purple-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex flex-col h-full">
                    <div className="mb-4">
                      <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                        <Wand2 className="w-8 h-8 text-purple-600" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 mb-2">Generate with AI</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Let AI create character references based on your description
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>AI-generated art</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>Multiple variations</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>Perfect consistency</span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Custom Story Form */}
          {step === 'custom' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Illustration */}
              <div className="w-full h-48 rounded-xl overflow-hidden bg-white border border-gray-100">
                <img
                  src="/docs/custom-story-form-illustration-16x9.png"
                  alt="Custom Story Creation"
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Story Concept <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="e.g., A young artist discovers a magical paintbrush that brings paintings to life"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Character <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={character}
                  onChange={(e) => setCharacter(e.target.value)}
                  placeholder="e.g., Maya, a shy but talented 12-year-old painter"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Mood/Tone <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="e.g., Whimsical and wonder-filled"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Edit Story - Screenplay Review */}
          {step === 'edit' && storyDraft && (
            <>
              {/* Story Metadata */}
              <div className="px-6 py-4 border-b border-gray-200 bg-indigo-50 flex-shrink-0">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {storyDraft.projectMetadata.title}
                </h3>
                <p className="text-sm text-gray-700 mb-2">
                  {storyDraft.projectMetadata.description}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                    {storyDraft.scenes.length} scenes
                  </span>
                  <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                    ~{storyDraft.scenes.reduce((sum, s) => sum + (s.duration || 8), 0)} seconds
                  </span>
                  {storyDraft.projectMetadata.character && (
                    <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                      {storyDraft.projectMetadata.character}
                    </span>
                  )}
                </div>
              </div>

              {/* Main Content: 2-Column Layout */}
              <div className="flex-1 overflow-hidden flex">
                {/* Left: Screenplay */}
                <div className="flex-1 overflow-y-auto p-8">
                  <div className="screenplay">
                    <div className="screenplay-transition">FADE IN:</div>

                    {storyDraft.scenes.map((scene, index) => (
                      <div key={scene.id}>
                        <div className="screenplay-scene-heading">
                          {scene.title.toUpperCase()}
                        </div>

                        <div className="screenplay-action">{scene.prompt}</div>

                        {scene.voiceover && (
                          <>
                            <div className="screenplay-character">
                              {storyDraft.projectMetadata.character?.toUpperCase() || 'CHARACTER'}
                            </div>
                            <div className="screenplay-dialogue">{scene.voiceover}</div>
                          </>
                        )}

                        {scene.cameraAngle && (
                          <div className="screenplay-action">
                            Camera: {scene.cameraAngle}
                          </div>
                        )}

                        {index < storyDraft.scenes.length - 1 && (
                          <div className="screenplay-transition">CUT TO:</div>
                        )}
                      </div>
                    ))}

                    <div className="screenplay-transition">FADE OUT.</div>
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
                          e.g., "Change the hero's name to Alex"
                        </p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.timestamp}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className="space-y-2 max-w-[85%]">
                            {/* User message or assistant text */}
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

                            {/* Tool invocations - show before assistant message */}
                            {message.role === 'assistant' && message.toolInvocations && message.toolInvocations.length > 0 && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                                {message.toolInvocations.map((tool: any, index: number) => (
                                  <div key={index}>
                                    <div className="flex items-start gap-2">
                                      <Edit3 className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-amber-900">
                                          Script Edit: {tool.args?.action || 'Modifying story'}
                                        </p>
                                        {tool.state === 'result' && tool.result && (
                                          <div className="mt-1 space-y-0.5 text-xs text-amber-700">
                                            {tool.result.scenesAdded > 0 && (
                                              <p>• Added {tool.result.scenesAdded} scene(s)</p>
                                            )}
                                            {tool.result.scenesRemoved > 0 && (
                                              <p>• Removed {tool.result.scenesRemoved} scene(s)</p>
                                            )}
                                            {tool.result.scenesModified > 0 && (
                                              <p>• Modified {tool.result.scenesModified} scene(s)</p>
                                            )}
                                            {tool.result.titleChanged && (
                                              <p>• Updated title</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
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
                          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            e.preventDefault();
                            if (chatInput.trim() && !isRefining) {
                              editStory(chatInput);
                              setChatInput('');
                            }
                          }
                        }}
                        rows={2}
                        placeholder="Type your message... (Cmd+Enter to send)"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        disabled={isRefining}
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || isRefining}
                        className="px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        title="Send message (Cmd+Enter)"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateProject}
                    className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Save & Create Project
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer - Show for all steps except edit (which has its own footer) */}
        {step !== 'edit' && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            {/* Back button - show for quick, custom, and character-method steps */}
            {step === 'quick' && (
              <button
                onClick={() => setStep('choice')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}

            {step === 'custom' && (
              <button
                onClick={() => setStep('choice')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}

            {step === 'character-method' && (
              <button
                onClick={() => setStep('custom')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}

            {/* Spacer for choice step (no back button) */}
            {step === 'choice' && <div />}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>

              {/* Generate Story button for quick and custom steps */}
              {step === 'quick' && (
                <button
                  onClick={handleGenerateQuick}
                  disabled={!genre || !storyType || !energy || isGenerating}
                  className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Story
                    </>
                  )}
                </button>
              )}

              {step === 'custom' && (
                <button
                  onClick={() => setStep('character-method')}
                  disabled={!concept.trim()}
                  className="px-6 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <ChevronRight className="w-4 h-4" />
                  Continue
                </button>
              )}

              {step === 'character-method' && (
                <button
                  onClick={handleGenerateCustom}
                  disabled={!characterMethod || isGenerating}
                  className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Story
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Asset Modal */}
      {showUploadModal && (
        <UploadAssetModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          projectId={storyDraft?.projectMetadata.id || `temp-${Date.now()}`}
          onUploadComplete={() => {
            setShowUploadModal(false);
            // TODO: Get the uploaded asset ID from the upload response
            // For now, just mark as uploaded
            setUploadedCharacterAssetId(`uploaded-${Date.now()}`);
          }}
        />
      )}
    </div>
  );
}
