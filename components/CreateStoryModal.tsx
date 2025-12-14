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
  Check,
} from 'lucide-react';
import {
  Genre,
  StoryType,
  Energy,
  QuickPathParams,
  StoryDraft,
  GeneratedScene,
} from '../types/story-creation';
import {
  DirectorPersona,
  DIRECTOR_PERSONAS,
  getPersonaParams,
} from '../types/director-personas';
import PersonaCard from './PersonaCard';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: (story: StoryDraft) => void;
  initialDraft?: StoryDraft | null; // Optional initial draft to continue editing
}

type Step = 'quick' | 'edit';

export default function CreateStoryModal({
  isOpen,
  onClose,
  onStoryCreated,
  initialDraft,
}: CreateStoryModalProps) {
  const [step, setStep] = useState<Step>('quick');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Path state - Director Persona
  const [selectedPersona, setSelectedPersona] = useState<DirectorPersona | null>(null);

  // Legacy Quick Path state (mapped from persona)
  const [genre, setGenre] = useState<Genre | null>(null);
  const [storyType, setStoryType] = useState<StoryType | null>(null);
  const [energy, setEnergy] = useState<Energy | null>(null);

  // Generated story (for editing)
  const [storyDraft, setStoryDraft] = useState<StoryDraft | null>(null);

  // Edit messages for chat-like experience
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant'; content: string; timestamp: number; toolInvocations?: any[]}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Story guidance input for director selection
  const [storyGuidance, setStoryGuidance] = useState('');

  // Handle initialDraft when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialDraft) {
        // Restore the draft and go to edit step
        setStoryDraft(initialDraft);
        setStep('edit');
      } else {
        // Fresh start - go directly to director selection
        setStep('quick');
        setStoryDraft(null);
        setMessages([]);
      }
    }
  }, [isOpen, initialDraft]);

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

  const handleBack = () => {
    if (step === 'edit') {
      setStoryDraft(null);
      setStep('quick');
    }
    setError(null);
  };

  const handleGenerateQuick = async () => {
    if (!selectedPersona) return;

    setIsGenerating(true);
    setError(null);

    // Get mapped parameters from selected persona
    const personaParams = getPersonaParams(selectedPersona);
    const params = {
      genre: personaParams.genre,
      type: personaParams.type,
      energy: personaParams.energy,
    } as QuickPathParams;

    try {
      const response = await fetch('/api/story/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          mode: 'quick',
          params,
          personaId: selectedPersona, // Pass persona ID for style guide injection
          storyGuidance: storyGuidance.trim() || undefined, // User's story direction
        }),
      });

      const data = await response.json();

      if (data.success && data.story) {
        setStoryDraft(data.story);
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
    // Don't call handleClose() - parent handles closing the modal
  };

  const handleClose = () => {
    setStep('quick');
    setSelectedPersona(null);
    setGenre(null);
    setStoryType(null);
    setEnergy(null);
    setStoryDraft(null);
    setStoryGuidance('');
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
            {step === 'edit' && (
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
                  {step === 'quick' && 'Choose Your Director'}
                  {step === 'edit' && 'Preview Your Story'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {step === 'quick' && 'Every great story has a unique visual voice'}
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
        <div className={
          step === 'edit'
            ? 'flex-1 flex flex-col overflow-hidden'
            : step === 'quick'
            ? 'flex-1 flex flex-col overflow-hidden'
            : 'flex-1 overflow-y-auto p-8'
        }>
          {/* Director Persona Selection - Full height flex layout */}
          {step === 'quick' && (
            <div className="flex flex-col h-full">
              {/* Scrollable Director Personas Grid */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(Object.keys(DIRECTOR_PERSONAS) as DirectorPersona[]).map((personaId) => (
                    <PersonaCard
                      key={personaId}
                      persona={DIRECTOR_PERSONAS[personaId]}
                      isSelected={selectedPersona === personaId}
                      onSelect={() => setSelectedPersona(personaId)}
                    />
                  ))}
                </div>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
              </div>

              {/* Fixed Story Guidance Section */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 p-6">
                <div className="max-w-3xl mx-auto">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    <Lightbulb className="w-4 h-4 inline-block mr-2 text-amber-500" />
                    {selectedPersona
                      ? `What story should ${DIRECTOR_PERSONAS[selectedPersona].directorName} tell?`
                      : 'What story would you like to tell?'}
                  </label>
                  <textarea
                    value={storyGuidance}
                    onChange={(e) => setStoryGuidance(e.target.value)}
                    placeholder={
                      selectedPersona
                        ? `e.g., "${DIRECTOR_PERSONAS[selectedPersona].storySamples[0].expanded.substring(0, 80)}..."`
                        : 'Select a director above to see story ideas...'
                    }
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    {selectedPersona ? (
                      <>
                        Give {DIRECTOR_PERSONAS[selectedPersona].directorName} some direction, like{' '}
                        <button
                          type="button"
                          onClick={() => setStoryGuidance(DIRECTOR_PERSONAS[selectedPersona].storySamples[0].expanded)}
                          className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                        >
                          {DIRECTOR_PERSONAS[selectedPersona].storySamples[0].short}
                        </button>
                        {' '}or{' '}
                        <button
                          type="button"
                          onClick={() => setStoryGuidance(DIRECTOR_PERSONAS[selectedPersona].storySamples[1].expanded)}
                          className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                        >
                          {DIRECTOR_PERSONAS[selectedPersona].storySamples[1].short}
                        </button>
                        . Leave blank for a surprise story.
                      </>
                    ) : (
                      'Select a director to see story suggestions.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Edit Story - Screenplay Review */}
          {step === 'edit' && storyDraft && (
            <>
              {/* Story Metadata */}
              <div className="px-6 py-4 border-b border-gray-200 bg-indigo-50 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
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
                  {/* Selected Director Badge */}
                  {storyDraft.projectMetadata.personaId && DIRECTOR_PERSONAS[storyDraft.projectMetadata.personaId as DirectorPersona] && (
                    <div className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                      <img
                        src={DIRECTOR_PERSONAS[storyDraft.projectMetadata.personaId as DirectorPersona].avatar}
                        alt={DIRECTOR_PERSONAS[storyDraft.projectMetadata.personaId as DirectorPersona].directorName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-xs text-gray-500">Directed by</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {DIRECTOR_PERSONAS[storyDraft.projectMetadata.personaId as DirectorPersona].directorName}
                        </p>
                      </div>
                    </div>
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

        {/* Footer - Show for quick step (edit has its own footer) */}
        {step === 'quick' && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            {/* Spacer since there's no back button on the first step */}
            <div />

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleGenerateQuick}
                disabled={!selectedPersona || isGenerating}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
