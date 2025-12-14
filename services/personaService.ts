import fs from 'fs';
import path from 'path';
import type { PersonaMetadata, PersonaGuides, DirectorPersona, PersonaId } from '@/types/persona';

const PERSONAS_DIR = path.join(process.cwd(), '.personas');

/**
 * PersonaService - Manages director persona data and guide injection
 *
 * This service loads persona metadata and guide files from .personas/ directory
 * and provides methods to inject persona-specific instructions into AI prompts.
 */
export class PersonaService {
  private static personas: Map<PersonaId, DirectorPersona> = new Map();
  private static initialized = false;

  /**
   * Initialize the persona service by loading all persona data
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    const personaIds: PersonaId[] = [
      'pulp-visionary',
      'time-architect',
      'symmetry-poet',
      'shadow-weaver',
      'precision-master',
      'heart-crafter',
      'zen-luxe-curator'
    ];

    for (const id of personaIds) {
      try {
        const persona = await this.loadPersona(id);
        this.personas.set(id, persona);
      } catch (error) {
        console.error(`Failed to load persona ${id}:`, error);
      }
    }

    this.initialized = true;
  }

  /**
   * Load a single persona with its metadata and guides
   */
  private static async loadPersona(id: PersonaId): Promise<DirectorPersona> {
    const personaDir = path.join(PERSONAS_DIR, id);

    // Load metadata
    const metadataPath = path.join(personaDir, 'metadata.json');
    const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
    const metadata: PersonaMetadata = JSON.parse(metadataContent);

    // Load guides
    const scriptingPath = path.join(personaDir, 'scripting.guide.md');
    const assetGenPath = path.join(personaDir, 'asset-generation.guide.md');
    const videoGenPath = path.join(personaDir, 'video-generation.guide.md');

    const guides: PersonaGuides = {
      scripting: fs.readFileSync(scriptingPath, 'utf-8'),
      assetGeneration: fs.readFileSync(assetGenPath, 'utf-8'),
      videoGeneration: fs.readFileSync(videoGenPath, 'utf-8')
    };

    return {
      ...metadata,
      guides
    };
  }

  /**
   * Get all available personas (metadata only, without full guides)
   */
  static async getAllPersonas(): Promise<PersonaMetadata[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return Array.from(this.personas.values()).map(persona => {
      const { guides, ...metadata } = persona;
      return metadata;
    });
  }

  /**
   * Get a specific persona by ID
   */
  static async getPersona(id: PersonaId): Promise<DirectorPersona | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.personas.get(id) || null;
  }

  /**
   * Get the scripting guide for a persona
   * This should be appended to story generation prompts
   */
  static async getScriptingGuide(id: PersonaId): Promise<string> {
    const persona = await this.getPersona(id);
    if (!persona) {
      throw new Error(`Persona ${id} not found`);
    }

    return `

---

## DIRECTOR'S STYLE GUIDE: ${persona.directorName}

${persona.guides.scripting}`;
  }

  /**
   * Get the asset generation guide for a persona
   * This should be appended to character design prompts
   */
  static async getAssetGenerationGuide(id: PersonaId): Promise<string> {
    const persona = await this.getPersona(id);
    if (!persona) {
      throw new Error(`Persona ${id} not found`);
    }

    return `

---

## VISUAL STYLE GUIDE: ${persona.directorName}

${persona.guides.assetGeneration}`;
  }

  /**
   * Get the video generation guide for a persona
   * This should be used when building Veo 3.1 prompts
   */
  static async getVideoGenerationGuide(id: PersonaId): Promise<string> {
    const persona = await this.getPersona(id);
    if (!persona) {
      throw new Error(`Persona ${id} not found`);
    }

    return `

---

## CINEMATOGRAPHY GUIDE: ${persona.directorName}

${persona.guides.videoGeneration}`;
  }

  /**
   * Inject persona guide into a prompt based on context
   */
  static async injectPersonaGuide(
    basePrompt: string,
    personaId: PersonaId,
    context: 'scripting' | 'asset-generation' | 'video-generation'
  ): Promise<string> {
    let guide: string;

    switch (context) {
      case 'scripting':
        guide = await this.getScriptingGuide(personaId);
        break;
      case 'asset-generation':
        guide = await this.getAssetGenerationGuide(personaId);
        break;
      case 'video-generation':
        guide = await this.getVideoGenerationGuide(personaId);
        break;
      default:
        return basePrompt;
    }

    return `${basePrompt}${guide}`;
  }
}
