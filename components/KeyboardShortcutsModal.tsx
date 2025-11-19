/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: 'Navigation' | 'Playback' | 'Timeline' | 'General';
}

const shortcuts: KeyboardShortcut[] = [
  // Navigation
  { keys: ['↓'], description: 'Next scene', category: 'Navigation' },
  { keys: ['↑'], description: 'Previous scene', category: 'Navigation' },

  // Playback
  { keys: ['Space'], description: 'Play / Pause current scene', category: 'Playback' },
  { keys: ['Shift', 'Enter'], description: 'Play all scenes from current', category: 'Playback' },
  { keys: ['Esc'], description: 'Stop playback', category: 'Playback' },

  // Timeline
  { keys: ['I'], description: 'Set in point at current time', category: 'Timeline' },
  { keys: ['O'], description: 'Set out point at current time', category: 'Timeline' },
  { keys: ['←'], description: 'Previous frame (1/30s)', category: 'Timeline' },
  { keys: ['→'], description: 'Next frame (1/30s)', category: 'Timeline' },
  { keys: ['Ctrl', '←'], description: 'Jump back 10 frames', category: 'Timeline' },
  { keys: ['Ctrl', '→'], description: 'Jump forward 10 frames', category: 'Timeline' },
  { keys: ['Alt', '←'], description: 'Jump back 10 frames', category: 'Timeline' },
  { keys: ['Alt', '→'], description: 'Jump forward 10 frames', category: 'Timeline' },
  { keys: ['Home'], description: 'Jump to first frame (in point)', category: 'Timeline' },
  { keys: ['End'], description: 'Jump to last frame (out point)', category: 'Timeline' },

  // General
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'General' },
  { keys: ['Esc'], description: 'Close modals', category: 'General' },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Keyboard size={24} className="text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {categories.map(category => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts
                    .filter(s => s.category === category)
                    .map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm text-gray-700">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <React.Fragment key={keyIndex}>
                              <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-700 shadow-sm min-w-[2rem] text-center">
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="text-gray-400 text-xs mx-0.5">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs font-mono">?</kbd> anytime to view shortcuts
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
