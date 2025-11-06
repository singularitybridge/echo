/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Sparkles
} from 'lucide-react';

interface AgentDetails {
  prompt: string;
  tests: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

interface TestResult {
  passed: boolean;
  score: number;
  details: string;
  errors: string[];
  output?: any;
  duration: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  const [agentDetails, setAgentDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [runningTests, setRunningTests] = useState<Record<string, boolean>>({});

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-grow textarea
  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto';
      chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
    }
  }, [chatInput]);

  // Load agent details
  useEffect(() => {
    const loadAgentDetails = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/agents/${agentId}`);
        if (!response.ok) {
          console.error('Failed to load agent details');
          setLoading(false);
          return;
        }

        const data = await response.json();
        setAgentDetails(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load agent details:', err);
        setLoading(false);
      }
    };

    loadAgentDetails();
  }, [agentId]);

  const handleRunTest = async (testId: string) => {
    const testKey = `${agentId}-${testId}`;
    setRunningTests((prev) => ({ ...prev, [testKey]: true }));

    try {
      const response = await fetch(`/api/agents/${agentId}/tests/${testId}/run`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Test execution failed');
      }

      const result: TestResult = await response.json();
      setTestResults((prev) => ({ ...prev, [testKey]: result }));
    } catch (error) {
      console.error('Failed to run test:', error);
      setTestResults((prev) => ({
        ...prev,
        [testKey]: {
          passed: false,
          score: 0,
          details: 'Test execution failed',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          duration: 0,
        },
      }));
    } finally {
      setRunningTests((prev) => ({ ...prev, [testKey]: false }));
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages,
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-600" />
          <p className="text-gray-600 text-sm">Loading agent...</p>
        </div>
      </div>
    );
  }

  if (!agentDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Agent not found</p>
          <button
            onClick={() => router.push('/agents')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to Agents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - AssetLibrary Style */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/agents')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Agents
              </button>
              <div className="flex items-center gap-3">
                <Bot className="w-6 h-6 text-indigo-600" />
                <h1 className="text-2xl font-semibold text-gray-900">
                  {agentId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Two Column Layout */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Agent Details */}
          <div className="space-y-6">
            {/* Agent Prompt Section */}
            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-t-lg"
              >
                <h3 className="text-base font-semibold text-gray-900">System Prompt</h3>
                {promptExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>
              {promptExpanded && (
                <div className="px-6 pb-6 border-t border-gray-200">
                  <div className="mt-4 rounded-md bg-gray-50 p-4 max-h-96 overflow-y-auto">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                      {agentDetails.prompt}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Tests Section */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Tests & Verifications</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Run automated tests to verify agent behavior
                </p>
              </div>
              <div className="p-6">
                {agentDetails.tests.length === 0 ? (
                  <p className="text-sm text-gray-500">No tests available for this agent.</p>
                ) : (
                  <div className="space-y-4">
                    {agentDetails.tests.map((test) => {
                      const testKey = `${agentId}-${test.id}`;
                      const isRunning = runningTests[testKey];
                      const result = testResults[testKey];

                      return (
                        <div key={test.id} className="space-y-3">
                          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <div className="flex-1 min-w-0 pr-4">
                              <h4 className="text-sm font-medium text-gray-900 leading-none mb-2">{test.name}</h4>
                              <p className="text-sm text-gray-600">{test.description}</p>
                            </div>
                            <button
                              onClick={() => handleRunTest(test.id)}
                              disabled={isRunning}
                              className="flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 text-white hover:bg-indigo-700 h-9 px-4"
                              title="Run test"
                            >
                              {isRunning ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PlayCircle className="h-4 w-4" />
                              )}
                            </button>
                          </div>

                          {/* Test Result */}
                          {result && (
                            <div
                              className={`rounded-lg border p-4 ${
                                result.passed
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-red-50 border-red-200'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {result.passed ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-900">
                                      {result.details}
                                    </p>
                                    <span className="text-xs text-gray-500">
                                      {result.duration}ms
                                    </span>
                                  </div>

                                  {/* Score Bar */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-gray-600">Score</span>
                                      <span className="font-medium text-gray-900">
                                        {result.score}/100
                                      </span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full transition-all ${
                                          result.score >= 80
                                            ? 'bg-green-600'
                                            : result.score >= 60
                                            ? 'bg-yellow-600'
                                            : 'bg-red-600'
                                        }`}
                                        style={{ width: `${result.score}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Errors */}
                                  {result.errors.length > 0 && (
                                    <div className="space-y-1.5">
                                      <p className="text-xs font-medium text-gray-900">
                                        Issues ({result.errors.length}):
                                      </p>
                                      <ul className="space-y-1">
                                        {result.errors.map((error, idx) => (
                                          <li
                                            key={idx}
                                            className="text-xs text-gray-600 pl-4"
                                          >
                                            • {error}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Chat Interface */}
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col" style={{ height: 'calc(100vh - 10rem)' }}>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">AI Assistant</h3>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3">
                    <Sparkles className="w-12 h-12 text-gray-300 mx-auto" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Start a conversation</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Ask the agent anything to get started
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))
              )}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent max-h-32"
                  rows={1}
                  disabled={isGenerating}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isGenerating}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
