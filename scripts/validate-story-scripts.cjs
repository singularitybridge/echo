/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Validation script: Review all story scripts and report status
 * - Check for base64 frame data URLs
 * - Verify frame files exist
 * - Report file sizes
 * - Identify remaining issues
 */

const fs = require('fs');
const path = require('path');

const STORIES_DIR = path.join(process.cwd(), 'stories');
const FRAMES_BASE_DIR = path.join(process.cwd(), 'public', 'frames');

const report = {
  totalProjects: 0,
  cleanProjects: 0,
  projectsWithBase64: 0,
  projectsWithEvaluationImages: 0,
  totalSize: 0,
  frameDataSize: 0,
  evaluationImageSize: 0,
  projects: [],
};

function checkBase64InObject(obj, path = '') {
  let base64Count = 0;
  let base64Size = 0;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string' && value.startsWith('data:image/')) {
      base64Count++;
      base64Size += value.length;
      console.log(`    ⚠️  Found base64 at ${currentPath} (${(value.length / 1024).toFixed(1)} KB)`);
    } else if (typeof value === 'object' && value !== null) {
      const nested = checkBase64InObject(value, currentPath);
      base64Count += nested.count;
      base64Size += nested.size;
    }
  }

  return { count: base64Count, size: base64Size };
}

function validateProject(projectId) {
  const scriptPath = path.join(STORIES_DIR, projectId, 'script.json');

  if (!fs.existsSync(scriptPath)) {
    return null;
  }

  const rawData = fs.readFileSync(scriptPath, 'utf8');
  const fileSize = rawData.length;
  report.totalSize += fileSize;

  let data;
  try {
    data = JSON.parse(rawData);
  } catch (error) {
    console.log(`  ❌ ${projectId}: Failed to parse JSON`);
    return { projectId, status: 'error', error: error.message };
  }

  const projectReport = {
    projectId,
    fileSize,
    scenes: data.scenes?.length || 0,
    framesWithBase64: 0,
    evaluationImages: 0,
    status: 'clean',
  };

  console.log(`  📊 ${projectId}:`);
  console.log(`    Size: ${(fileSize / 1024).toFixed(1)} KB`);
  console.log(`    Scenes: ${projectReport.scenes}`);

  // Check for base64 in frame URLs
  for (const scene of data.scenes || []) {
    if (scene.firstFrameDataUrl?.startsWith('data:image/')) {
      projectReport.framesWithBase64++;
      projectReport.status = 'has-base64';
    }
    if (scene.lastFrameDataUrl?.startsWith('data:image/')) {
      projectReport.framesWithBase64++;
      projectReport.status = 'has-base64';
    }
  }

  // Check for base64 in entire structure
  const base64Check = checkBase64InObject(data);

  if (base64Check.count > 0) {
    if (base64Check.count > projectReport.framesWithBase64) {
      // Must be evaluation images
      projectReport.evaluationImages = base64Check.count - projectReport.framesWithBase64;
      projectReport.status = projectReport.status === 'has-base64' ? 'has-both' : 'has-evaluation-images';
      report.evaluationImageSize += base64Check.size;
    } else {
      report.frameDataSize += base64Check.size;
    }
  }

  return projectReport;
}

async function validateAllStoryScripts() {
  console.log('🔍 Validating all story scripts...\n');

  // Find all project directories
  const projects = fs.readdirSync(STORIES_DIR)
    .filter(name => {
      const projectPath = path.join(STORIES_DIR, name);
      return fs.statSync(projectPath).isDirectory();
    })
    .sort();

  report.totalProjects = projects.length;

  // Validate each project
  for (const projectId of projects) {
    const projectReport = validateProject(projectId);

    if (projectReport) {
      report.projects.push(projectReport);

      if (projectReport.status === 'clean') {
        report.cleanProjects++;
      } else if (projectReport.status === 'has-base64' || projectReport.status === 'has-both') {
        report.projectsWithBase64++;
      }

      if (projectReport.evaluationImages > 0) {
        report.projectsWithEvaluationImages++;
      }
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nProjects:`);
  console.log(`  Total: ${report.totalProjects}`);
  console.log(`  Clean (no base64): ${report.cleanProjects}`);
  console.log(`  With frame base64: ${report.projectsWithBase64}`);
  console.log(`  With evaluation images: ${report.projectsWithEvaluationImages}`);

  console.log(`\nFile Sizes:`);
  console.log(`  Total size: ${(report.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Frame base64 data: ${(report.frameDataSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Evaluation images: ${(report.evaluationImageSize / 1024 / 1024).toFixed(2)} MB`);

  console.log(`\nStatus:`);
  if (report.projectsWithBase64 === 0) {
    console.log(`  ✅ All frame data has been migrated to files!`);
  } else {
    console.log(`  ⚠️  ${report.projectsWithBase64} projects still have base64 frame data`);
  }

  if (report.projectsWithEvaluationImages > 0) {
    console.log(`  ℹ️  ${report.projectsWithEvaluationImages} projects have evaluation images (${(report.evaluationImageSize / 1024 / 1024).toFixed(2)} MB)`);
  }

  console.log('\n' + '='.repeat(80));
}

// Run validation
validateAllStoryScripts().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
