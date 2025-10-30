/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { Project } from '../../../types/project';

// Database structure
interface Database {
  projects: Record<string, Project>;
}

const DATA_DIR = join(process.cwd(), 'data');
const DB_FILE = join(DATA_DIR, 'projects.db.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize lowdb
const adapter = new JSONFile<Database>(DB_FILE);
const defaultData: Database = { projects: {} };
const db = new Low(adapter, defaultData);

// POST - Save/update project
export async function POST(request: NextRequest) {
  try {
    const project = await request.json() as Project;

    if (!project || !project.id) {
      return NextResponse.json(
        { error: 'Invalid project data' },
        { status: 400 }
      );
    }

    // Read current data
    await db.read();

    // Update project in database
    db.data.projects[project.id] = project;

    // Write to disk
    await db.write();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving project:', error);
    return NextResponse.json(
      { error: 'Failed to save project' },
      { status: 500 }
    );
  }
}

// GET - Get project(s)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    // Read current data
    await db.read();

    if (projectId) {
      // Get specific project
      const project = db.data.projects[projectId];

      if (!project) {
        // Try loading from seed data in public/data/
        try {
          const response = await fetch(`${request.nextUrl.origin}/data/projects.json`);
          if (response.ok) {
            const projectsIndex = await response.json();
            const projectRef = projectsIndex.projects.find((p: any) => p.id === projectId);

            if (projectRef) {
              const seedResponse = await fetch(`${request.nextUrl.origin}/data/${projectRef.file}`);
              if (seedResponse.ok) {
                const seedProject = await seedResponse.json();
                return NextResponse.json({ project: seedProject });
              }
            }
          }
        } catch (err) {
          console.error('Failed to load seed data:', err);
        }

        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ project });
    } else {
      // Get all projects (merge runtime and seed data)
      const runtimeProjects = Object.values(db.data.projects);

      // Try to load seed projects too
      const allProjects = [...runtimeProjects];

      try {
        const response = await fetch(`${request.nextUrl.origin}/data/projects.json`);
        if (response.ok) {
          const projectsIndex = await response.json();

          for (const projectRef of projectsIndex.projects) {
            // Only add if not already in runtime data
            if (!db.data.projects[projectRef.id]) {
              const seedResponse = await fetch(`${request.nextUrl.origin}/data/${projectRef.file}`);
              if (seedResponse.ok) {
                const seedProject = await seedResponse.json();
                allProjects.push(seedProject);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load seed projects:', err);
      }

      return NextResponse.json({ projects: allProjects });
    }
  } catch (error) {
    console.error('Error getting projects:', error);
    return NextResponse.json(
      { error: 'Failed to get projects' },
      { status: 500 }
    );
  }
}

// DELETE - Delete project and all associated files
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Read current data
    await db.read();

    // Check if project exists in runtime database and delete it
    const projectExistsInDb = !!db.data.projects[projectId];
    if (projectExistsInDb) {
      delete db.data.projects[projectId];
      await db.write();
      console.log(`Project ${projectId} removed from database`);
    } else {
      console.log(`Project ${projectId} not in database, will still delete associated files`);
    }

    // Delete associated files
    const publicDir = join(process.cwd(), 'public');
    const storiesDir = join(process.cwd(), 'stories', projectId);
    const videosDir = join(publicDir, 'videos', projectId);
    const evaluationsDir = join(publicDir, 'evaluations', projectId);
    const refsDir = join(publicDir, 'generated-refs', projectId);

    // Remove directories if they exist
    [storiesDir, videosDir, evaluationsDir, refsDir].forEach(dir => {
      if (existsSync(dir)) {
        try {
          rmSync(dir, { recursive: true, force: true });
          console.log(`Deleted directory: ${dir}`);
        } catch (err) {
          console.error(`Failed to delete directory ${dir}:`, err);
        }
      }
    });

    console.log(`Project ${projectId} deleted successfully`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
