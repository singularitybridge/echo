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
# Required for video and image generation via Fal.ai
FAL_KEY=your_fal_api_key_here
NEXT_PUBLIC_FAL_KEY=your_fal_api_key_here

# Required for AI agents (story generation, editing, evaluation)
AGENT_HUB_API_URL=http://localhost:3000/assistant
AGENT_HUB_API_KEY=your_agent_hub_api_key_here

# Optional: Base URL for the application
NEXT_PUBLIC_BASE_URL=http://localhost:3039
```

**Required Services:**
- **Fal.ai**: All video and image generation (Veo 3.1, image editing, character references)
- **Agent Hub**: All AI logic (story generation, story editing, frame evaluation, audio comparison)

**No Direct LLM Usage:** The application does not use Gemini or OpenAI APIs directly. All AI functionality is routed through Agent Hub agents.

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
- `POST /api/assets/analyze` - AI-powered asset analysis (type, name, description)
- `POST /api/assets/upload` - Upload asset image with metadata
- `POST /api/agent-hub/execute` - Internal proxy to Agent Hub (supports vision attachments)
- `GET /api/test-fal` - Test Fal.ai API connection and verify credentials
- Similar structure for `/api/evaluations` and `/api/projects`

### Testing Fal.ai API Connection

To verify your Fal.ai API key is configured correctly:

```bash
# Test via curl
curl http://localhost:3039/api/test-fal

# Or visit in browser
open http://localhost:3039/api/test-fal
```

Expected response:
```json
{
  "success": true,
  "message": "Fal.ai API connection successful",
  "apiKey": "37c0f887...69cc",
  "timestamp": "2025-01-16T..."
}
```

If the API key is invalid or missing, you'll see an error response with details.

### Story Editing System - Agent Hub Integration

The story editing flow uses Agent Hub's `story-editor` agent for all story modifications:

**Story Editor Agent** (Agent Hub: `story-editor`):
- **Purpose**: Edits stories based on user requests and generates explanations
- **Model**: GPT-4.1-mini (via Agent Hub)
- **Service**: `services/storyEditingService.ts`
- **Input**: Current StoryDraft JSON + user's editing request
- **Output**: Complete result including:
  - Modified StoryDraft JSON with requested changes
  - User-friendly 2-3 sentence explanation
  - Changes summary (scenes added/removed/modified, title changes)
- **Capabilities**:
  - Add/remove/reorder scenes
  - Rename characters throughout entire story
  - Modify scene prompts, dialogue, camera angles
  - Maintain story structure and coherence
  - Generate clear user feedback about changes

**API Flow** (`/api/story/edit`):
```
1. User sends edit request + current story
2. API calls storyEditingService.editStory()
3. Service sends prompt to Agent Hub story-editor agent
4. Agent returns: {updatedStory, response, changesSummary}
5. API returns result to client
```

**UI Integration** (`CreateStoryModal.tsx`):
- Simple `fetch()` call to `/api/story/edit` (no streaming needed)
- Single-shot editing (each request is independent)
- Immediate story updates and AI feedback

**Why Agent Hub?**
- **Centralized AI management**: All agents in one platform
- **Easy prompt updates**: Update agent prompts via Agent Hub UI
- **Provider flexibility**: Switch LLM providers without code changes
- **Consistent architecture**: Same pattern for all AI functionality

### Component Architecture

**SceneManager.tsx** (Main editing interface):
- 3-column layout: Scene list (left) | Video player (center) | Controls (right)
- Manages video generation, evaluation, and project state
- Auto-loads character references and persisted videos on mount
- Handles blob URLs → server URLs conversion after generation

**Services Layer**:
- `falService.ts` - Fal.ai Veo 3.1 integration for video and image generation
- `agentHubService.ts` - Agent Hub integration for all AI agents
- `storyEditingService.ts` - Story editing via Agent Hub story-editor agent
- `evaluationService.agentHub.ts` - Frame and audio evaluation via Agent Hub agents
- `videoStorage.server.ts` - Client-side API wrapper for video persistence
- `projectStorage.server.ts` - Project metadata persistence

**Agent Hub Agents**:
- `story-gen-agent` - Generate new stories from user prompts
- `story-editor` - Edit existing stories based on user feedback
- `character-design-expert` - Create character design prompts
- `poses-outfits-expert` - Generate pose and outfit variations
- `frame-eval-agent` - Evaluate video frames against prompts
- `audio-comparison-agent` - Compare transcribed audio with expected voiceover
- `asset-analyzer` - Analyze uploaded images to determine asset type (character/prop/location), name, and description

**Modal Components**:
- `ProjectSettingsModal.tsx` - Configure project name, description, and aspect ratio
- `ReferenceSelectionModal.tsx` - Visual interface for selecting start frame reference
- `CharacterRefsModal.tsx` - View all character references for the project
- `UploadAssetModal.tsx` - Upload and AI-analyze assets (auto-detects type, name, description)

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

Evaluation is performed via Agent Hub agents:
1. **Visual**: First/last frame analysis using Agent Hub's `frame-eval-agent`
2. **Audio**: Audio comparison using Agent Hub's `audio-comparison-agent` (optional)

Score calculation: `(firstFrameScore + lastFrameScore + audioScore) / 3`

All evaluation logic is in `services/evaluationService.agentHub.ts`.

## Important Implementation Details

### Character Reference System
- Auto-loads from `/public/generated-refs/{projectId}/` on SceneManager mount
- **Portrait references**: Up to 10 portrait orientation references: `character-ref-portrait-{1-10}.png` (9:16 aspect ratio)
- **Landscape references**: Up to 10 landscape orientation references: `character-ref-{1-10}.png` (16:9 aspect ratio)
- Reference selection modal allows choosing which reference to use as starting frame for each scene
- First scene defaults to Reference Image 1, subsequent scenes default to "Continue from Previous Shot"
- References uploaded to Fal.ai storage and passed to Veo 3.1 API
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
1. Extend `VideoEvaluation` type in `evaluationService.agentHub.ts`
2. Add analysis logic in `evaluateVideo()` function
3. Update Agent Hub agent prompts for frame-eval-agent and audio-comparison-agent if needed
4. Update SceneManager evaluation results UI

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
   - Frame analysis displays (via Agent Hub)
   - Audio comparison works (via Agent Hub)
   - Overall score calculated

## Troubleshooting

**Videos not persisting**: Check `/public/videos/{projectId}/` directory exists and API routes are working

**Character refs not loading**: Verify files exist at `/public/generated-refs/{projectId}/character-ref-{1,2,3}.png`

**Video generation failing**:
- Check Fal.ai API key (NEXT_PUBLIC_FAL_KEY) in `.env.local`
- Verify reference images are valid and under 8MB
- Check browser console and network tab for errors
- Ensure you have sufficient Fal.ai credits

**Evaluation not working**: Verify Agent Hub API credentials and ensure frame-eval-agent and audio-comparison-agent exist in Agent Hub

**Story editing not working**: Check Agent Hub credentials and ensure story-editor agent exists in Agent Hub

**Export failing**: Ensure FFmpeg is installed on server/system
