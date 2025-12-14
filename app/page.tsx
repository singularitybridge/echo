/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import ProjectList from '../components/ProjectList';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <ProjectList />
    </div>
  );
}
