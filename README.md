# Echo

> AI-powered video creation platform for artists and creators

Echo combines Fal.ai's Veo 3.1 video generation with Agent Hub's AI capabilities to help creators produce professional short-form videos with consistent characters, intelligent scene composition, and automated quality evaluation.

## Features

### Core Capabilities

- **AI-Driven Scene Generation** - Create video scenes from text descriptions using Fal.ai's Veo 3.1
- **Character Consistency** - Generate character reference sheets automatically to maintain visual consistency across scenes
- **Intelligent Story Creation** - AI-powered story generation and editing via Agent Hub agents
- **Project Management** - Organize videos into projects with multiple scenes and story arcs
- **Automated Quality Evaluation** - AI-powered evaluation of video frames and audio transcription
- **Scene-by-Scene Editing** - Fine-tune individual scenes with custom prompts, durations, and voiceovers
- **Multi-Aspect Ratio Support** - Generate videos in portrait (9:16), landscape (16:9), or square (1:1) formats

### Technical Features

- **Persistent Storage** - All videos and evaluations are automatically saved and persist across sessions
- **Project-Based Organization** - Each project maintains its own namespace for videos, evaluations, and character references
- **Real-Time Preview** - Instant video playback with evaluation results and quality metrics
- **Video Export** - Concatenate and download all project scenes as a single video file
- **Shot Continuity** - Use the last frame of a scene as the starting frame for the next scene
- **Reference Selection** - Choose which character reference to use for each scene

## Tech Stack

- **Framework**: Next.js 15 with App Router and React 19
- **Video Generation**: Fal.ai (Veo 3.1)
- **AI Logic**: Agent Hub (story generation, editing, evaluation)
- **Styling**: Tailwind CSS 4.1 with shadcn-style components
- **Icons**: Lucide React
- **Language**: TypeScript
- **Storage**: File-based persistence with REST API endpoints

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Fal.ai API key ([Get one here](https://fal.ai/dashboard))
- Agent Hub account and API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/singularitybridge/echo.git
cd echo
```

2. Install dependencies:
```bash
npm install
```

3. Configure your API keys:

Copy the example environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
# Required for video and image generation
FAL_KEY=your_fal_api_key_here
NEXT_PUBLIC_FAL_KEY=your_fal_api_key_here

# Required for AI agents (story generation, editing, evaluation)
AGENT_HUB_API_URL=http://localhost:3000/assistant
AGENT_HUB_API_KEY=your_agent_hub_api_key_here

# Optional: Base URL for the application
NEXT_PUBLIC_BASE_URL=http://localhost:3039
```

> **Note**: Both Fal.ai and Agent Hub API keys are required for full functionality.

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3039](http://localhost:3039) in your browser

### Testing API Connections

Verify your Fal.ai connection:
```bash
curl http://localhost:3039/api/test-fal
```

Expected response:
```json
{
  "success": true,
  "message": "Fal.ai API connection successful"
}
```

### First Steps

1. The app will load with the project list homepage
2. Click "Create New Story" to generate a story using AI
3. Or select an existing project to open the scene editor
4. Character references are loaded automatically from `/public/generated-refs/[project-id]/`
5. Select a scene from the left panel
6. Click "Generate Video" in the right panel to create your first video
7. Use "Evaluate Video" to get AI-powered quality metrics

## Usage

### Creating Your First Project

#### Option 1: AI Story Generation
1. Click "Create New Story" on the homepage
2. Enter a story prompt (e.g., "A cat discovers the benefits of dry food")
3. The AI will generate a complete 4-scene story with prompts and dialogue
4. Edit the story using natural language commands
5. Generate videos for each scene

#### Option 2: Manual Project Creation
1. Create a new project JSON file in `/data/`
2. Define scenes with prompts, voiceovers, and camera angles
3. Add the project to `/data/projects.db.json`
4. Generate character references and videos

### Project Structure

```
echo/
├── app/                           # Next.js app directory
│   ├── api/                       # API routes
│   │   ├── agent-hub/             # Agent Hub proxy
│   │   ├── story/                 # Story editing endpoints
│   │   ├── videos/                # Video persistence
│   │   ├── evaluations/           # Evaluation storage
│   │   └── test-fal/              # Fal.ai connection test
│   ├── projects/                  # Dynamic project pages
│   └── page.tsx                   # Homepage
├── components/                    # React components
│   ├── SceneManager.tsx           # Main scene editing interface
│   ├── CreateStoryModal.tsx       # AI story creation UI
│   └── ProjectList.tsx            # Project selection grid
├── services/                      # Business logic and API clients
│   ├── falService.ts              # Fal.ai Veo 3.1 integration
│   ├── agentHubService.ts         # Agent Hub integration
│   ├── storyEditingService.ts     # Story editing via Agent Hub
│   ├── evaluationService.agentHub.ts # Video evaluation
│   └── videoStorage.server.ts     # Video persistence
├── types/                         # TypeScript type definitions
├── data/                          # Project data (JSON files)
└── public/                        # Static assets and generated content
    ├── videos/                    # Generated video files
    ├── evaluations/               # Evaluation results
    └── generated-refs/            # Character reference sheets
```

## Agent Hub Agents

Echo uses 6 Agent Hub agents for different AI tasks:

1. **story-gen-agent** - Generate new stories from user prompts
2. **story-editor** - Edit existing stories based on user feedback
3. **character-design-expert** - Create character design prompts
4. **poses-outfits-expert** - Generate pose and outfit variations
5. **frame-eval-agent** - Evaluate video frames against prompts (0-100 score)
6. **audio-comparison-agent** - Compare transcribed audio with expected voiceover

All agents are managed through Agent Hub, allowing easy prompt updates and provider switching.

## API Documentation

### Video Generation

Echo uses Fal.ai's Veo 3.1 API for video generation:

- **Model**: Veo 3.1
- **Duration**: 4s, 6s, or 8s per scene
- **Resolution**: 720p or 1080p
- **Aspect Ratios**: 9:16 (portrait), 16:9 (landscape), 1:1 (square)
- **Format**: MP4
- **Features**: Character references (up to 3), shot continuity, audio generation

### Evaluation System

The evaluation service analyzes:

- **Frame Analysis**: First and last frame visual quality assessment (via Agent Hub)
- **Audio Comparison**: Compare transcribed audio with expected voiceover (via Agent Hub)
- **Overall Score**: Average of frame and audio scores (0-100)

### Story Editing

Stories can be edited using natural language commands:
- Add/remove scenes
- Modify scene prompts and dialogue
- Rename characters throughout the story
- Change story title and description

## Architecture

### External Services

```
External Services (Only 2):
├── Fal.ai → All video & image generation
└── Agent Hub → All AI logic
    ├── Story generation
    ├── Story editing
    ├── Frame evaluation
    └── Audio comparison
```

### Data Flow

1. **Project Loading**: Projects loaded from `/data/*.json` files
2. **Video Generation**: Fal.ai Veo 3.1 → saved to `/public/videos/{projectId}/{sceneId}.mp4`
3. **Character References**: Uploaded to Fal.ai storage, stored in `/public/generated-refs/`
4. **Evaluations**: Saved to `/public/evaluations/{projectId}/{sceneId}.json`
5. **Project State**: Auto-saved to server via API routes (1-second debounce)

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Video generation powered by [Fal.ai](https://fal.ai/)
- AI agents managed by [Agent Hub](https://agent-hub.com/)
- UI components inspired by [shadcn/ui](https://ui.shadcn.com/)
- Icons by [Lucide](https://lucide.dev/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Roadmap

- [ ] Multi-language support
- [ ] Advanced character customization
- [ ] Batch video generation
- [ ] Cloud storage integration
- [ ] Collaborative editing
- [ ] Video timeline editor
- [ ] Audio library integration
- [ ] Export to social media platforms
- [ ] More video models (Runway, Pika, etc.)

---

Built with ❤️ by the Echo community
