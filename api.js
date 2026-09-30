const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || 'http://localhost:5000';

async function requestApi(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      message = body.message || body.title || message;
    } catch {}
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function normalizeTask(task) {
  return {
    ...task,
    createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.parse(task.createdAt),
    completedAt: task.completedAt ? (typeof task.completedAt === 'number' ? task.completedAt : Date.parse(task.completedAt)) : null,
    deletedAt: task.deletedAt ? (typeof task.deletedAt === 'number' ? task.deletedAt : Date.parse(task.deletedAt)) : null,
  };
}

const taskApi = {
  getTasks: async () => (await requestApi('/api/tasks')).map(normalizeTask),
  createTask: async (task) => normalizeTask(await requestApi('/api/tasks', { method: 'POST', body: JSON.stringify(task) })),
  updateTask: async (id, task) => normalizeTask(await requestApi(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) })),
  completeTask: async (id) => normalizeTask(await requestApi(`/api/tasks/${id}/complete`, { method: 'PATCH' })),
  restoreTask: async (id) => normalizeTask(await requestApi(`/api/tasks/${id}/restore`, { method: 'PATCH' })),
  deleteTask: async (id) => normalizeTask(await requestApi(`/api/tasks/${id}/delete`, { method: 'PATCH' })),
  deleteTaskForever: (id) => requestApi(`/api/tasks/${id}`, { method: 'DELETE' }),
  updateTaskPriority: async (id, priorityOrder) => (await requestApi(`/api/tasks/${id}/priority`, {
    method: 'PATCH',
    body: JSON.stringify({ priorityOrder }),
  })).map(normalizeTask),
};
