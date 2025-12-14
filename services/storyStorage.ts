/**
 * Story Storage Service
 *
 * Manages file-based story storage with organized folder structure.
 * Stories are stored in /stories/{story-id}/ with separated concerns:
 * - metadata.json: Story metadata (title, description, dates, tags)
 * - script.json: Scenes with dialogue and prompts
 * - config.json: Project settings (aspect ratio, model, resolution)
 * - assets/: Character references, props, locations, effects
 * - videos/: Generated scene videos
 * - evaluations/: Video quality evaluations
 */

import { mkdir, writeFile, readFile, readdir, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Scene } from '../types/project';
import { AspectRatio, VeoModel, Resolution } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface StoryMetadata {
  id: string;
  title: string;
  description: string;
  type: 'short' | 'commercial' | 'long';
  character?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
  author?: string;
  status: 'draft' | 'in-progress' | 'completed' | 'published';
  generationMetadata?: {
    mode: 'quick' | 'custom';
    timestamp: string;
    originalParams: Record<string, any>; // QuickPathParams | CustomPathParams
  };
}

export interface StoryScript {
  scenes: Scene[];

  // Track story storage assets that have been explicitly deleted by user
  // Stores filenames (e.g., "character-ref-design-1762267856949.png")
  // to prevent auto-sync from re-importing them
  deletedStoryStorageAssets?: string[];
}

export interface StoryConfig {
  aspectRatio: AspectRatio;
  defaultModel: VeoModel;
  defaultResolution: Resolution;
  characterReferences: string[];
  generationSettings?: {
    temperature?: number;
    guidanceScale?: number;
  };
}

export interface Story {
  metadata: StoryMetadata;
  script: StoryScript;
  config: StoryConfig;
  paths: {
    root: string;
    assets: string;
    videos: string;
    evaluations: string;
  };
}

export interface CreateStoryRequest {
  title: string;
  description: string;
  type: 'short' | 'commercial' | 'long';
  character?: string;
  script: StoryScript;
  config: StoryConfig;
  tags?: string[];
  generationMetadata?: {
    mode: 'quick' | 'custom';
    timestamp: string;
    originalParams: Record<string, any>;
  };
}

export interface StoryFilters {
  status?: 'draft' | 'in-progress' | 'completed' | 'published';
  tags?: string[];
  type?: 'short' | 'commercial' | 'long';
}

export interface StoryListItem {
  id: string;
  title: string;
  description: string;
  type: 'short' | 'commercial' | 'long';
  status: 'draft' | 'in-progress' | 'completed' | 'published';
  sceneCount: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface StoryListResult {
  stories: StoryListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DeleteResult {
  success: boolean;
  deleted: {
    folder: string;
    fileCount: number;
    totalSize: number;
  };
}

export interface StoryAssets {
  characters: string[];
  props: string[];
  locations: string[];
  effects: string[];
  storyboards: string[];
}

export interface ChangesSummary {
  scenesAdded: number;
  scenesRemoved: number;
  scenesModified: number;
  titleChanged: boolean;
  characterChanged: boolean;
}

// ============================================================================
// Story Storage Service
// ============================================================================

class StoryStorage {
  private storiesDir: string;

  constructor() {
    this.storiesDir = join(process.cwd(), 'stories');
  }

  /**
   * Generate story ID from title
   */
  private generateStoryId(title: string): string {
    const year = new Date().getFullYear();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 40);
    return `${slug}-${year}`;
  }

  /**
   * Get story folder path
   */
  private getStoryPath(storyId: string): string {
    return join(this.storiesDir, storyId);
  }

  /**
   * Ensure story directory structure exists
   */
  private async ensureStoryDirectories(storyId: string): Promise<void> {
    const storyPath = this.getStoryPath(storyId);
    const assetsPath = join(storyPath, 'assets');
    const videosPath = join(storyPath, 'videos');
    const evaluationsPath = join(storyPath, 'evaluations');

    await mkdir(storyPath, { recursive: true });
    await mkdir(assetsPath, { recursive: true });
    await mkdir(join(assetsPath, 'characters'), { recursive: true });
    await mkdir(join(assetsPath, 'props'), { recursive: true });
    await mkdir(join(assetsPath, 'locations'), { recursive: true });
    await mkdir(join(assetsPath, 'effects'), { recursive: true });
    await mkdir(join(assetsPath, 'storyboards'), { recursive: true });
    await mkdir(videosPath, { recursive: true });
    await mkdir(evaluationsPath, { recursive: true });
  }

  /**
   * Create new story
   */
  async createStory(data: CreateStoryRequest): Promise<Story> {
    const storyId = this.generateStoryId(data.title);
    const storyPath = this.getStoryPath(storyId);

    // Check if story already exists
    if (existsSync(storyPath)) {
      throw new Error(`Story with ID "${storyId}" already exists`);
    }

    // Create directory structure
    await this.ensureStoryDirectories(storyId);

    const now = new Date().toISOString();

    // Create metadata
    const metadata: StoryMetadata = {
      id: storyId,
      title: data.title,
      description: data.description,
      type: data.type,
      character: data.character,
      createdAt: now,
      updatedAt: now,
      version: 1,
      tags: data.tags || [],
      status: 'draft',
      generationMetadata: data.generationMetadata,
    };

    // Save files
    await writeFile(
      join(storyPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    await writeFile(
      join(storyPath, 'script.json'),
      JSON.stringify(data.script, null, 2)
    );
    await writeFile(
      join(storyPath, 'config.json'),
      JSON.stringify(data.config, null, 2)
    );

    return {
      metadata,
      script: data.script,
      config: data.config,
      paths: {
        root: storyPath,
        assets: join(storyPath, 'assets'),
        videos: join(storyPath, 'videos'),
        evaluations: join(storyPath, 'evaluations'),
      },
    };
  }

  /**
   * Get story by ID
   */
  async getStory(storyId: string): Promise<Story | null> {
    const storyPath = this.getStoryPath(storyId);

    if (!existsSync(storyPath)) {
      return null;
    }

    try {
      const metadataJson = await readFile(join(storyPath, 'metadata.json'), 'utf-8');
      const scriptJson = await readFile(join(storyPath, 'script.json'), 'utf-8');
      const configJson = await readFile(join(storyPath, 'config.json'), 'utf-8');

      return {
        metadata: JSON.parse(metadataJson),
        script: JSON.parse(scriptJson),
        config: JSON.parse(configJson),
        paths: {
          root: storyPath,
          assets: join(storyPath, 'assets'),
          videos: join(storyPath, 'videos'),
          evaluations: join(storyPath, 'evaluations'),
        },
      };
    } catch (error) {
      console.error(`Error reading story ${storyId}:`, error);
      return null;
    }
  }

  /**
   * List all stories with optional filtering
   */
  async listStories(
    filters?: StoryFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<StoryListResult> {
    if (!existsSync(this.storiesDir)) {
      await mkdir(this.storiesDir, { recursive: true });
      return {
        stories: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      };
    }

    const storyIds = await readdir(this.storiesDir);
    const stories: StoryListItem[] = [];

    for (const storyId of storyIds) {
      const storyPath = this.getStoryPath(storyId);
      const metadataPath = join(storyPath, 'metadata.json');
      const scriptPath = join(storyPath, 'script.json');

      if (!existsSync(metadataPath) || !existsSync(scriptPath)) {
        continue;
      }

      try {
        const metadataJson = await readFile(metadataPath, 'utf-8');
        const scriptJson = await readFile(scriptPath, 'utf-8');
        const metadata: StoryMetadata = JSON.parse(metadataJson);
        const script: StoryScript = JSON.parse(scriptJson);

        // Apply filters
        if (filters?.status && metadata.status !== filters.status) continue;
        if (filters?.type && metadata.type !== filters.type) continue;
        if (filters?.tags && !filters.tags.some(tag => metadata.tags.includes(tag))) continue;

        stories.push({
          id: metadata.id,
          title: metadata.title,
          description: metadata.description,
          type: metadata.type,
          status: metadata.status,
          sceneCount: script.scenes.length,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
          tags: metadata.tags,
        });
      } catch (error) {
        console.error(`Error reading story ${storyId}:`, error);
      }
    }

    // Sort by updated date (newest first)
    stories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Pagination
    const total = stories.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedStories = stories.slice(start, end);

    return {
      stories: paginatedStories,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  /**
   * Update story script
   */
  async updateScript(storyId: string, script: StoryScript): Promise<ChangesSummary> {
    const story = await this.getStory(storyId);
    if (!story) {
      throw new Error(`Story not found: ${storyId}`);
    }

    const oldScript = story.script;

    // Calculate changes
    const changesSummary: ChangesSummary = {
      scenesAdded: Math.max(0, script.scenes.length - oldScript.scenes.length),
      scenesRemoved: Math.max(0, oldScript.scenes.length - script.scenes.length),
      scenesModified: 0,
      titleChanged: false,
      characterChanged: false,
    };

    // Count modified scenes
    const minLength = Math.min(script.scenes.length, oldScript.scenes.length);
    for (let i = 0; i < minLength; i++) {
      if (JSON.stringify(script.scenes[i]) !== JSON.stringify(oldScript.scenes[i])) {
        changesSummary.scenesModified++;
      }
    }

    // Save updated script
    const storyPath = this.getStoryPath(storyId);
    await writeFile(
      join(storyPath, 'script.json'),
      JSON.stringify(script, null, 2)
    );

    // Update metadata timestamp
    story.metadata.updatedAt = new Date().toISOString();
    await writeFile(
      join(storyPath, 'metadata.json'),
      JSON.stringify(story.metadata, null, 2)
    );

    return changesSummary;
  }

  /**
   * Update story metadata
   */
  async updateMetadata(storyId: string, updates: Partial<StoryMetadata>): Promise<void> {
    const story = await this.getStory(storyId);
    if (!story) {
      throw new Error(`Story not found: ${storyId}`);
    }

    const updatedMetadata = {
      ...story.metadata,
      ...updates,
      id: story.metadata.id, // Prevent ID change
      updatedAt: new Date().toISOString(),
    };

    const storyPath = this.getStoryPath(storyId);
    await writeFile(
      join(storyPath, 'metadata.json'),
      JSON.stringify(updatedMetadata, null, 2)
    );
  }

  /**
   * Update story config
   */
  async updateConfig(storyId: string, updates: Partial<StoryConfig>): Promise<void> {
    const story = await this.getStory(storyId);
    if (!story) {
      throw new Error(`Story not found: ${storyId}`);
    }

    const updatedConfig = {
      ...story.config,
      ...updates,
    };

    const storyPath = this.getStoryPath(storyId);
    await writeFile(
      join(storyPath, 'config.json'),
      JSON.stringify(updatedConfig, null, 2)
    );

    // Update metadata timestamp
    story.metadata.updatedAt = new Date().toISOString();
    await writeFile(
      join(storyPath, 'metadata.json'),
      JSON.stringify(story.metadata, null, 2)
    );
  }

  /**
   * Delete story
   */
  async deleteStory(storyId: string): Promise<DeleteResult> {
    const storyPath = this.getStoryPath(storyId);

    if (!existsSync(storyPath)) {
      throw new Error(`Story not found: ${storyId}`);
    }

    // Calculate total size and file count
    let totalSize = 0;
    let fileCount = 0;

    async function calculateSize(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await calculateSize(entryPath);
        } else {
          const stats = await stat(entryPath);
          totalSize += stats.size;
          fileCount++;
        }
      }
    }

    await calculateSize(storyPath);

    // Delete folder
    await rm(storyPath, { recursive: true, force: true });

    return {
      success: true,
      deleted: {
        folder: storyPath,
        fileCount,
        totalSize,
      },
    };
  }

  /**
   * Save asset to story
   */
  async saveAsset(
    storyId: string,
    type: 'character' | 'prop' | 'location' | 'effect' | 'storyboard',
    filename: string,
    data: Buffer
  ): Promise<string> {
    const storyPath = this.getStoryPath(storyId);
    if (!existsSync(storyPath)) {
      throw new Error(`Story not found: ${storyId}`);
    }

    const assetPath = join(storyPath, 'assets', `${type}s`, filename);
    await writeFile(assetPath, data);

    return `/stories/${storyId}/assets/${type}s/${filename}`;
  }

  /**
   * Get story assets
   */
  async getAssets(storyId: string): Promise<StoryAssets> {
    const storyPath = this.getStoryPath(storyId);
    if (!existsSync(storyPath)) {
      throw new Error(`Story not found: ${storyId}`);
    }

    const assetsPath = join(storyPath, 'assets');
    const assets: StoryAssets = {
      characters: [],
      props: [],
      locations: [],
      effects: [],
      storyboards: [],
    };

    const types: Array<keyof StoryAssets> = ['characters', 'props', 'locations', 'effects', 'storyboards'];

    for (const type of types) {
      const typePath = join(assetsPath, type);
      if (existsSync(typePath)) {
        const files = await readdir(typePath);
        assets[type] = files.map(file => `assets/${type}/${file}`);
      }
    }

    return assets;
  }

  /**
   * Save video for scene
   */
  async saveVideo(storyId: string, sceneId: string, videoBuffer: Buffer): Promise<string> {
    const storyPath = this.getStoryPath(storyId);
    if (!existsSync(storyPath)) {
      throw new Error(`Story not found: ${storyId}`);
    }

    const videoPath = join(storyPath, 'videos', `${sceneId}.mp4`);
    await writeFile(videoPath, videoBuffer);

    return `/stories/${storyId}/videos/${sceneId}.mp4`;
  }

  /**
   * Get video for scene
   */
  async getVideo(storyId: string, sceneId: string): Promise<Buffer | null> {
    const videoPath = join(this.getStoryPath(storyId), 'videos', `${sceneId}.mp4`);

    if (!existsSync(videoPath)) {
      return null;
    }

    return await readFile(videoPath);
  }

  /**
   * Save evaluation for scene
   */
  async saveEvaluation(storyId: string, sceneId: string, evaluation: any): Promise<void> {
    const storyPath = this.getStoryPath(storyId);
    if (!existsSync(storyPath)) {
      throw new Error(`Story not found: ${storyId}`);
    }

    const evaluationPath = join(storyPath, 'evaluations', `${sceneId}.json`);
    await writeFile(evaluationPath, JSON.stringify(evaluation, null, 2));
  }

  /**
   * Get evaluation for scene
   */
  async getEvaluation(storyId: string, sceneId: string): Promise<any | null> {
    const evaluationPath = join(this.getStoryPath(storyId), 'evaluations', `${sceneId}.json`);

    if (!existsSync(evaluationPath)) {
      return null;
    }

    const evaluationJson = await readFile(evaluationPath, 'utf-8');
    return JSON.parse(evaluationJson);
  }
}

export const storyStorage = new StoryStorage();
