/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Film, Zap, Palette, Ghost, Clock, Heart, Mountain, Sparkles, Building2, Snowflake } from 'lucide-react';

/**
 * Director persona defining visual style and storytelling approach
 */
export type DirectorPersona =
  | 'pulp-visionary'    // Tarantino-style
  | 'time-architect'    // Nolan-style
  | 'symmetry-poet'     // Wes Anderson
  | 'shadow-weaver'     // A24 Horror
  | 'precision-master'  // Fincher
  | 'heart-crafter'     // Pixar
  | 'zen-luxe-curator'  // Luxury hospitality marketing
  | 'anime-master'      // Japanese anime style
  | 'arch-viz-director' // Architectural visualization
  | 'soviet-animator';  // Soviet animation style (Norstein-inspired)

export interface StorySample {
  short: string; // Short clickable label (e.g., "a heist gone wrong")
  expanded: string; // Full description to populate textarea
}

export interface PersonaDefinition {
  id: DirectorPersona;
  directorName: string; // Personal name of the director
  name: string;
  tagline: string;
  description: string;
  bio: string; // Director's bio/background
  avatar: string; // Avatar image path
  characteristics: string[];
  color: {
    primary: string;    // Tailwind class for main color
    light: string;      // Tailwind class for light background
    border: string;     // Tailwind class for border
    hover: string;      // Tailwind class for hover state
  };
  icon: any; // Lucide icon component

  // Maps to underlying Quick Path parameters
  mappedParams: {
    genre: 'drama' | 'action' | 'comedy' | 'horror';
    type: 'character-journey' | 'situation' | 'discovery';
    energy: 'fast' | 'medium' | 'contemplative';
  };

  // Sample story prompts for this director
  storySamples: [StorySample, StorySample];
}

export const DIRECTOR_PERSONAS: Record<DirectorPersona, PersonaDefinition> = {
  'pulp-visionary': {
    id: 'pulp-visionary',
    directorName: 'Vincent Cortez',
    name: 'Pulp Visionary',
    tagline: 'Bold dialogue meets narrative chaos',
    description: 'Non-linear stories with razor-sharp dialogue and unexpected twists. Every scene crackles with energy.',
    bio: 'A maverick director known for non-linear crime sagas and razor-sharp dialogue. Cortez\'s films pulse with retro energy and stylized violence.',
    avatar: '/personas/avatars/vincent-cortez.png',
    characteristics: ['Dialogue-driven', 'Non-linear', 'Bold', 'Stylized'],
    color: {
      primary: 'text-amber-600',
      light: 'bg-amber-50',
      border: 'border-amber-600',
      hover: 'hover:border-amber-300',
    },
    icon: Film,
    mappedParams: {
      genre: 'action',
      type: 'situation',
      energy: 'fast',
    },
    storySamples: [
      {
        short: 'a heist gone wrong',
        expanded: 'A diner robbery that spirals into chaos when the thieves realize one of the customers is an off-duty hitman with his own agenda.',
      },
      {
        short: 'rival gangsters meet',
        expanded: 'Two rival crime bosses meet at a vintage bowling alley to negotiate a truce, but secrets from the past threaten to derail everything.',
      },
    ],
  },

  'time-architect': {
    id: 'time-architect',
    directorName: 'Marcus Kane',
    name: 'Time Architect',
    tagline: 'Epic scale meets cerebral storytelling',
    description: 'Mind-bending narratives with grand scale and intricate plotting. Time is just another character.',
    bio: 'A cerebral filmmaker who bends time and reality with IMAX precision. Kane\'s complex narratives demand attention and reward repeat viewing.',
    avatar: '/personas/avatars/marcus-kane.png',
    characteristics: ['Cerebral', 'Epic', 'Complex', 'Layered'],
    color: {
      primary: 'text-blue-600',
      light: 'bg-blue-50',
      border: 'border-blue-600',
      hover: 'hover:border-blue-300',
    },
    icon: Clock,
    mappedParams: {
      genre: 'drama',
      type: 'discovery',
      energy: 'medium',
    },
    storySamples: [
      {
        short: 'a message from the future',
        expanded: 'A physicist receives a cryptic video message from herself, 30 years in the future, warning her not to complete her life\'s work.',
      },
      {
        short: 'memories that don\'t add up',
        expanded: 'A man discovers that his childhood memories are impossible—places that never existed, events that contradict history—leading him to question reality itself.',
      },
    ],
  },

  'symmetry-poet': {
    id: 'symmetry-poet',
    directorName: 'Wesley Whitmore',
    name: 'Symmetry Poet',
    tagline: 'Whimsy wrapped in perfect composition',
    description: 'Meticulously framed worlds where every color tells a story. Quirky characters in pastel perfection.',
    bio: 'A meticulous auteur obsessed with symmetry and pastel perfection. Whitmore\'s storybook worlds hide melancholy beneath their whimsical charm.',
    avatar: '/personas/avatars/wesley-whitmore.png',
    characteristics: ['Symmetrical', 'Whimsical', 'Pastel', 'Precise'],
    color: {
      primary: 'text-pink-600',
      light: 'bg-pink-50',
      border: 'border-pink-600',
      hover: 'hover:border-pink-300',
    },
    icon: Palette,
    mappedParams: {
      genre: 'comedy',
      type: 'character-journey',
      energy: 'medium',
    },
    storySamples: [
      {
        short: 'a peculiar hotel & its guests',
        expanded: 'The eccentric concierge of a grand pink hotel navigates the peculiar requests of its equally peculiar guests during one chaotic weekend.',
      },
      {
        short: 'a family\'s secret recipe',
        expanded: 'Three estranged siblings reunite at their grandmother\'s pastry shop to find her legendary recipe, discovering family secrets hidden in the ingredients.',
      },
    ],
  },

  'shadow-weaver': {
    id: 'shadow-weaver',
    directorName: 'Ari Bergman',
    name: 'Shadow Weaver',
    tagline: 'Fear lives in the silence',
    description: 'Atmospheric dread that builds slowly. Psychological terror where what you don\'t see haunts you most.',
    bio: 'A master of atmospheric horror who turns grief into dread. Bergman\'s slow-burn films haunt you long after the credits roll.',
    avatar: '/personas/avatars/ari-bergman.png',
    characteristics: ['Atmospheric', 'Slow-burn', 'Psychological', 'Haunting'],
    color: {
      primary: 'text-purple-600',
      light: 'bg-purple-50',
      border: 'border-purple-600',
      hover: 'hover:border-purple-300',
    },
    icon: Ghost,
    mappedParams: {
      genre: 'horror',
      type: 'discovery',
      energy: 'contemplative',
    },
    storySamples: [
      {
        short: 'the house remembers',
        expanded: 'A woman inherits her estranged mother\'s rural home, only to find the house responds to her presence in unsettling ways—doors that open on their own, whispers in the walls.',
      },
      {
        short: 'grief takes a form',
        expanded: 'After losing her twin sister, a woman begins seeing her reflection move independently in mirrors, beckoning her to join.',
      },
    ],
  },

  'precision-master': {
    id: 'precision-master',
    directorName: 'David Finch',
    name: 'Precision Master',
    tagline: 'Darkness reveals the truth',
    description: 'Methodical plotting with dark aesthetics. Every frame is calculated, every twist earned.',
    bio: 'A methodical thriller architect with a signature cold aesthetic. Finch\'s obsessive attention to detail culminates in shocking twists.',
    avatar: '/personas/avatars/david-finch.png',
    characteristics: ['Dark', 'Methodical', 'Twist-heavy', 'Calculated'],
    color: {
      primary: 'text-gray-600',
      light: 'bg-gray-50',
      border: 'border-gray-600',
      hover: 'hover:border-gray-300',
    },
    icon: Zap,
    mappedParams: {
      genre: 'drama',
      type: 'situation',
      energy: 'contemplative',
    },
    storySamples: [
      {
        short: 'the perfect alibi unravels',
        expanded: 'A meticulous accountant\'s airtight alibi for his wife\'s disappearance begins to crumble when a detective notices one small inconsistency.',
      },
      {
        short: 'anonymous messages',
        expanded: 'A corporate executive receives anonymous messages revealing secrets only she should know, each one more damaging than the last.',
      },
    ],
  },

  'heart-crafter': {
    id: 'heart-crafter',
    directorName: 'Maya Chen',
    name: 'Heart Crafter',
    tagline: 'Emotion in every frame',
    description: 'Heartwarming journeys that balance humor and depth. Stories that make you laugh, cry, and believe.',
    bio: 'A visionary storyteller who finds universal truth in personal journeys. Chen\'s vibrant worlds brim with emotional depth and hope.',
    avatar: '/personas/avatars/maya-chen.png',
    characteristics: ['Heartwarming', 'Colorful', 'Character-driven', 'Uplifting'],
    color: {
      primary: 'text-green-600',
      light: 'bg-green-50',
      border: 'border-green-600',
      hover: 'hover:border-green-300',
    },
    icon: Heart,
    mappedParams: {
      genre: 'comedy',
      type: 'character-journey',
      energy: 'medium',
    },
    storySamples: [
      {
        short: 'finding courage to dream',
        expanded: 'A shy young baker enters a prestigious competition, discovering that her greatest ingredient isn\'t a recipe—it\'s believing in herself.',
      },
      {
        short: 'an unlikely friendship',
        expanded: 'A retired astronaut and a curious neighborhood kid form an unexpected bond while building a telescope, teaching each other about wonder and letting go.',
      },
    ],
  },

  'zen-luxe-curator': {
    id: 'zen-luxe-curator',
    directorName: 'Kenji Yamamoto',
    name: 'Zen Luxe Curator',
    tagline: 'Where tranquility meets timeless elegance',
    description: 'Atmospheric luxury hospitality with Japanese aesthetics, serene pacing, and the art of understated elegance.',
    bio: 'A master of atmospheric storytelling who captures the soul of Japanese hospitality. Yamamoto\'s work blends wabi-sabi aesthetics with modern luxury.',
    avatar: '/personas/avatars/kenji-yamamoto.png',
    characteristics: ['Serene', 'Luxurious', 'Authentic', 'Atmospheric'],
    color: {
      primary: 'text-slate-600',
      light: 'bg-slate-50',
      border: 'border-slate-600',
      hover: 'hover:border-slate-300',
    },
    icon: Mountain,
    mappedParams: {
      genre: 'drama',
      type: 'discovery',
      energy: 'contemplative',
    },
    storySamples: [
      {
        short: 'a winter escape in Niseko',
        expanded: 'A guest arrives at a luxury mountain retreat seeking solitude, discovering the art of Japanese hospitality through powder snow, private onsen, and kaiseki cuisine.',
      },
      {
        short: 'the chef\'s seasonal journey',
        expanded: 'A master chef sources ingredients from local farmers and fishermen, crafting an omakase experience that tells the story of Hokkaido\'s changing seasons.',
      },
    ],
  },

  'anime-master': {
    id: 'anime-master',
    directorName: 'Akira Tanaka',
    name: 'Anime Master',
    tagline: 'Emotion in every frame, story in every expression',
    description: 'Japanese anime storytelling with cinematic western influences. Character expressions carry 70% of the story; dynamic camera angles reveal psychological depth.',
    bio: 'A seasoned animation director with 20 years of experience in Japanese anime production. Tanaka\'s style blends traditional anime storytelling with cinematic western influences, creating emotionally resonant works.',
    avatar: '/personas/avatars/akira-tanaka.png',
    characteristics: ['Expressive', 'Dynamic', 'Emotional', 'Rhythmic'],
    color: {
      primary: 'text-rose-600',
      light: 'bg-rose-50',
      border: 'border-rose-600',
      hover: 'hover:border-rose-300',
    },
    icon: Sparkles,
    mappedParams: {
      genre: 'drama',
      type: 'character-journey',
      energy: 'medium',
    },
    storySamples: [
      {
        short: 'a warrior\'s final stand',
        expanded: 'A legendary samurai faces his former student in a cherry blossom garden at dusk. Their conflict reflects years of betrayal and love, resolved not in words but in the silence between strikes.',
      },
      {
        short: 'finding light in darkness',
        expanded: 'A young artist loses her ability to see colors after a tragedy. Through an unexpected friendship with a blind musician, she discovers that emotion itself can paint the world anew.',
      },
    ],
  },

  'arch-viz-director': {
    id: 'arch-viz-director',
    directorName: 'Kenzo Nakamura',
    name: 'Architecture Viz Director',
    tagline: 'Architecture is frozen music — every shot has rhythm and flow',
    description: 'Cinematic architectural visualization specializing in luxury developments, property marketing, urban projects, and real estate storytelling with a focus on light, space, and human scale.',
    bio: 'A world-renowned architectural visualization director with 25 years of experience creating cinematic property experiences for luxury developments, urban projects, and award-winning architects. Featured at Venice Biennale and collaborated with firms like Zaha Hadid, BIG, and Kengo Kuma.',
    avatar: '/personas/avatars/kenzo-nakamura.png',
    characteristics: ['Spatial', 'Luminous', 'Architectural', 'Cinematic'],
    color: {
      primary: 'text-zinc-600',
      light: 'bg-zinc-50',
      border: 'border-zinc-600',
      hover: 'hover:border-zinc-300',
    },
    icon: Building2,
    mappedParams: {
      genre: 'drama',
      type: 'discovery',
      energy: 'contemplative',
    },
    storySamples: [
      {
        short: 'a penthouse at golden hour',
        expanded: 'A couple arrives at a luxury penthouse as the sun sets over the city skyline. Light transforms each room, revealing the architecture\'s true character through shadow and reflection.',
      },
      {
        short: 'the architect\'s vision',
        expanded: 'An architect walks through her completed masterpiece for the first time. The building breathes with natural light, each space unfolding like a carefully composed symphony.',
      },
    ],
  },

  'soviet-animator': {
    id: 'soviet-animator',
    directorName: 'Grisha Krokodilovich',
    name: 'Soviet Animator',
    tagline: 'Through fog and dreams, the soul speaks in silhouettes',
    description: 'Atmospheric Soviet-style animation with cutout technique, multi-plane depth, foggy dreamscapes, and poetic visual storytelling inspired by Yuri Norstein and Russian folk traditions.',
    bio: 'A legendary animator trained at Soyuzmultfilm who mastered the art of multi-plane cutout animation. Krokodilovich\'s dreamlike films blend Russian folk tales with poetic visual poetry, using fog, layered glass, and anthropomorphic characters to explore memory, loss, and wonder.',
    avatar: '/personas/avatars/grisha-krokodilovich.png',
    characteristics: ['Dreamlike', 'Layered', 'Poetic', 'Nostalgic'],
    color: {
      primary: 'text-red-700',
      light: 'bg-red-50',
      border: 'border-red-700',
      hover: 'hover:border-red-400',
    },
    icon: Snowflake,
    mappedParams: {
      genre: 'drama',
      type: 'character-journey',
      energy: 'contemplative',
    },
    storySamples: [
      {
        short: 'a crocodile in the fog',
        expanded: 'A melancholic crocodile in a worn Soviet suit walks through a foggy birch forest at dusk, carrying memories of a life left behind, searching for warmth in a cold world.',
      },
      {
        short: 'the hedgehog\'s journey',
        expanded: 'A small hedgehog with a bundle on a stick ventures through layers of mist to visit his friend the bear, encountering strange and beautiful visions along the way.',
      },
    ],
  },
};

/**
 * Get mapped Quick Path parameters from a director persona
 */
export function getPersonaParams(persona: DirectorPersona) {
  return DIRECTOR_PERSONAS[persona].mappedParams;
}
