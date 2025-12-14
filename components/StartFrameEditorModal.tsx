/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { X, Sparkles, Wand2, Loader2, Image as ImageIcon } from 'lucide-react';
import { executeStartFrameGeneratorAgent, executeStartFrameEditorAgent, AgentHubAttachment } from '../services/agentHubService';
import { Project, Scene } from '../types/project';

interface StartFrameEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  scene: Scene;
  sceneIndex: number;
  mode: 'generate' | 'edit';
  currentFrameUrl?: string; // For edit mode
  onPromptGenerated: (prompt: string) => Promise<string>; // Returns image URL
}

interface AgentResponse {
  prompt: string;
  reasoning: string;
  visualAnalysis?: string;
  keyElementsPreserved?: string[];
}

export const StartFrameEditorModal: React.FC<StartFrameEditorModalProps> = ({
  isOpen,
  onClose,
  project,
  scene,
  sceneIndex,
  mode,
  currentFrameUrl,
  onPromptGenerated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRequest, setUserRequest] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedPrompt(null);
    setResponse(null);

    try {
      // Prepare story context for the agent
      const storyContext = {
        title: project.title,
        description: project.description,
        character: project.character,
        totalScenes: project.scenes.length,
        currentSceneNumber: sceneIndex + 1,
        currentScene: {
          title: scene.title,
          prompt: scene.prompt,
          cameraAngle: scene.cameraAngle,
          voiceover: scene.voiceover,
        },
        previousScenes: project.scenes.slice(0, sceneIndex).map((s, i) => ({
          sceneNumber: i + 1,
          title: s.title,
          prompt: s.prompt,
        })),
      };

      const userInput = `
Story Context:
${JSON.stringify(storyContext, null, 2)}

${userRequest ? `User Request: ${userRequest}` : ''}

Generate an optimized image prompt for the start frame of scene ${sceneIndex + 1}.
      `.trim();

      let result: string;

      if (mode === 'edit' && currentFrameUrl) {
        // Convert image URL to base64 for Agent Hub attachment
        const imageBlob = await fetch(currentFrameUrl).then(r => r.blob());
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            // Remove data URL prefix
            const base64Data = base64String.split(',')[1];
            resolve(base64Data);
          };
          reader.readAsDataURL(imageBlob);
        });

        const attachment: AgentHubAttachment = {
          type: 'base64',
          mimeType: 'image/png',
          data: base64,
          fileName: `scene-${scene.id}-start-frame.png`,
        };

        result = await executeStartFrameEditorAgent(userInput, attachment);
      } else {
        result = await executeStartFrameGeneratorAgent(userInput);
      }

      // Parse the JSON response
      const parsed: AgentResponse = JSON.parse(result);
      setGeneratedPrompt(parsed.prompt);
      setResponse(parsed);
    } catch (err) {
      console.error('Error generating start frame prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate prompt');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async () => {
    if (generatedPrompt) {
      setIsGeneratingImage(true);
      setError(null);
      setGeneratedImageUrl(null);
      try {
        const imageUrl = await onPromptGenerated(generatedPrompt);
        setGeneratedImageUrl(imageUrl);
      } catch (err) {
        console.error('Error generating image:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate image');
      } finally {
        setIsGeneratingImage(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {mode === 'generate' ? (
              <Sparkles className="w-5 h-5 text-indigo-600" />
            ) : (
              <Wand2 className="w-5 h-5 text-indigo-600" />
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === 'generate' ? 'Generate' : 'Edit'} Start Frame Prompt
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Scene Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">Scene {sceneIndex + 1}:</span>
              <span>{scene.title}</span>
            </div>
            <p className="text-sm text-gray-700">{scene.prompt}</p>
          </div>

          {/* Current Frame Preview (Edit Mode) */}
          {mode === 'edit' && currentFrameUrl && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Current Start Frame
              </label>
              <div className="relative w-full aspect-[9/16] max-w-xs mx-auto rounded-lg overflow-hidden border-2 border-gray-200">
                <img
                  src={currentFrameUrl}
                  alt="Current start frame"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* User Request (Optional) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Additional Instructions (Optional)
            </label>
            <textarea
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              placeholder={
                mode === 'generate'
                  ? 'e.g., "Make it more dramatic" or "Add golden hour lighting"'
                  : 'e.g., "Keep the character but improve the lighting" or "Make the background more detailed"'
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Generate Button */}
          {!generatedPrompt && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  {mode === 'generate' ? (
                    <Sparkles className="w-5 h-5" />
                  ) : (
                    <Wand2 className="w-5 h-5" />
                  )}
                  <span>{mode === 'generate' ? 'Generate' : 'Analyze & Improve'}</span>
                </>
              )}
            </button>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Generated Result */}
          {response && (
            <div className="space-y-4">
              {/* Prompt */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Generated Prompt
                </label>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="text-sm text-gray-900">{response.prompt}</p>
                </div>
              </div>

              {/* Reasoning */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  AI Reasoning
                </label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">{response.reasoning}</p>
                </div>
              </div>

              {/* Visual Analysis (Edit Mode) */}
              {mode === 'edit' && response.visualAnalysis && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Visual Analysis
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{response.visualAnalysis}</p>
                  </div>
                </div>
              )}

              {/* Key Elements Preserved (Edit Mode) */}
              {mode === 'edit' && response.keyElementsPreserved && response.keyElementsPreserved.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Elements Preserved
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {response.keyElementsPreserved.map((element, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-green-50 border border-green-200 rounded-full text-xs font-medium text-green-700"
                      >
                        {element}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleApply}
                  disabled={isGeneratingImage || !!generatedImageUrl}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {isGeneratingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Image...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Image</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setGeneratedPrompt(null);
                    setResponse(null);
                    setGeneratedImageUrl(null);
                  }}
                  disabled={isGeneratingImage}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium"
                >
                  Regenerate
                </button>
              </div>

              {/* Generated Image Preview */}
              {generatedImageUrl && (
                <div className="space-y-3 border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Generated Image Preview
                  </label>
                  <div className="relative w-full aspect-[9/16] max-w-sm mx-auto rounded-lg overflow-hidden border-2 border-indigo-200">
                    <img
                      src={generatedImageUrl}
                      alt="Generated start frame"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        onClose();
                      }}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>Use This Image</span>
                    </button>
                    <button
                      onClick={() => {
                        setGeneratedImageUrl(null);
                      }}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
                    >
                      Generate Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
