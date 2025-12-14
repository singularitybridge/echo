/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VideoEvaluation } from './evaluationService.agentHub';

class EvaluationStorageServer {
  async saveEvaluation(
    projectId: string,
    sceneId: string,
    evaluation: VideoEvaluation
  ): Promise<void> {
    const response = await fetch('/api/evaluations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        sceneId,
        evaluation,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save evaluation');
    }
  }

  async getProjectEvaluations(
    projectId: string
  ): Promise<Map<string, VideoEvaluation>> {
    const response = await fetch(`/api/evaluations?projectId=${projectId}`);

    if (!response.ok) {
      throw new Error('Failed to get evaluations');
    }

    const data = await response.json();
    const map = new Map<string, VideoEvaluation>();

    Object.entries(data.evaluations || {}).forEach(([sceneId, evaluation]) => {
      map.set(sceneId, evaluation as VideoEvaluation);
    });

    return map;
  }

  async deleteEvaluation(projectId: string, sceneId: string): Promise<void> {
    const response = await fetch(
      `/api/evaluations?projectId=${projectId}&sceneId=${sceneId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete evaluation');
    }
  }
}

export const evaluationStorage = new EvaluationStorageServer();
