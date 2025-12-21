/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { X, Zap } from 'lucide-react';

const CAMERA_ANGLES = [
  'Close-up shot',
  'Medium shot',
  'Wide shot',
  'Over-the-shoulder',
  'Dutch angle',
  'Low angle',
  'High angle',
  'POV shot',
];

interface InsertShotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (config: {
    title: string;
    prompt: string;
    voiceover?: string;
    cameraAngle: string;
    duration: number;
  }) => void;
  previousSceneTitle?: string;
  nextSceneTitle?: string;
}

export const InsertShotModal: React.FC<InsertShotModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  previousSceneTitle,
  nextSceneTitle,
}) => {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [voiceover, setVoiceover] = useState('');
  const [cameraAngle, setCameraAngle] = useState('Medium shot');
  const [duration, setDuration] = useState<number>(8);

  if (!isOpen) return null;

  const handleInsert = () => {
    if (!prompt.trim()) {
      return; // Require a prompt
    }

    onInsert({
      title: title.trim() || 'New Shot',
      prompt: prompt.trim(),
      voiceover: voiceover.trim() || undefined,
      cameraAngle,
      duration,
    });

    // Reset form
    setTitle('');
    setPrompt('');
    setVoiceover('');
    setCameraAngle('Medium shot');
    setDuration(8);

    onClose();
  };

  const hasValidPrompt = prompt.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Insert New Shot</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} className="text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Frame Continuity Notice */}
          <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 text-sm text-green-800 mb-2">
              <Zap size={16} className="text-green-600" />
              <span className="font-medium">Frame Continuity Enabled</span>
            </div>
            <p className="text-xs text-green-700">
              Start frame will use the last frame from{' '}
              <span className="font-medium">"{previousSceneTitle || 'previous scene'}"</span>.
              End frame will use the first frame from{' '}
              <span className="font-medium">"{nextSceneTitle || 'next scene'}"</span>.
            </p>
          </div>

          {/* Shot Title */}
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Shot Title</div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Close-up reaction"
            />
          </div>

          {/* Shot Description */}
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Shot Description</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Describe your new shot... e.g., 'Close-up of the concierge's hands arranging keys on the desk'"
            />
          </div>

          {/* Dialogue (optional) */}
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Dialogue <span className="text-gray-400 font-normal">(optional)</span>
            </div>
            <input
              type="text"
              value={voiceover}
              onChange={(e) => setVoiceover(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Character says..."
            />
          </div>

          {/* Camera Angle and Duration */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-2">Camera Angle</div>
              <select
                value={cameraAngle}
                onChange={(e) => setCameraAngle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CAMERA_ANGLES.map((angle) => (
                  <option key={angle} value={angle}>
                    {angle}
                  </option>
                ))}
              </select>
            </div>
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
                <option value={10}>10 seconds</option>
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
              Insert Shot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
