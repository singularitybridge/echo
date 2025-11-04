/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Folder, FileText, ArrowLeft, ChevronDown, ChevronUp, PlayCircle, Loader2 } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string;
  path: string;
  type: 'folder' | 'file';
}

interface AgentDetails {
  prompt: string;
  tests: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentDetails, setAgentDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await fetch('/api/agents');
        if (!response.ok) {
          console.error('Failed to load agents');
          setLoading(false);
          return;
        }

        const data = await response.json();
        setAgents(data.agents || []);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load agents:', err);
        setLoading(false);
      }
    };

    loadAgents();
  }, []);

  useEffect(() => {
    const loadAgentDetails = async () => {
      if (!selectedAgent) {
        setAgentDetails(null);
        return;
      }

      setDetailsLoading(true);
      try {
        const response = await fetch(`/api/agents/${selectedAgent.id}`);
        if (!response.ok) {
          console.error('Failed to load agent details');
          setDetailsLoading(false);
          return;
        }

        const data = await response.json();
        setAgentDetails(data);
        setDetailsLoading(false);
      } catch (err) {
        console.error('Failed to load agent details:', err);
        setDetailsLoading(false);
      }
    };

    loadAgentDetails();
  }, [selectedAgent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-600" />
          <p className="text-gray-600 text-sm">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Stories"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-3">
                  <Bot className="w-8 h-8 text-indigo-600" />
                  <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
                </div>
                <p className="text-sm text-gray-600">
                  Browse all AI agents powering Echo
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {agents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No agents found
            </h2>
            <p className="text-gray-600">
              No agents are available in the .agents folder.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agents List */}
            <div className={`${selectedAgent ? 'lg:col-span-1' : 'lg:col-span-3'} grid grid-cols-1 ${selectedAgent ? '' : 'md:grid-cols-2 lg:grid-cols-3'} gap-6`}>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-all text-left ${
                    selectedAgent?.id === agent.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-100 rounded-lg flex-shrink-0">
                      {agent.type === 'folder' ? (
                        <Folder className="w-6 h-6 text-indigo-600" />
                      ) : (
                        <FileText className="w-6 h-6 text-indigo-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {agent.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {agent.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          .agents/{agent.path}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Agent Details */}
            {selectedAgent && (
              <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {detailsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  </div>
                ) : agentDetails ? (
                  <div className="space-y-6">
                    {/* Prompt Section */}
                    <div>
                      <button
                        onClick={() => setPromptExpanded(!promptExpanded)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <h3 className="text-lg font-semibold text-gray-900">Agent Prompt</h3>
                        {promptExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                      {promptExpanded && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                            {agentDetails.prompt}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Tests Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Tests & Verifications</h3>
                      {agentDetails.tests.length === 0 ? (
                        <p className="text-sm text-gray-600">No tests available for this agent.</p>
                      ) : (
                        <div className="space-y-3">
                          {agentDetails.tests.map((test) => (
                            <div key={test.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">{test.name}</h4>
                                <p className="text-sm text-gray-600">{test.description}</p>
                              </div>
                              <button
                                className="ml-4 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                title="Run test"
                              >
                                <PlayCircle className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-600 py-12">Failed to load agent details</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Agent Count */}
        {agents.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              {agents.length} {agents.length === 1 ? 'agent' : 'agents'} available
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
