// Director Persona Types

export interface PersonaMetadata {
  id: string;
  directorName: string;
  name: string;
  tagline: string;
  bio: string;
  avatar: string;
  description: string;
  icon: string;
  color: string;
  characteristics: string[];
  visualStyle: {
    colorPalette: string[];
    lighting: string;
    composition: string;
    mood: string;
  };
  narrativeStyle: {
    pacing: string;
    structure: string;
    dialogue: string;
    themes: string[];
  };
  technicalPreferences: {
    cameraWork: string;
    editingStyle: string;
    soundDesign: string;
  };
}

export interface PersonaGuides {
  scripting: string;
  assetGeneration: string;
  videoGeneration: string;
}

export interface DirectorPersona extends PersonaMetadata {
  guides: PersonaGuides;
}

export type PersonaId =
  | 'pulp-visionary'
  | 'time-architect'
  | 'symmetry-poet'
  | 'shadow-weaver'
  | 'precision-master'
  | 'heart-crafter'
  | 'zen-luxe-curator'
  | 'anime-master'
  | 'arch-viz-director'
  | 'soviet-animator';
