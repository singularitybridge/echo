/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { use } from 'react';
import SceneManager from '../../../components/SceneManager';

export default function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <SceneManager projectId={projectId} />
    </div>
  );
}
