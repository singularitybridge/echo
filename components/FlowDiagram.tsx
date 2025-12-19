'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ConnectionLineType,
  MarkerType,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Override ReactFlow default node styling to remove borders
const nodeWrapperStyle = `
  .react-flow__node {
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
  }
`;

// Invisible handle style
const handleStyle = "!bg-transparent !w-2 !h-2 !border-0 !opacity-0";

// Custom node component for process steps
function ProcessNode({ data }: { data: { label: string; description?: string } }) {
  return (
    <div className="px-5 py-3 bg-neutral-800 rounded-lg min-w-[140px] text-center">
      <Handle type="target" position={Position.Left} className={handleStyle} />
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <div className="text-white font-medium text-sm">{data.label}</div>
      {data.description && (
        <div className="text-neutral-400 text-xs mt-0.5">{data.description}</div>
      )}
      <Handle type="source" position={Position.Right} className={handleStyle} />
      <Handle type="source" position={Position.Bottom} className={handleStyle} />
    </div>
  );
}

// Custom node component for outputs
function OutputNode({ data }: { data: { label: string; items?: string[] } }) {
  return (
    <div className="px-5 py-3 bg-white border border-neutral-200 rounded-lg min-w-[140px] text-center shadow-sm">
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <Handle type="target" position={Position.Left} className={handleStyle} />
      <div className="text-neutral-700 font-medium text-sm">{data.label}</div>
      {data.items && (
        <div className="text-neutral-400 text-xs mt-1 space-y-0.5">
          {data.items.map((item, i) => (
            <div key={i}>{item}</div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className={handleStyle} />
      <Handle type="source" position={Position.Bottom} className={handleStyle} />
    </div>
  );
}

// Custom node component for input/start nodes
function InputNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-5 py-3 bg-indigo-600 rounded-full text-center">
      <div className="text-white font-medium text-sm">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className={handleStyle} />
      <Handle type="source" position={Position.Right} className={handleStyle} />
    </div>
  );
}

// Custom node component for end/result nodes
function ResultNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-5 py-3 bg-indigo-600 rounded-full text-center">
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <Handle type="target" position={Position.Left} className={handleStyle} />
      <div className="text-white font-medium text-sm">{data.label}</div>
    </div>
  );
}

// Group/container node
function GroupNode({ data }: { data: { label: string } }) {
  return (
    <div className="absolute -top-6 left-0 right-0 text-center">
      <span className="text-xs font-medium text-neutral-500 bg-white px-2 py-0.5 rounded">
        {data.label}
      </span>
    </div>
  );
}

const nodeTypes = {
  process: ProcessNode,
  output: OutputNode,
  input: InputNode,
  result: ResultNode,
  group: GroupNode,
};

interface FlowDiagramProps {
  diagram: 'story-creation' | 'complete-flow';
  className?: string;
}

// Story Creation Flow diagram
const storyCreationNodes: Node[] = [
  {
    id: 'director',
    type: 'process',
    position: { x: 0, y: 100 },
    data: { label: 'Director', description: 'Persona' },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: 'story-gen',
    type: 'process',
    position: { x: 200, y: 100 },
    data: { label: 'Story', description: 'Generation' },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: 'storyboard',
    type: 'process',
    position: { x: 400, y: 100 },
    data: { label: 'Storyboard', description: 'Designer' },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: 'style-guide',
    type: 'output',
    position: { x: 0, y: 220 },
    data: { label: 'Style Guide', items: ['+ Guidelines'] },
    sourcePosition: Position.Right,
    targetPosition: Position.Top,
  },
  {
    id: 'script',
    type: 'output',
    position: { x: 200, y: 220 },
    data: { label: '4-Scene Script', items: ['+ Dialogue', '+ Direction'] },
    sourcePosition: Position.Right,
    targetPosition: Position.Top,
  },
  {
    id: 'frames',
    type: 'output',
    position: { x: 400, y: 220 },
    data: { label: 'Visual Frames', items: ['+ Acting Direction'] },
    sourcePosition: Position.Right,
    targetPosition: Position.Top,
  },
];

const storyCreationEdges: Edge[] = [
  {
    id: 'e1',
    source: 'director',
    target: 'story-gen',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#525252', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#525252', width: 20, height: 20 },
  },
  {
    id: 'e2',
    source: 'story-gen',
    target: 'storyboard',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#525252', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#525252', width: 20, height: 20 },
  },
  {
    id: 'e3',
    source: 'director',
    target: 'style-guide',
    type: 'smoothstep',
    style: { stroke: '#a3a3a3', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#a3a3a3', width: 16, height: 16 },
  },
  {
    id: 'e4',
    source: 'story-gen',
    target: 'script',
    type: 'smoothstep',
    style: { stroke: '#a3a3a3', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#a3a3a3', width: 16, height: 16 },
  },
  {
    id: 'e5',
    source: 'storyboard',
    target: 'frames',
    type: 'smoothstep',
    style: { stroke: '#a3a3a3', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#a3a3a3', width: 16, height: 16 },
  },
];

// Complete Flow diagram
const completeFlowNodes: Node[] = [
  // Input
  {
    id: 'user-request',
    type: 'input',
    position: { x: 300, y: 0 },
    data: { label: 'User Request' },
    sourcePosition: Position.Bottom,
  },
  // Director Setup
  {
    id: 'select-director',
    type: 'process',
    position: { x: 50, y: 100 },
    data: { label: 'Select Director', description: 'Persona' },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  },
  {
    id: 'style-inject',
    type: 'output',
    position: { x: 50, y: 220 },
    data: { label: 'Style Guide', items: ['Injection'] },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  },
  // Story Generation
  {
    id: 'story-agent',
    type: 'process',
    position: { x: 250, y: 100 },
    data: { label: 'story-gen-agent', description: 'Generates: 4 scenes' },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: 'story-editor',
    type: 'process',
    position: { x: 250, y: 220 },
    data: { label: 'story-editor', description: 'Refines story' },
    sourcePosition: Position.Right,
    targetPosition: Position.Top,
  },
  {
    id: 'feedback',
    type: 'output',
    position: { x: 250, y: 340 },
    data: { label: 'User Feedback' },
    sourcePosition: Position.Top,
    targetPosition: Position.Top,
  },
  // Storyboard
  {
    id: 'sb-designer',
    type: 'process',
    position: { x: 450, y: 160 },
    data: { label: 'storyboard-designer', description: 'Creates prompts' },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  // Media Generation
  {
    id: 'flux',
    type: 'process',
    position: { x: 650, y: 100 },
    data: { label: 'Flux Image', description: '(Fal.ai)' },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Left,
  },
  {
    id: 'veo',
    type: 'process',
    position: { x: 650, y: 220 },
    data: { label: 'Veo 3.1 Video', description: '(Fal.ai)' },
    sourcePosition: Position.Right,
    targetPosition: Position.Top,
  },
  // Output
  {
    id: 'final',
    type: 'result',
    position: { x: 650, y: 340 },
    data: { label: 'Final Videos' },
    targetPosition: Position.Top,
  },
];

const completeFlowEdges: Edge[] = [
  { id: 'cf1', source: 'user-request', target: 'select-director', type: 'smoothstep', animated: true, style: { stroke: '#525252', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#525252', width: 20, height: 20 } },
  { id: 'cf2', source: 'select-director', target: 'style-inject', type: 'smoothstep', style: { stroke: '#a3a3a3', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#a3a3a3', width: 16, height: 16 } },
  { id: 'cf3', source: 'style-inject', target: 'story-agent', type: 'smoothstep', animated: true, style: { stroke: '#525252', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#525252', width: 20, height: 20 } },
  { id: 'cf4', source: 'story-agent', target: 'story-editor', type: 'smoothstep', animated: true, style: { stroke: '#525252', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#525252', width: 20, height: 20 } },
  { id: 'cf5', source: 'feedback', target: 'story-editor', type: 'smoothstep', style: { stroke: '#a3a3a3', strokeWidth: 1.5, strokeDasharray: '6,4' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#a3a3a3', width: 16, height: 16 } },
  { id: 'cf6', source: 'story-editor', target: 'sb-designer', type: 'smoothstep', animated: true, style: { stroke: '#525252', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#525252', width: 20, height: 20 } },
  { id: 'cf7', source: 'sb-designer', target: 'flux', type: 'smoothstep', animated: true, style: { stroke: '#525252', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#525252', width: 20, height: 20 } },
  { id: 'cf8', source: 'flux', target: 'veo', type: 'smoothstep', animated: true, style: { stroke: '#525252', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#525252', width: 20, height: 20 } },
  { id: 'cf9', source: 'veo', target: 'final', type: 'smoothstep', animated: true, style: { stroke: '#4f46e5', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5', width: 20, height: 20 } },
];

export default function FlowDiagram({ diagram, className = '' }: FlowDiagramProps) {
  const initialNodes = diagram === 'story-creation' ? storyCreationNodes : completeFlowNodes;
  const initialEdges = diagram === 'story-creation' ? storyCreationEdges : completeFlowEdges;

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const height = diagram === 'story-creation' ? 380 : 450;

  return (
    <div className={`my-8 rounded-xl overflow-hidden bg-white ${className}`} style={{ height }}>
      <style>{nodeWrapperStyle}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#525252', strokeWidth: 2 },
        }}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
      >
        <Background color="#f5f5f5" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
