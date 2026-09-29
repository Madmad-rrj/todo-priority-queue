const STORAGE_KEY = 'todo-stack-web-app-v1';
const STATUS = { TODO: 'TODO', COMPLETED: 'COMPLETED', DELETED: 'DELETED' };

const defaultTasks = [
  { id: createId(), content: 'Finish Software Engineering assignment', createdAt: Date.now() - 7 * 86400000, status: STATUS.TODO, completedAt: null, deletedAt: null, priorityOrder: 1, isStarred: true },
  { id: createId(), content: 'Learn ASP.NET Core', createdAt: Date.now() - 2 * 3600000, status: STATUS.TODO, completedAt: null, deletedAt: null, priorityOrder: 2, isStarred: false },
  { id: createId(), content: 'Prepare meeting notes', createdAt: Date.now() - 4 * 86400000, status: STATUS.COMPLETED, completedAt: Date.now() - 2 * 3600000, deletedAt: null, priorityOrder: 3, isStarred: false },
  { id: createId(), content: 'Draft release summary', createdAt: Date.now() - 10 * 86400000, status: STATUS.DELETED, completedAt: null, deletedAt: Date.now() - 3 * 3600000, priorityOrder: 4, isStarred: true },
];

const state = {
  tasks: loadTasks(),
  currentPage: 'TODO',
  filters: { age: 'all', date: 'all', star: 'all', sort: 'priority' },
  modalMode: 'add',
  editingTaskId: null,
  draggedId: null,
  pendingFocus: null,
  activeTaskId: null,
};
normalizeQueue();

const navButtons = document.querySelectorAll('.nav-item');
const quickInput = document.getElementById('quick-task-input');
const quickAddButton = document.getElementById('quick-add-button');
const todoList = document.getElementById('todo-page-list');
const completedList = document.getElementById('completed-page-list');
const trashList = document.getElementById('trash-page-list');
const modal = document.getElementById('task-modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalPriorityOrder = document.getElementById('modal-priority-order');
const modalCreatedAt = document.getElementById('modal-created-at');
const modalStarred = document.getElementById('modal-starred');
const modalForm = document.getElementById('task-form');
const cancelButton = document.getElementById('cancel-task');
const submitButton = document.getElementById('submit-task');
const filterAge = document.getElementById('filter-age');
const filterDate = document.getElementById('filter-date');
const filterStar = document.getElementById('filter-star');
const filterSort = document.getElementById('filter-sort');
const clearFiltersButton = document.getElementById('clear-filters');
const organizeButton = document.getElementById('organize-button');
const organizerModal = document.getElementById('organizer-modal');
const organizerList = document.getElementById('organizer-list');
const closeOrganizerButton = document.getElementById('close-organizer');

navButtons.forEach((button) => button.addEventListener('click', () => {
  state.currentPage = button.dataset.page;
  render();
}));

quickAddButton.addEventListener('click', () => openTaskModal('add', quickInput.value.trim()));
quickInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    openTaskModal('add', quickInput.value.trim());
  }
});
cancelButton.addEventListener('click', closeTaskModal);
modal.addEventListener('click', (event) => { if (event.target === modal) closeTaskModal(); });
organizeButton.addEventListener('click', openOrganizer);
closeOrganizerButton.addEventListener('click', closeOrganizer);
organizerModal.addEventListener('click', (event) => { if (event.target === organizerModal) closeOrganizer(); });

modalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const content = modalContent.value.trim();
  if (!content) return modalContent.focus();
  const task = state.modalMode === 'edit'
    ? state.tasks.find((item) => item.id === state.editingTaskId)
    : { id: createId(), status: STATUS.TODO, completedAt: null, deletedAt: null };
  if (!task) return closeTaskModal();

  task.content = content;
  task.createdAt = parseDateTimeLocal(modalCreatedAt.value);
  task.isStarred = modalStarred.checked;
  const requestedPosition = parsePosition(modalPriorityOrder.value);

  if (state.modalMode === 'add') {
    const queue = getTodoQueue();
    task.priorityOrder = queue.length + 1;
    state.tasks.push(task);
    insertAtPosition(task.id, requestedPosition);
  } else {
    const currentPosition = task.priorityOrder;
    if (requestedPosition) insertAtPosition(task.id, requestedPosition);
    else task.priorityOrder = currentPosition;
  }

  normalizeQueue();
  saveTasks();
  closeTaskModal();
  render();
});

filterAge.addEventListener('change', (event) => { state.filters.age = event.target.value; render(); });
filterDate.addEventListener('change', (event) => { state.filters.date = event.target.value; render(); });
filterStar.addEventListener('change', (event) => { state.filters.star = event.target.value; render(); });
filterSort.addEventListener('change', (event) => { state.filters.sort = event.target.value; render(); });
clearFiltersButton.addEventListener('click', () => {
  state.filters = { age: 'all', date: 'all', star: 'all', sort: 'priority' };
  filterAge.value = 'all';
  filterDate.value = 'all';
  filterStar.value = 'all';
  filterSort.value = 'priority';
  render();
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const task = state.tasks.find((item) => item.id === button.dataset.id);
  if (!task) return;
  switch (button.dataset.action) {
    case 'complete':
      task.status = STATUS.COMPLETED;
      task.completedAt = Date.now();
      normalizeQueue();
      break;
    case 'restore':
      task.status = STATUS.TODO;
      task.completedAt = null;
      insertAtPosition(task.id, task.priorityOrder);
      normalizeQueue();
      break;
    case 'delete':
      task.status = STATUS.DELETED;
      task.deletedAt = Date.now();
      normalizeQueue();
      break;
    case 'delete-forever':
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      normalizeQueue();
      break;
    case 'edit':
      openTaskModal('edit', task.content, task);
      return;
    case 'star':
      task.isStarred = !task.isStarred;
      break;
    case 'move-up':
      state.pendingFocus = { taskId: task.id, control: 'up' };
      if (!moveBy(task.id, -1)) {
        state.pendingFocus = null;
        return;
      }
      break;
    case 'move-down':
      state.pendingFocus = { taskId: task.id, control: 'down' };
      if (!moveBy(task.id, 1)) {
        state.pendingFocus = null;
        return;
      }
      break;
    default:
      return;
  }
  saveTasks();
  render();
});

document.addEventListener('change', (event) => {
  const input = event.target.closest('[data-priority-input]');
  if (input) updatePosition(input.dataset.priorityInput, input.value);
});
document.addEventListener('keydown', (event) => {
  const input = event.target.closest('[data-priority-input]');
  if (input && event.key === 'Enter') {
    event.preventDefault();
    updatePosition(input.dataset.priorityInput, input.value);
    input.blur();
  }
});

function render() {
  navButtons.forEach((button) => button.classList.toggle('active', button.dataset.page === state.currentPage));
  document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page.id === `page-${state.currentPage.toLowerCase()}`));
  const todoTasks = getFilteredTodos();
  renderList(todoList, todoTasks, renderTodoCard);
  renderList(completedList, getCompletedTasks(), renderCompletedCard);
  renderList(trashList, getTrashTasks(), renderTrashCard);
  if (!organizerModal.classList.contains('hidden')) renderOrganizer();
  restorePendingFocus();
}

function restorePendingFocus() {
  if (!state.pendingFocus) return;
  const { taskId, control } = state.pendingFocus;
  state.pendingFocus = null;
  const button = Array.from(document.querySelectorAll('[data-reorder-task]'))
    .find((item) => item.dataset.reorderTask === taskId && item.dataset.reorderControl === control);
  if (button) {
    requestAnimationFrame(() => button.focus({ preventScroll: true }));
  }
}

function renderList(target, collection, renderer) {
  target.innerHTML = collection.length ? collection.map(renderer).join('') : '<div class="empty-state">No tasks in this section.</div>';
  enableDragDrop(target);
}

function getTodoQueue() {
  return state.tasks.filter((task) => task.status === STATUS.TODO).sort((a, b) => a.priorityOrder - b.priorityOrder);
}
function getCompletedTasks() {
  return state.tasks.filter((task) => task.status === STATUS.COMPLETED).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
}
function getTrashTasks() {
  return state.tasks.filter((task) => task.status === STATUS.DELETED).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
}
function getFilteredTodos() {
  let tasks = getTodoQueue();
  if (state.filters.age !== 'all') tasks = tasks.filter((task) => matchesAgeFilter(task.createdAt, state.filters.age));
  if (state.filters.date !== 'all') tasks = tasks.filter((task) => matchesDateFilter(task.createdAt, state.filters.date));
  if (state.filters.star === 'starred') tasks = tasks.filter((task) => task.isStarred);
  if (state.filters.star === 'unstarred') tasks = tasks.filter((task) => !task.isStarred);
  if (state.filters.sort === 'newest') tasks.sort((a, b) => b.createdAt - a.createdAt);
  if (state.filters.sort === 'oldest') tasks.sort((a, b) => a.createdAt - b.createdAt);
  return tasks;
}

function renderTodoCard(task) {
  const color = getAgeColor(task.createdAt);
  const queueIndex = getTodoQueue().findIndex((item) => item.id === task.id);
  const canMoveUp = queueIndex > 0;
  const canMoveDown = queueIndex >= 0 && queueIndex < getTodoQueue().length - 1;
  return `<article class="task-card ${color} ${state.activeTaskId === task.id ? 'active-task' : ''}" draggable="true" data-drag-id="${task.id}">
    <div class="task-main">
      <span class="drag-handle" title="Drag to reorder">≡</span>
      <input class="position-input" data-priority-input="${task.id}" type="number" min="1" step="1" value="${task.priorityOrder}" aria-label="Priority position">
      <button type="button" class="star-button ${task.isStarred ? 'starred' : ''}" data-action="star" data-id="${task.id}" aria-label="Toggle star">${task.isStarred ? '★' : '☆'}</button>
      <span class="task-dot ${color}"></span>
      <div>
        <div class="task-title">${escapeHtml(task.content)}</div>
        <div class="task-meta">Age: ${formatAge(task.createdAt)}</div>
        <div class="task-meta">Added: ${formatDateTime(task.createdAt)}</div>
      </div>
    </div>
    <div class="task-actions">
      <button type="button" class="action-button reorder-button" data-action="move-up" data-id="${task.id}" data-reorder-task="${task.id}" data-reorder-control="up" aria-label="Move ${escapeHtml(task.content)} up" aria-disabled="${!canMoveUp}">↑</button>
      <button type="button" class="action-button reorder-button" data-action="move-down" data-id="${task.id}" data-reorder-task="${task.id}" data-reorder-control="down" aria-label="Move ${escapeHtml(task.content)} down" aria-disabled="${!canMoveDown}">↓</button>
      <button type="button" class="action-button complete" data-action="complete" data-id="${task.id}">✓</button>
      <button type="button" class="action-button edit" data-action="edit" data-id="${task.id}">✏ Edit</button>
      <button type="button" class="action-button delete" data-action="delete" data-id="${task.id}">🗑 Delete</button>
    </div>
  </article>`;
}
function renderCompletedCard(task) {
  return `<article class="task-card completed">
    <div class="task-main"><span class="task-dot complete"></span><div><div class="task-title"><span class="mark">✓</span> ${escapeHtml(task.content)}</div><div class="task-meta">Priority position: ${task.priorityOrder}</div></div></div>
    <div class="task-meta">Created: ${formatDateTime(task.createdAt)}</div><div class="task-meta">Completed: ${formatDateTime(task.completedAt || Date.now())}</div>
    <div class="task-actions"><button type="button" class="action-button restore" data-action="restore" data-id="${task.id}">↩ Restore</button><button type="button" class="action-button delete" data-action="delete" data-id="${task.id}">🗑</button></div>
  </article>`;
}
function renderTrashCard(task) {
  return `<article class="task-card deleted">
    <div class="task-main"><span class="task-dot delete"></span><div><div class="task-title"><span class="mark">🗑</span> ${escapeHtml(task.content)}</div><div class="task-meta">Priority position: ${task.priorityOrder}</div></div></div>
    <div class="task-meta">Deleted: ${formatDateTime(task.deletedAt || Date.now())}</div>
    <div class="task-actions"><button type="button" class="action-button restore" data-action="restore" data-id="${task.id}">Restore</button><button type="button" class="action-button permanent" data-action="delete-forever" data-id="${task.id}">Delete forever</button></div>
  </article>`;
}

function openTaskModal(mode, initialContent = '', task = null) {
  state.modalMode = mode;
  state.editingTaskId = task ? task.id : null;
  modalTitle.textContent = mode === 'add' ? 'Add Task' : 'Edit Task';
  submitButton.textContent = mode === 'add' ? 'Create Task' : 'Save changes';
  modalContent.value = initialContent || '';
  modalPriorityOrder.value = mode === 'edit' ? task.priorityOrder : '';
  modalCreatedAt.value = formatDateTimeForInput(mode === 'edit' ? task.createdAt : Date.now());
  modalStarred.checked = mode === 'edit' ? Boolean(task.isStarred) : false;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => modalContent.focus(), 0);
}
function closeTaskModal() {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  modalForm.reset();
  state.editingTaskId = null;
}
function openOrganizer() {
  organizerModal.classList.remove('hidden');
  organizerModal.setAttribute('aria-hidden', 'false');
  renderOrganizer();
}
function closeOrganizer() {
  organizerModal.classList.add('hidden');
  organizerModal.setAttribute('aria-hidden', 'true');
}
function renderOrganizer() {
  organizerList.innerHTML = getTodoQueue().map((task) => `<div class="organizer-item" draggable="true" data-drag-id="${task.id}"><span class="drag-handle">≡</span><strong>${task.priorityOrder}</strong><span>${task.isStarred ? '★' : '☆'} ${escapeHtml(task.content)}</span></div>`).join('');
  enableDragDrop(organizerList);
}
function enableDragDrop(container) {
  container.querySelectorAll('[data-drag-id]').forEach((item) => {
    item.addEventListener('dragstart', () => { state.draggedId = item.dataset.dragId; item.classList.add('dragging'); });
    item.addEventListener('dragend', () => {
      state.activeTaskId = item.dataset.dragId;
      item.classList.remove('dragging');
    });
    item.addEventListener('dragover', (event) => event.preventDefault());
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      if (state.draggedId && state.draggedId !== item.dataset.dragId) {
        state.activeTaskId = state.draggedId;
        state.pendingFocus = { taskId: state.draggedId, control: 'up' };
        reorderByDrop(state.draggedId, item.dataset.dragId);
        saveTasks();
        render();
      }
    });
  });
}
function reorderByDrop(draggedId, targetId) {
  const queue = getTodoQueue().filter((task) => task.id !== draggedId);
  const targetIndex = queue.findIndex((task) => task.id === targetId);
  const dragged = state.tasks.find((task) => task.id === draggedId);
  queue.splice(targetIndex < 0 ? queue.length : targetIndex, 0, dragged);
  queue.forEach((task, index) => { task.priorityOrder = index + 1; });
}
function moveBy(id, delta) {
  const queue = getTodoQueue();
  const index = queue.findIndex((task) => task.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= queue.length) return false;
  [queue[index], queue[target]] = [queue[target], queue[index]];
  queue.forEach((task, position) => { task.priorityOrder = position + 1; });
  state.activeTaskId = id;
  return true;
}
function updatePosition(id, value) {
  const position = parsePosition(value);
  if (!position) return;
  insertAtPosition(id, position);
  normalizeQueue();
  saveTasks();
  render();
}
function insertAtPosition(id, requestedPosition) {
  const queue = getTodoQueue().filter((task) => task.id !== id);
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  const index = Math.max(0, Math.min(queue.length, requestedPosition - 1));
  queue.splice(index, 0, task);
  queue.forEach((item, position) => { item.priorityOrder = position + 1; });
}
function normalizeQueue() {
  getTodoQueue().forEach((task, index) => { task.priorityOrder = index + 1; });
}
function parsePosition(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
function matchesAgeFilter(createdAt, filterValue) {
  const days = getAgeInDays(createdAt);
  return filterValue === 'under-2d' ? days < 2 : filterValue === '2-4d' ? days >= 2 && days < 4 : filterValue === '4-6d' ? days >= 4 && days < 6 : filterValue === 'over-6d' ? days >= 6 : true;
}
function matchesDateFilter(createdAt, filterValue) {
  const age = Date.now() - Number(createdAt);
  if (filterValue === 'today') return age <= 86400000;
  if (filterValue === 'this-week') return age > 86400000 && age <= 604800000;
  if (filterValue === 'older') return age > 604800000;
  return true;
}
function getAgeColor(createdAt) {
  const days = getAgeInDays(createdAt);
  return days < 2 ? 'green' : days < 4 ? 'yellow' : days < 6 ? 'orange' : 'red';
}
function getAgeInDays(createdAt) { return (Date.now() - Number(createdAt)) / 86400000; }
function formatAge(createdAt) {
  const hours = Math.floor(Math.max(0, Date.now() - Number(createdAt)) / 3600000);
  if (hours < 1) return 'less than an hour';
  const days = Math.floor(hours / 24);
  const remaining = hours % 24;
  return days ? `${days} day${days === 1 ? '' : 's'}${remaining ? ` ${remaining} hour${remaining === 1 ? '' : 's'}` : ''}` : `${hours} hour${hours === 1 ? '' : 's'}`;
}
function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function formatDateTimeForInput(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function parseDateTimeLocal(value) {
  if (!value) return Date.now();
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}
function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultTasks;
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((task, index) => ({ ...task, priorityOrder: Number.isInteger(task.priorityOrder) ? task.priorityOrder : Number(task.priority) || index + 1, isStarred: Boolean(task.isStarred) }));
    }
  } catch (error) { console.warn('Failed to parse saved tasks.', error); }
  return defaultTasks;
}
function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks)); }
function createId() {
  if (window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return `task-${array[0].toString(16)}`;
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
render();
setInterval(render, 60000);
