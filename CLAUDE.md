# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Echo is an AI-powered video creation platform built with Next.js 15 that generates short-form videos using Fal.ai's Veo 3.1 API. The application features character consistency across scenes, project-based organization, and AI-powered video quality evaluation.

## Development Commands

```bash
# Development server (runs on port 3039)
npm run dev

# Production build
npm run build

# Production server
npm run start

# Process manager (if using PM2)
pm2 start ecosystem.config.cjs
pm2 logs veo-studio --lines 50 --nostream
pm2 restart veo-studio
```

**Important**: The app runs on port **3039** by default, not 3000.

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
# Required for Veo 3.1 video generation via Fal.ai
NEXT_PUBLIC_FAL_KEY=your_fal_api_key_here

# Required for Gemini text generation (story editing, evaluations)
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here

# Optional for audio transcription in evaluations
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here

# Required for AI story generation via Agent Hub
AGENT_HUB_API_URL=http://localhost:3000/assistant
AGENT_HUB_API_KEY=your_agent_hub_api_key_here
```

The Fal.ai API key is **required** for video generation. Gemini API key is required for text generation (story editing) and evaluations. Agent Hub credentials are required for AI story creation. OpenAI API key is optional (only needed for audio transcription during evaluation).

## Architecture & Key Concepts

### Data Flow Architecture

1. **Project Loading**: Projects are loaded from `/data/*.json` files (static project definitions)
2. **Video Generation**: Fal.ai Veo 3.1 API generates videos → saved to `/public/videos/{projectId}/{sceneId}.mp4`
3. **Character References**: Reference images uploaded to Fal.ai storage, stored in `/public/generated-refs/{projectId}/character-ref-{1,2,3}.png`
4. **Evaluations**: Saved to `/public/evaluations/{projectId}/{sceneId}.json`
5. **Project State**: Auto-saved to server via API routes with 1-second debounce

### Storage & Persistence

- **File-based storage**: No database required
- **Project namespacing**: Each project has isolated storage for videos, evaluations, and references
- **Server-side storage**: Videos and evaluations persisted via Next.js API routes
- **Client state**: React state + localStorage for temporary data

### API Routes Structure

- `POST /api/videos` - Save video for a scene
- `GET /api/videos?projectId={id}` - Get all videos for a project
- `DELETE /api/videos?projectId={id}&sceneId={id}` - Delete a video
- `POST /api/export` - Concatenate and export all project videos using FFmpeg
- `POST /api/story/edit` - Single-shot story editing using dual-agent system
- Similar structure for `/api/evaluations` and `/api/projects`

### Dual-Agent Story Editing System

The story creation flow uses a dual-agent architecture for editing stories:

**1. Script Editing Agent** (`services/scriptEditingAgent.ts`):
- **Purpose**: Makes precise structural changes to the story JSON
- **Model**: Gemini 2.0 Flash Thinking Exp (for complex reasoning)
- **Temperature**: 0.2 (very low for precise edits)
- **Input**: Current StoryDraft JSON + user's editing request
- **Output**: Modified StoryDraft JSON with requested changes
- **Capabilities**:
  - Add/remove/reorder scenes
  - Rename characters throughout entire story
  - Modify scene prompts, dialogue, camera angles
  - Maintain story structure and coherence
- **Prompt Location**: `.agents/script-editing-agent/prompt.md`

**2. Review Agent** (`services/reviewAgent.ts`):
- **Purpose**: Generates user-friendly explanations of changes
- **Model**: Gemini 2.0 Flash Exp (for natural language)
- **Temperature**: 0.7 (medium for conversational tone)
- **Input**: Original story + refined story + user request
- **Output**: Friendly 2-3 sentence explanation of changes
- **Capabilities**:
  - Analyzes structural changes (scenes added/removed/modified)
  - Detects title and character name changes
  - Generates specific, helpful responses
- **Prompt Location**: `.agents/review-agent/prompt.md`

**API Flow** (`/api/story/edit`):
```
1. User sends edit request + current story
2. Script Editing Agent modifies the story
3. Review Agent analyzes changes and generates response
4. Return: {updatedStory, response, changesSummary}
```

**UI Integration** (`CreateStoryModal.tsx`):
- Simple `fetch()` call to `/api/story/edit` (no streaming needed)
- Single-shot editing (each request is independent)
- Immediate story updates and AI feedback

**Why Dual Agents?**
- **Separation of concerns**: Structural editing vs. user communication
- **Optimal model selection**: Thinking model for edits, standard model for responses
- **Better UX**: Clear explanations of what changed and why
- **Maintainability**: Agent prompts stored in `.agents/` directory for easy updates

See `docs/STORY_EDIT_API_IMPLEMENTATION.html` for full implementation details and testing results.

### Component Architecture

**SceneManager.tsx** (Main editing interface):
- 3-column layout: Scene list (left) | Video player (center) | Controls (right)
- Manages video generation, evaluation, and project state
- Auto-loads character references and persisted videos on mount
- Handles blob URLs → server URLs conversion after generation

**Services Layer**:
- `falService.ts` - Fal.ai Veo 3.1 integration for video generation
- `geminiService.ts` - Gemini AI for text generation (story editing) and evaluations
- `evaluationService.ts` - Frame extraction, Gemini vision evaluation, Whisper transcription
- `videoStorage.server.ts` - Client-side API wrapper for video persistence
- `projectStorage.server.ts` - Project metadata persistence

**Modal Components**:
- `ProjectSettingsModal.tsx` - Configure project name, description, and aspect ratio
- `ReferenceSelectionModal.tsx` - Visual interface for selecting start frame reference
- `CharacterRefsModal.tsx` - View all character references for the project

### Project Settings UI

The Project Settings modal allows users to configure:
- **Project Information**: Name and description
- **Video Settings**:
  - Aspect Ratio (applies to all scenes in project): 9:16 Portrait, 16:9 Landscape, or 1:1 Square
  - Default Model (for new scenes): Veo 3.1
  - Default Resolution (for new scenes): 720p or 1080p

Accessed via Settings2 button in the main header. Changes are auto-saved via `projectStorage.saveProject()`.

### Reference Selection UI

The Reference Selection modal provides a visual interface for choosing the starting frame for each scene:
- **Continue from Previous Shot**: Uses the last frame of the previous scene (default for scenes 2+)
- **Reference Images**: Visual thumbnails of all available character references (default for scene 1)
- Selected reference is highlighted with checkmark and border
- Changes are saved immediately to scene's `referenceMode` field

### Video Generation Flow

1. User clicks "Generate Video" in SceneManager
2. Prompt built from: `scene.prompt + voiceover (as dialogue) + camera angle`
3. Character references uploaded to Fal.ai storage
4. Fal.ai Veo 3.1 API call via `falService.ts`
5. Video blob downloaded and saved to server via `videoStorage.saveVideo()`
6. Scene updated with server URL for persistence

**Note**: Switched from Gemini API to Fal.ai due to quota limitations. Fal.ai provides:
- Reliable Veo 3.1 video generation
- Built-in reference image upload
- Audio generation support
- Clear pricing: $0.40/second (with audio)

### Evaluation System

Two-part evaluation:
1. **Visual**: First/last frame analysis using Gemini 2.0 Flash vision
2. **Audio**: Whisper transcription + Gemini text comparison (optional, requires OpenAI key)

Score calculation: `(firstFrameScore + lastFrameScore + audioScore) / 3`

## Important Implementation Details

### Character Reference System
- Auto-loads from `/public/generated-refs/{projectId}/` on SceneManager mount
- **Portrait references**: Up to 10 portrait orientation references: `character-ref-portrait-{1-10}.png` (9:16 aspect ratio)
- **Landscape references**: Up to 10 landscape orientation references: `character-ref-{1-10}.png` (16:9 aspect ratio)
- Reference selection modal allows choosing which reference to use as starting frame for each scene
- First scene defaults to Reference Image 1, subsequent scenes default to "Continue from Previous Shot"
- References sent as `VideoGenerationReferenceType.ASSET` to Gemini API
- Must exist before generation (generate button disabled if missing)

### Video URL Handling
- **Generation**: Creates blob URL → saves to server → updates scene with server URL
- **Loading**: Fetches from server and sets videoUrl in scene state
- **Server URLs**: Format `/videos/{projectId}/{sceneId}.mp4`

### Prompt Engineering for Veo 3.1
Dialogue format: `A woman says, "dialogue text" (no subtitles)`
- Keep dialogue 12-25 words for 8-second clips
- Append camera angle after dialogue
- Example: `Woman on beach at sunset. A woman says, "Freedom feels like the ocean breeze" (no subtitles). Medium shot`

### Project Data Structure
```typescript
Project {
  id, title, description, type, character

  // Project-level generation settings (applies to all scenes)
  aspectRatio: AspectRatio;  // "9:16" | "16:9" | "1:1" - applies to all scenes
  defaultModel: VeoModel;    // "Veo 3.1" - default for new scenes
  defaultResolution: Resolution;  // "720p" | "1080p" - default for new scenes

  createdAt, updatedAt

  scenes: [{
    id, title, duration, prompt, cameraAngle, voiceover

    // Scene-level generation settings
    generated, videoUrl, settings: {
      model: VeoModel;
      resolution: Resolution;
      isLooping: boolean;
      // aspectRatio comes from project level
    }

    // Reference selection for video generation
    referenceMode: 'previous' | number;  // 'previous' = use previous shot's last frame, number = specific reference (1-based)
    lastFrameDataUrl?: string;  // Captured last frame for shot continuity

    // Evaluation data
    evaluation: { audioEvaluation, firstFrameEvaluation, lastFrameEvaluation, overallScore }
  }]
}
```

## Common Modifications

### Adding New Scene Properties
1. Update `types/project.ts` Scene interface
2. Modify SceneManager UI to display/edit new property
3. Update prompt building logic in `buildVeoPrompt()` if needed

### Modifying Video Generation Settings

**For Project-Level Settings (Aspect Ratio)**:
1. Update `types/index.ts` for new AspectRatio values
2. Add UI controls in ProjectSettingsModal
3. Update video generation logic to use `project.aspectRatio`

**For Scene-Level Settings (Model, Resolution)**:
1. Update `types/index.ts` for new VeoModel/Resolution values
2. Add UI controls in SceneManager settings panel
3. Ensure `currentSettings` state includes new options

### Adding New Evaluation Metrics
1. Extend `VideoEvaluation` type in `evaluationService.ts`
2. Add analysis logic in `evaluateVideo()` function
3. Update SceneManager evaluation results UI

### Creating Custom Projects
Add JSON file to `/data/`:
```json
{
  "id": "unique-id",
  "title": "Project Title",
  "description": "Project description",
  "type": "short",
  "character": "Character name and description (optional)",

  "aspectRatio": "9:16",
  "defaultModel": "Veo 3.1",
  "defaultResolution": "720p",

  "scenes": [
    {
      "id": "scene-1",
      "title": "Scene Title",
      "duration": 8,
      "prompt": "Visual description",
      "cameraAngle": "Medium shot",
      "voiceover": "Optional dialogue",
      "generated": false
    }
  ]
}
```

Then update `/data/projects.db.json` by adding the project to the `projects` object:
```json
{
  "projects": {
    "unique-id": {
      "id": "unique-id",
      "title": "Project Title",
      ...
    }
  }
}
```

## Design System

- **Framework**: Tailwind CSS 4.1 with shadcn-style components
- **No gradients**: Use solid colors only
- **Icons**: Lucide React exclusively
- **Color palette**:
  - Primary: `indigo-600`
  - Success: `green-600`
  - Warning: `yellow-600`
  - Error: `red-600`
  - Neutral: `gray-100` to `gray-900`

## Testing Workflow

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3039`
3. Select a project from homepage
4. Verify character refs load (check browser console)
5. Generate videos and check:
   - Video appears in player
   - Server URL saved (check Network tab)
   - Video persists on page reload
6. Run evaluation and verify:
   - Frame analysis displays
   - Audio transcription works (if OpenAI key provided)
   - Overall score calculated

## Troubleshooting

**Videos not persisting**: Check `/public/videos/{projectId}/` directory exists and API routes are working

**Character refs not loading**: Verify files exist at `/public/generated-refs/{projectId}/character-ref-{1,2,3}.png`

**Video generation failing**:
- Check Fal.ai API key (NEXT_PUBLIC_FAL_KEY) in `.env.local`
- Verify reference images are valid and under 8MB
- Check browser console and network tab for errors
- Ensure you have sufficient Fal.ai credits

**Evaluation not working**: Verify Gemini API key for frame analysis, OpenAI key for audio (optional)

**Story editing not working**: Check Gemini API key and Agent Hub credentials in `.env.local`

**Export failing**: Ensure FFmpeg is installed on server/system
