# Asset Generation Chat-Based Redesign

## Overview
Redesign the Generate Assets feature to use a chat-based interface matching the Iterative AI Editing UX pattern used in story creation.

## Current Implementation Analysis

### Current Generate Assets Modal
- **Location**: Triggered from Asset Library page's "Generate" button
- **UI**: Traditional form-based modal with:
  - Asset Type selector (Character, Prop, Location)
  - Description textarea
  - Aspect Ratio selector (1:1, 16:9, 9:16)
  - Number of Variations dropdown (3-6)
  - AI Provider dropdown (Gemini)
  - Single "Generate" button

### Problems with Current Implementation
1. **UI Rendering Bug**: Generated images appear as black boxes (unselected ones don't paint to screen)
   - See `ASSET_GENERATION_TESTING_RESULTS.md` for full analysis
   - Images ARE generated correctly, but browser doesn't render them
   - Only selected images display properly
2. **No iterative refinement**: One-shot generation only
3. **No history**: Can't see previous generations
4. **Limited feedback**: Just generates images without explanation
5. **No conversation**: Can't ask AI to modify or adjust results

## Iterative AI Editing Pattern Analysis

### Key Components from CreateStoryModal.tsx

**1. Layout Structure** (lines 752-792):
```tsx
{/* Main Content: 2-Column Layout */}
<div className="flex-1 overflow-hidden flex">
  {/* Left: Preview/Content */}
  <div className="flex-1 overflow-y-auto p-8">
    {/* Content here */}
  </div>

  {/* Right: Chat Panel */}
  <div className="w-96 border-l border-gray-200 bg-gray-50 flex flex-col">
    {/* Chat components */}
  </div>
</div>
```

**2. Chat Header** (lines 794-802):
```tsx
<div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
  <div className="flex items-center gap-2">
    <Edit3 className="w-5 h-5 text-indigo-600" />
    <h3 className="font-semibold text-gray-900">Refine Your Story</h3>
  </div>
  <p className="text-xs text-gray-600 mt-1">
    Chat with AI to make changes
  </p>
</div>
```

**3. Chat Messages Area** (lines 805-898):
```tsx
<div className="flex-1 overflow-y-auto p-4 space-y-4">
  {messages.length === 0 ? (
    {/* Empty state */}
    <div className="text-center py-8">
      <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">Start a conversation...</p>
      <p className="text-xs text-gray-400 mt-1">e.g., "..."</p>
    </div>
  ) : (
    {/* Message list */}
    messages.map((message) => (
      <div className={message.role === 'user' ? 'justify-end' : 'justify-start'}>
        {/* Message bubble */}
      </div>
    ))
  )}

  {/* Loading indicator */}
  {isRefining && <Loader2 />}

  {/* Scroll anchor */}
  <div ref={chatEndRef} />
</div>
```

**4. Chat Input** (lines 901-925):
```tsx
<form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
  <div className="flex gap-2">
    <textarea
      value={chatInput}
      onChange={(e) => setChatInput(e.target.value)}
      onKeyDown={handleKeyDown} // Cmd+Enter support
      rows={2}
      placeholder="Type your message... (Cmd+Enter to send)"
      className="..."
      disabled={isRefining}
    />
    <button type="submit" disabled={!chatInput.trim() || isRefining}>
      Send
    </button>
  </div>
</form>
```

**5. Message State** (lines 73-76):
```tsx
const [messages, setMessages] = useState<Array<{
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}>>([]);
const [chatInput, setChatInput] = useState('');
const [isRefining, setIsRefining] = useState(false);
```

**6. Auto-scroll Logic** (lines 125-130):
```tsx
const chatEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  chatEndRef.current?.scrollIntoView({behavior: 'smooth'});
}, [messages]);
```

## New Design: AssetGenerationChatModal

### Component Structure
```
AssetGenerationChatModal/
├── State Management
│   ├── Asset configuration (type, aspectRatio, variations)
│   ├── Generated assets array
│   ├── Chat messages history
│   ├── Chat input & loading states
│   └── Selected assets for saving
│
├── Left Panel (Preview)
│   ├── Asset grid (2-3 columns)
│   ├── Asset cards with:
│   │   ├── Image preview
│   │   ├── Metadata (type, size, timestamp)
│   │   ├── Actions (select, download, delete)
│   │   └── Selection indicator
│   └── Empty state (when no assets)
│
└── Right Panel (Chat)
    ├── Chat header
    ├── Messages area (scrollable)
    │   ├── Empty state with examples
    │   ├── User messages (blue, right-aligned)
    │   ├── Assistant messages (white, left-aligned)
    │   └── Loading indicator
    ├── Chat input (textarea + send button)
    └── Keyboard shortcuts (Cmd+Enter)
```

### Features
1. **Initial Generation**: User describes what they want in chat
2. **Iterative Refinement**: "Make it darker", "Add more detail", "Change the background"
3. **Variation Control**: "Generate 3 more variations", "Try a different style"
4. **History**: See all previous generations and requests
5. **Preview**: View all generated assets on the left
6. **Save**: Select and save assets to the library

### Example User Flow
1. Click "Generate" in Asset Library
2. Modal opens with empty state on both sides
3. User types: "Create a detective character in noir style"
4. AI generates 3 variations, shows them on left, responds in chat
5. User: "Make the second one darker"
6. AI updates that asset, explains changes
7. User: "Perfect! Generate a fedora hat as a prop"
8. AI generates hat variations
9. User clicks "Save Selected Assets" to add to library

## Implementation Plan

### Phase 1: Create New Component
- [x] Document design pattern analysis
- [ ] Create `components/assets/AssetGenerationChatModal.tsx`
- [ ] Implement two-column layout
- [ ] Add chat interface (reuse CreateStoryModal patterns)
- [ ] Add asset preview grid

### Phase 2: API Integration
- [ ] Create `/api/assets/generate-chat` route
- [ ] Implement chat-based asset generation
- [ ] Handle iterative refinement requests
- [ ] Return conversational responses

### Phase 3: Integration
- [ ] Update Asset Library to use new modal
- [ ] Test generation flow
- [ ] Test refinement flow
- [ ] Add save functionality

## API Design

### Request Format
```typescript
{
  message: string;  // User's chat message
  assetType?: 'character' | 'prop' | 'location';
  aspectRatio?: '1:1' | '16:9' | '9:16';
  variations?: number;
  previousAssets?: Asset[];  // For context
  conversationHistory?: ChatMessage[];  // For refinement
}
```

### Response Format
```typescript
{
  assets: Array<{
    id: string;
    imageUrl: string;
    blob: Blob;
    metadata: {
      type: string;
      aspectRatio: string;
      prompt: string;
      timestamp: number;
    };
  }>;
  response: string;  // Conversational response
  timestamp: number;
}
```

## Styling Consistency

Match CreateStoryModal styling:
- User messages: `bg-indigo-600 text-white`
- Assistant messages: `bg-white border border-gray-200`
- Chat panel: `bg-gray-50`
- Borders: `border-gray-200`
- Same typography and spacing
- Icons from lucide-react

## Benefits

1. **Iterative**: Users can refine until perfect
2. **Conversational**: Natural language interaction
3. **History**: See all generations and refinements
4. **Flexible**: Generate multiple asset types in one session
5. **Consistent**: Matches story creation UX pattern
6. **Better UX**: More intuitive than form-based approach
