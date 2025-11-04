/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

interface Agent {
  id: string;
  name: string;
  description: string;
  path: string;
  type: 'folder' | 'file';
}

/**
 * GET /api/agents - List all agents from .agents folder
 */
export async function GET() {
  try {
    const agentsDir = path.join(process.cwd(), '.agents');
    const entries = await readdir(agentsDir, { withFileTypes: true });

    const agents: Agent[] = [];

    for (const entry of entries) {
      // Skip hidden files
      if (entry.name.startsWith('.')) continue;

      let agent: Agent | null = null;

      if (entry.isDirectory()) {
        // Check for prompt.md in directory
        const promptPath = path.join(agentsDir, entry.name, 'prompt.md');
        try {
          const content = await readFile(promptPath, 'utf-8');

          // Extract title and description from markdown
          const lines = content.split('\n');
          let title = entry.name;
          let description = '';

          // Find first heading as title
          for (const line of lines) {
            if (line.startsWith('# ')) {
              title = line.substring(2).trim();
              break;
            }
          }

          // Find first paragraph as description
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('#') && !line.startsWith('```') && !line.startsWith('-') && !line.startsWith('*')) {
              description = line;
              break;
            }
          }

          agent = {
            id: entry.name,
            name: title.replace(/Agent Prompt$/, 'Agent').trim(),
            description: description || 'No description available',
            path: `${entry.name}/prompt.md`,
            type: 'folder',
          };
        } catch (err) {
          // If no prompt.md, skip this directory
          continue;
        }
      } else if (entry.name.endsWith('.md')) {
        // Standalone markdown file
        const filePath = path.join(agentsDir, entry.name);
        const content = await readFile(filePath, 'utf-8');

        // Extract title and description
        const lines = content.split('\n');
        let title = entry.name.replace('.md', '');
        let description = '';

        // Find first heading as title
        for (const line of lines) {
          if (line.startsWith('# ')) {
            title = line.substring(2).trim();
            break;
          }
        }

        // Find first paragraph as description
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.startsWith('#') && !line.startsWith('```') && !line.startsWith('-') && !line.startsWith('*')) {
            description = line;
            break;
          }
        }

        agent = {
          id: entry.name.replace('.md', ''),
          name: title,
          description: description || 'No description available',
          path: entry.name,
          type: 'file',
        };
      }

      if (agent) {
        agents.push(agent);
      }
    }

    // Sort agents alphabetically by name
    agents.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Error reading agents:', error);
    return NextResponse.json(
      { error: 'Failed to read agents' },
      { status: 500 }
    );
  }
}
