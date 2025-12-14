/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import { Check } from 'lucide-react';
import { PersonaDefinition } from '../types/director-personas';

interface PersonaCardProps {
  persona: PersonaDefinition;
  isSelected: boolean;
  onSelect: () => void;
}

export default function PersonaCard({ persona, isSelected, onSelect }: PersonaCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`group relative bg-white border-2 rounded-xl p-6 transition-all text-left hover:shadow-xl ${
        isSelected
          ? `${persona.color.border} shadow-lg`
          : `border-gray-200 ${persona.color.hover}`
      }`}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-4 right-4 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Avatar */}
      <div className="w-16 h-16 rounded-full overflow-hidden mb-4 border-2 border-gray-200">
        <img
          src={persona.avatar}
          alt={persona.directorName}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Director Name */}
      <h3 className="text-xl font-bold text-gray-900 mb-1">{persona.directorName}</h3>

      {/* Style Name */}
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{persona.name}</p>

      {/* Tagline */}
      <p className={`text-sm font-medium mb-3 ${persona.color.primary}`}>
        {persona.tagline}
      </p>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-4 leading-relaxed">
        {persona.description}
      </p>

      {/* Characteristics */}
      <div className="flex flex-wrap gap-2">
        {persona.characteristics.map((char) => (
          <span
            key={char}
            className={`px-2.5 py-1 text-xs font-medium rounded ${
              isSelected
                ? `${persona.color.light} ${persona.color.primary}`
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {char}
          </span>
        ))}
      </div>

      {/* Hover effect overlay */}
      <div
        className={`absolute inset-0 rounded-xl pointer-events-none transition-opacity ${
          isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-5'
        } ${persona.color.light}`}
      />
    </button>
  );
}
