/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Folder, FileText, ArrowLeft } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string;
  path: string;
  type: 'folder' | 'file';
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
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
              </div>
            ))}
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
