/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { X, Zap, Sparkles, Move, Sun } from 'lucide-react';

export interface TransitionPreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: React.ReactNode;
}

const TRANSITION_PRESETS: TransitionPreset[] = [
  {
    id: 'zoom-punch',
    name: 'Zoom Punch',
    description: 'Camera zooms in, blurs, pulls back',
    prompt: 'Cinematic zoom transition. Camera rapidly zooms INTO the scene, everything blurs and swirls for a moment, then camera smoothly PULLS BACK to reveal the new scene. The zoom creates a time-warp feeling. Smooth continuous shot.',
    icon: <Zap size={16} className="text-indigo-600" />,
  },
  {
    id: 'magic-reveal',
    name: 'Magic Reveal',
    description: 'Sparkles transform the scene',
    prompt: 'Magical transformation transition. Golden sparkles and magical dust swirl through the air, growing brighter until they fill the frame. As the sparkles settle, the scene has transformed into the new location. Whimsical magic realism.',
    icon: <Sparkles size={16} className="text-indigo-600" />,
  },
  {
    id: 'dolly-pan',
    name: 'Dolly Pan',
    description: 'Camera dollies back while panning',
    prompt: 'Cinematic dolly-pan transition. Camera smoothly dollies backward while simultaneously panning to the side. The movement reveals the new scene as if it was always adjacent to the original scene. Continuous fluid motion.',
    icon: <Move size={16} className="text-indigo-600" />,
  },
  {
    id: 'light-wash',
    name: 'Light Wash',
    description: 'Bright light fades to next scene',
    prompt: 'Light wash transition. A bright, ethereal light gradually overwhelms the frame, washing everything in white or golden glow. As the light softly fades, the new scene is revealed. Dream-like, gentle transition.',
    icon: <Sun size={16} className="text-indigo-600" />,
  },
];

type VideoModel = 'veo31' | 'wan21' | 'vidu';

interface InsertTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (config: {
    prompt: string;
    duration: number;
    model: VideoModel;
    presetId?: string;
  }) => void;
  previousSceneTitle?: string;
  nextSceneTitle?: string;
}

export const InsertTransitionModal: React.FC<InsertTransitionModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  previousSceneTitle,
  nextSceneTitle,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string | null>('zoom-punch');
  const [customPrompt, setCustomPrompt] = useState('');
  const [duration, setDuration] = useState<number>(4);
  const [model, setModel] = useState<VideoModel>('veo31');

  if (!isOpen) return null;

  const handleInsert = () => {
    const preset = TRANSITION_PRESETS.find(p => p.id === selectedPreset);
    const prompt = customPrompt.trim() || preset?.prompt || '';

    if (!prompt) {
      return; // Require a prompt
    }

    onInsert({
      prompt,
      duration,
      model,
      presetId: customPrompt.trim() ? undefined : selectedPreset || undefined,
    });
    onClose();
  };

  const handlePresetClick = (presetId: string) => {
    if (selectedPreset === presetId) {
      setSelectedPreset(null);
    } else {
      setSelectedPreset(presetId);
      setCustomPrompt(''); // Clear custom prompt when selecting preset
    }
  };

  const hasValidPrompt = customPrompt.trim() || selectedPreset;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Insert Transition</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} className="text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Context info */}
          <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Transition between:</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-800 truncate max-w-[40%]">
                {previousSceneTitle || 'Previous Scene'}
              </span>
              <span className="text-gray-400">→</span>
              <span className="font-medium text-gray-800 truncate max-w-[40%]">
                {nextSceneTitle || 'Next Scene'}
              </span>
            </div>
          </div>

          {/* Preset Transitions */}
          <div className="mb-6">
            <div className="text-sm font-medium text-gray-700 mb-3">Preset Transitions</div>
            <div className="grid grid-cols-2 gap-3">
              {TRANSITION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    selectedPreset === preset.id && !customPrompt.trim()
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {preset.icon}
                    <span className={`text-sm font-medium ${
                      selectedPreset === preset.id && !customPrompt.trim()
                        ? 'text-indigo-900'
                        : 'text-gray-800'
                    }`}>
                      {preset.name}
                    </span>
                  </div>
                  <span className={`text-xs ${
                    selectedPreset === preset.id && !customPrompt.trim()
                      ? 'text-indigo-600'
                      : 'text-gray-500'
                  }`}>
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt */}
          <div className="mb-6">
            <div className="text-sm font-medium text-gray-700 mb-2">Custom Prompt</div>
            <textarea
              value={customPrompt}
              onChange={(e) => {
                setCustomPrompt(e.target.value);
                if (e.target.value.trim()) {
                  setSelectedPreset(null);
                }
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Describe your custom transition... e.g., 'Camera slowly rotates 180 degrees as time passes'"
            />
          </div>

          {/* Duration and Model */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-2">Duration</div>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={4}>4 seconds</option>
                <option value={6}>6 seconds</option>
                <option value={8}>8 seconds</option>
              </select>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-2">Model</div>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as VideoModel)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="veo31">Veo 3.1 Fast</option>
                <option value="wan21">WAN 2.1</option>
                <option value="vidu">Vidu Q1</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!hasValidPrompt}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                hasValidPrompt
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Insert Transition
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
