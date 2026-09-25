const searchInput = document.getElementById('search');
const resultsContainer = document.getElementById('results');
const tabAll = document.getElementById('tab-all');
const tabRecents = document.getElementById('tab-recents');
const clearRecentsBtn = document.getElementById('clear-recents-btn');
const clearBtnText = document.getElementById('clear-btn-text');
const contextMenu = document.getElementById('context-menu');
const ctxEditEmoji = document.getElementById('ctx-edit-emoji');
const ctxEditText = document.getElementById('ctx-edit-text');
const ctxRemoveRecent = document.getElementById('ctx-remove-recent');
const ctxSeparator = document.getElementById('ctx-separator');
const ctxClearRecents = document.getElementById('ctx-clear-recents');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const toastUndoBtn = document.getElementById('toast-undo-btn');
const footerDeleteHint = document.getElementById('footer-delete-hint');
const footerContextHint = document.getElementById('footer-context-hint');

// Modal Elements
const addBtn = document.getElementById('add-btn');
const modalOverlay = document.getElementById('modal-overlay');
const emojiModal = document.getElementById('emoji-modal');
const modalTitle = document.getElementById('modal-title');
const modalCloseBtn = document.getElementById('modal-close-btn');
const emojiForm = document.getElementById('emoji-form');
const emojiInput = document.getElementById('emoji-input');
const emojiPreview = document.getElementById('emoji-preview');
const keywordsTags = document.getElementById('keywords-tags');
const keywordsInput = document.getElementById('keywords-input');
const addKeywordBtn = document.getElementById('add-keyword-btn');
const modalError = document.getElementById('modal-error');
const modalDeleteBtn = document.getElementById('modal-delete-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');

let activeTab = 'all'; // 'all' | 'recents'
let results = [];
let selectedIndex = 0;
let openVariantIndices = new Set();
let debounceTimer = null;
let toastTimer = null;
let clearConfirmTimer = null;
let lastUndoAction = null; // { prevList: string[] }
let contextTarget = null; // { emoji: string, index: number, source: string, item: object }

// Modal State
let modalMode = 'create'; // 'create' | 'edit'
let modalOriginalEmoji = null;
let modalKeywords = [];
let isModalOpen = false;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getGridColumns() {
  const first = resultsContainer.querySelector('.grid-item');
  if (!first) return 6;
  const containerWidth = resultsContainer.clientWidth - 32;
  const itemWidth = first.offsetWidth + 8;
  return Math.max(1, Math.floor(containerWidth / itemWidth)) || 6;
}

function updateFooterHints() {
  if (activeTab === 'recents') {
    footerDeleteHint.classList.remove('hidden');
    footerContextHint.classList.remove('hidden');
  } else {
    footerDeleteHint.classList.add('hidden');
    footerContextHint.classList.add('hidden');
  }
}

function updateClearButtonVisibility() {
  if (activeTab === 'recents' && results.length > 0) {
    clearRecentsBtn.classList.remove('hidden');
  } else {
    clearRecentsBtn.classList.add('hidden');
    resetClearConfirm();
  }
}

function resetClearConfirm() {
  if (clearConfirmTimer) {
    clearTimeout(clearConfirmTimer);
    clearConfirmTimer = null;
  }
  clearRecentsBtn.classList.remove('confirming');
  clearBtnText.textContent = 'Vaciar';
}

function showToast(message, canUndo = false) {
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastMessage.textContent = message;
  toastUndoBtn.style.display = canUndo ? 'inline-block' : 'none';
  toast.classList.remove('hidden');

  toastTimer = setTimeout(() => {
    hideToast();
  }, 3500);
}

function hideToast() {
  toast.classList.add('hidden');
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

async function undoLastAction() {
  if (!lastUndoAction || !lastUndoAction.prevList) return;
  hideToast();

  const restoreList = [...lastUndoAction.prevList];
  lastUndoAction = null;

  await window.electronAPI.setRecents(restoreList);
  if (activeTab === 'recents') {
    await loadRecentsView();
  }
  showToast('Historial restaurado', false);
}

function openContextMenu(x, y, emoji, index, source = 'recents', item = null) {
  contextTarget = { emoji, index, source, item };
  ctxEditText.textContent = `Editar ${emoji} y keywords`;

  if (source === 'recents') {
    ctxRemoveRecent.classList.remove('hidden');
    ctxRemoveRecent.innerHTML = `<span class="ctx-icon">❌</span> Quitar <span class="ctx-emoji-target">${emoji}</span> <span class="ctx-shortcut">Supr</span>`;
    ctxSeparator.classList.remove('hidden');
    ctxClearRecents.classList.remove('hidden');
  } else {
    ctxRemoveRecent.classList.add('hidden');
    ctxSeparator.classList.add('hidden');
    ctxClearRecents.classList.add('hidden');
  }

  const menuWidth = 220;
  const menuHeight = source === 'recents' ? 120 : 45;
  const posX = Math.min(x, window.innerWidth - menuWidth - 10);
  const posY = Math.min(y, window.innerHeight - menuHeight - 10);

  contextMenu.style.left = `${Math.max(10, posX)}px`;
  contextMenu.style.top = `${Math.max(10, posY)}px`;
  contextMenu.classList.remove('hidden');
}

function closeContextMenu() {
  contextMenu.classList.add('hidden');
  contextTarget = null;
}

async function removeRecentAtIndex(index) {
  if (index < 0 || index >= results.length) return;
  closeContextMenu();

  const itemToRemove = results[index];
  const emoji = itemToRemove.emoji;

  // Guardar lista completa previa para deshacer de forma 100% exacta
  lastUndoAction = {
    prevList: results.map(r => r.emoji),
    emoji: emoji
  };

  // Modificación inmediata de la UI
  results.splice(index, 1);
  if (selectedIndex >= results.length) {
    selectedIndex = Math.max(0, results.length - 1);
  }

  // Notificar al backend
  window.electronAPI.removeRecent(emoji);

  renderRecentsGrid();
  updateClearButtonVisibility();
  showToast(`Emoji ${emoji} quitado de recientes`, true);
}

async function clearAllRecents() {
  if (results.length === 0) return;
  closeContextMenu();
  resetClearConfirm();

  // Guardar lista previa para deshacer
  lastUndoAction = {
    prevList: results.map(r => r.emoji)
  };

  results = [];
  selectedIndex = 0;

  window.electronAPI.clearRecents();

  renderRecentsGrid();
  updateClearButtonVisibility();
  showToast('Todos los recientes eliminados', true);
}

async function switchTab(tab) {
  if (activeTab === tab && results.length > 0) return;
  activeTab = tab;
  closeContextMenu();
  resetClearConfirm();
  updateFooterHints();

  if (activeTab === 'all') {
    tabAll.classList.add('active');
    tabRecents.classList.remove('active');
    updateClearButtonVisibility();
    await updateResults();
  } else {
    tabRecents.classList.add('active');
    tabAll.classList.remove('active');
    await loadRecentsView();
  }
}

async function loadRecentsView() {
  results = await window.electronAPI.getRecents();
  selectedIndex = 0;
  openVariantIndices.clear();
  renderRecentsGrid();
  updateClearButtonVisibility();
}

async function updateResults() {
  const query = searchInput.value.trim();

  // Si el usuario escribe algo mientras está en la pestaña recientes, conmutar a 'all'
  if (query.length > 0 && activeTab !== 'all') {
    activeTab = 'all';
    tabAll.classList.add('active');
    tabRecents.classList.remove('active');
    updateFooterHints();
    updateClearButtonVisibility();
  }

  results = await window.electronAPI.search(query);
  selectedIndex = 0;
  renderListView();
}

function handleInput() {
  clearTimeout(debounceTimer);
  // Micro-debounce de 15ms para evitar saturación del canal IPC durante escritura rápida
  debounceTimer = setTimeout(updateResults, 15);
}

function renderRecentsGrid() {
  resultsContainer.className = 'results-grid';
  resultsContainer.innerHTML = '';

  if (!results || results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-state-icon">🕒</div>
      <div class="empty-state-text">Aún no tienes emojis recientes.<br>¡Selecciona emojis del catálogo para verlos aquí!</div>
    `;
    resultsContainer.appendChild(empty);
    return;
  }

  results.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = `grid-item ${index === selectedIndex ? 'selected' : ''}`;
    div.title = `${item.emoji} ${item.keywords ? item.keywords.join(', ') : ''} (Supr para quitar)`;

    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'grid-emoji';
    emojiSpan.textContent = item.emoji;
    div.appendChild(emojiSpan);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'grid-item-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Quitar de recientes';
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeRecentAtIndex(index);
    };
    div.appendChild(deleteBtn);

    div.onclick = (e) => {
      if (e.target.closest('.grid-item-delete')) return;
      e.stopPropagation();
      selectSpecificEmoji(item.emoji);
    };

    div.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(e.clientX, e.clientY, item.emoji, index, 'recents', item);
    };

    resultsContainer.appendChild(div);

    if (index === selectedIndex) {
      div.scrollIntoView({ block: 'nearest' });
    }
  });
}

function renderListView() {
  resultsContainer.className = '';
  resultsContainer.innerHTML = '';

  if (!results || results.length === 0) {
    const query = searchInput.value.trim();
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    if (query) {
      empty.innerHTML = `
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">No se encontraron emojis para "<strong>${escapeHtml(query)}</strong>"</div>
        <button type="button" id="empty-create-btn" class="btn-secondary empty-create-btn">➕ Añadir "${escapeHtml(query)}" al catálogo</button>
      `;
      const btn = empty.querySelector('#empty-create-btn');
      if (btn) {
        btn.onclick = (e) => {
          e.stopPropagation();
          openCreateModal(query);
        };
      }
    } else {
      empty.innerHTML = `
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">Escribe algo en el buscador para encontrar emojis.</div>
      `;
    }
    resultsContainer.appendChild(empty);
    return;
  }

  results.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = `result-item ${index === selectedIndex ? 'selected' : ''}`;

    const mainDiv = document.createElement('div');
    mainDiv.className = 'result-main';

    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'emoji';
    emojiSpan.textContent = item.emoji;

    const keywordSpan = document.createElement('span');
    keywordSpan.className = 'keyword';
    keywordSpan.textContent = item.keywords[0] || '';

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'result-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'item-edit-btn';
    editBtn.title = 'Editar emoji y palabras clave';
    editBtn.innerHTML = '✏️';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openEditModal(item);
    };
    actionsDiv.appendChild(editBtn);

    if (item.variants && item.variants.length > 0) {
      const toggle = document.createElement('div');
      toggle.className = `variants-toggle ${openVariantIndices.has(index) ? 'open' : ''}`;
      toggle.innerHTML = '▼';
      toggle.onclick = (e) => {
        e.stopPropagation();
        if (openVariantIndices.has(index)) openVariantIndices.delete(index);
        else openVariantIndices.add(index);
        renderListView();
      };
      actionsDiv.appendChild(toggle);
    }

    mainDiv.appendChild(emojiSpan);
    mainDiv.appendChild(keywordSpan);
    mainDiv.appendChild(actionsDiv);

    mainDiv.onclick = (e) => {
      if (e.target.closest('.variants-toggle') || e.target.closest('.item-edit-btn')) return;
      selectEmoji(index);
    };
    div.appendChild(mainDiv);

    div.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(e.clientX, e.clientY, item.emoji, index, 'all', item);
    };

    if (item.variants && item.variants.length > 0 && openVariantIndices.has(index)) {
      const variantsContainer = document.createElement('div');
      variantsContainer.className = 'variants-container';

      item.variants.forEach(variant => {
        const variantSpan = document.createElement('span');
        variantSpan.className = 'variant-emoji';
        variantSpan.innerHTML = variant.emoji;
        variantSpan.title = `${variant.emoji} (Clic para insertar, clic der. para editar)`;
        variantSpan.onclick = (e) => {
          e.stopPropagation();
          selectSpecificEmoji(variant.emoji);
        };
        variantSpan.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openContextMenu(e.clientX, e.clientY, variant.emoji, index, 'all', variant);
        };
        variantsContainer.appendChild(variantSpan);
      });
      div.appendChild(variantsContainer);
    }

    resultsContainer.appendChild(div);

    if (index === selectedIndex) {
      div.scrollIntoView({ block: 'nearest' });
    }
  });
}

function renderResults() {
  if (activeTab === 'recents') {
    renderRecentsGrid();
  } else {
    renderListView();
  }
}

function selectSpecificEmoji(emoji) {
  if (emoji) {
    window.electronAPI.trackEmoji(emoji);
    window.electronAPI.insertEmoji(emoji);
    searchInput.value = '';
    results = [];
    openVariantIndices.clear();
    renderResults();
  }
}

function selectEmoji(index) {
  selectSpecificEmoji(results[index]?.emoji);
}

// Tab buttons event listeners
tabAll.addEventListener('click', () => switchTab('all'));
tabRecents.addEventListener('click', () => switchTab('recents'));

// Clear recents button event listener with confirmation state
clearRecentsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (clearRecentsBtn.classList.contains('confirming')) {
    clearAllRecents();
  } else {
    clearRecentsBtn.classList.add('confirming');
    clearBtnText.textContent = '¿Vaciar todo?';
    clearConfirmTimer = setTimeout(() => {
      resetClearConfirm();
    }, 3000);
  }
});

// Context menu item listeners
if (ctxEditEmoji) {
  ctxEditEmoji.addEventListener('click', (e) => {
    e.stopPropagation();
    if (contextTarget) {
      const target = contextTarget;
      closeContextMenu();
      openEditModal(target.item || target.emoji);
    }
  });
}

ctxRemoveRecent.addEventListener('click', (e) => {
  e.stopPropagation();
  if (contextTarget) {
    removeRecentAtIndex(contextTarget.index);
  }
});

ctxClearRecents.addEventListener('click', (e) => {
  e.stopPropagation();
  clearAllRecents();
});

// Toast undo button listener
toastUndoBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  undoLastAction();
});

searchInput.addEventListener('input', handleInput);

document.getElementById('close-btn').addEventListener('click', () => {
  window.electronAPI.quitApp();
});

document.getElementById('reload-btn').addEventListener('click', () => {
  const btn = document.getElementById('reload-btn');
  btn.classList.add('loading');

  window.electronAPI.reloadData();

  setTimeout(() => {
    btn.classList.remove('loading');
    if (activeTab === 'recents') {
      loadRecentsView();
    } else {
      updateResults();
    }
    showToast('↻ Emojis recargados', false);
  }, 400);
});

const buildBtn = document.getElementById('build-btn');
if (buildBtn) {
  buildBtn.addEventListener('click', async () => {
    buildBtn.classList.add('loading');
    buildBtn.disabled = true;

    try {
      const res = await window.electronAPI.buildAndReloadData();
      if (activeTab === 'recents') {
        await loadRecentsView();
      } else {
        await updateResults();
      }
      showToast(`⚡ TXT compilado a JSON (${res.total} emojis)`, false);
    } catch (err) {
      console.error('Error al compilar emojis:', err);
      showToast('❌ Error al compilar TXT a JSON', false);
    } finally {
      setTimeout(() => {
        buildBtn.classList.remove('loading');
        buildBtn.disabled = false;
      }, 400);
    }
  });
}

// Add Button (+)
if (addBtn) {
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCreateModal(searchInput.value.trim());
  });
}

// ==========================================
// Modal Logic (Crear / Editar Emojis)
// ==========================================

function openCreateModal(initialKeyword = '', initialEmoji = '') {
  closeContextMenu();
  modalMode = 'create';
  modalOriginalEmoji = null;
  modalTitle.textContent = '✨ Añadir nuevo emoji';
  modalError.classList.add('hidden');
  modalError.textContent = '';
  modalDeleteBtn.classList.add('hidden');
  modalSaveBtn.textContent = 'Guardar';
  modalSaveBtn.disabled = false;

  let emojiVal = initialEmoji;
  let kwVal = initialKeyword;
  if (!emojiVal && kwVal && /\p{Extended_Pictographic}/u.test(kwVal)) {
    emojiVal = kwVal.trim();
    kwVal = '';
  }

  emojiInput.value = emojiVal;
  emojiPreview.textContent = emojiVal || '✨';
  keywordsInput.value = '';

  modalKeywords = [];
  if (kwVal) {
    kwVal.split(',').forEach(k => {
      const trimmed = k.trim().toLowerCase();
      if (trimmed && !modalKeywords.includes(trimmed)) {
        modalKeywords.push(trimmed);
      }
    });
  }
  renderModalTags();

  modalOverlay.classList.remove('hidden');
  isModalOpen = true;

  setTimeout(() => {
    if (!emojiInput.value) {
      emojiInput.focus();
    } else {
      keywordsInput.focus();
    }
  }, 50);
}

async function openEditModal(target) {
  closeContextMenu();
  modalMode = 'edit';
  modalError.classList.add('hidden');
  modalError.textContent = '';
  modalDeleteBtn.classList.remove('hidden');
  modalSaveBtn.textContent = 'Guardar';
  modalSaveBtn.disabled = false;

  const targetEmoji = (typeof target === 'string') ? target : target.emoji;
  modalOriginalEmoji = targetEmoji;
  modalTitle.textContent = `✏️ Editar emoji: ${targetEmoji}`;

  emojiInput.value = targetEmoji;
  emojiPreview.textContent = targetEmoji;
  keywordsInput.value = '';

  let kws = (target && Array.isArray(target.keywords)) ? [...target.keywords] : [];
  try {
    const details = await window.electronAPI.getEmojiDetails(targetEmoji);
    if (details && Array.isArray(details.keywords) && details.keywords.length > 0) {
      kws = details.keywords;
    }
  } catch (e) {
    console.error('Error al obtener detalles del emoji:', e);
  }

  modalKeywords = [...new Set(kws.map(k => k.trim().toLowerCase()).filter(Boolean))];
  renderModalTags();

  modalOverlay.classList.remove('hidden');
  isModalOpen = true;

  setTimeout(() => {
    keywordsInput.focus();
  }, 50);
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  isModalOpen = false;
  modalOriginalEmoji = null;
  modalKeywords = [];
  modalError.classList.add('hidden');
  modalError.textContent = '';
  searchInput.focus();
}

function renderModalTags() {
  keywordsTags.innerHTML = '';
  modalKeywords.forEach((kw, idx) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';

    const text = document.createElement('span');
    text.textContent = kw;
    chip.appendChild(text);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tag-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Quitar palabra clave';
    removeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      modalKeywords.splice(idx, 1);
      renderModalTags();
    };
    chip.appendChild(removeBtn);

    keywordsTags.appendChild(chip);
  });
}

function addKeywordTagFromInput() {
  const text = keywordsInput.value.trim();
  if (!text) return false;

  const parts = text.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
  let added = false;
  for (const part of parts) {
    if (!modalKeywords.includes(part)) {
      modalKeywords.push(part);
      added = true;
    }
  }
  keywordsInput.value = '';
  if (added) {
    renderModalTags();
  }
  return added;
}

// Eventos de formulario de modal
emojiForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalError.classList.add('hidden');
  modalError.textContent = '';

  addKeywordTagFromInput();

  const emoji = emojiInput.value.trim();
  if (!emoji) {
    modalError.textContent = 'Por favor, escribe o pega un emoji.';
    modalError.classList.remove('hidden');
    emojiInput.focus();
    return;
  }

  if (modalKeywords.length === 0) {
    modalError.textContent = 'Añade al menos una palabra clave para poder buscar este emoji.';
    modalError.classList.remove('hidden');
    keywordsInput.focus();
    return;
  }

  modalSaveBtn.disabled = true;
  modalSaveBtn.textContent = 'Guardando...';

  try {
    const res = await window.electronAPI.saveEmoji({
      emoji,
      keywords: modalKeywords,
      originalEmoji: modalOriginalEmoji,
      overwrite: true
    });

    if (res.success) {
      closeModal();
      showToast(res.isNew ? `✨ Emoji ${emoji} guardado con éxito!` : `✏️ Emoji ${emoji} actualizado con éxito!`, false);
      if (activeTab === 'recents') {
        await loadRecentsView();
      } else {
        await updateResults();
      }
    } else {
      modalError.textContent = res.message || 'Error al guardar el emoji.';
      modalError.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error al guardar emoji:', err);
    modalError.textContent = 'Error inesperado al guardar el emoji.';
    modalError.classList.remove('hidden');
  } finally {
    modalSaveBtn.disabled = false;
    modalSaveBtn.textContent = 'Guardar';
  }
});

modalDeleteBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!modalOriginalEmoji) return;

  const confirmed = confirm(`¿Estás seguro de que quieres eliminar el emoji ${modalOriginalEmoji} del catálogo?`);
  if (!confirmed) return;

  modalDeleteBtn.disabled = true;
  try {
    const res = await window.electronAPI.deleteEmoji(modalOriginalEmoji);
    if (res.success) {
      closeModal();
      showToast(`🗑️ Emoji ${modalOriginalEmoji} eliminado del catálogo`, false);
      if (activeTab === 'recents') {
        await loadRecentsView();
      } else {
        await updateResults();
      }
    } else {
      modalError.textContent = res.message || 'Error al eliminar el emoji.';
      modalError.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error al eliminar emoji:', err);
    modalError.textContent = 'Error al eliminar el emoji.';
    modalError.classList.remove('hidden');
  } finally {
    modalDeleteBtn.disabled = false;
  }
});

emojiInput.addEventListener('input', () => {
  const val = emojiInput.value.trim();
  emojiPreview.textContent = val || '✨';
});

keywordsInput.addEventListener('keydown', (e) => {
  if (e.key === ',' || e.key === 'Enter') {
    e.preventDefault();
    addKeywordTagFromInput();
  } else if (e.key === 'Backspace' && keywordsInput.value === '' && modalKeywords.length > 0) {
    modalKeywords.pop();
    renderModalTags();
  }
});

addKeywordBtn.addEventListener('click', (e) => {
  e.preventDefault();
  addKeywordTagFromInput();
  keywordsInput.focus();
});

modalCloseBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);

modalOverlay.addEventListener('mousedown', (e) => {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

// ==========================================
// Keyboard Navigation & Shortcuts
// ==========================================

window.addEventListener('keydown', (e) => {
  // Manejo exclusivo cuando el modal está abierto
  if (isModalOpen) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
    return;
  }

  // Atajo Ctrl+N para crear nuevo emoji
  if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
    e.preventDefault();
    openCreateModal(searchInput.value.trim());
    return;
  }

  // Deshacer con Ctrl+Z
  if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
    if (lastUndoAction) {
      e.preventDefault();
      undoLastAction();
      return;
    }
  }

  // Atajo Tab para alternar entre pestañas
  if (e.key === 'Tab') {
    e.preventDefault();
    const nextTab = activeTab === 'all' ? 'recents' : 'all';
    switchTab(nextTab);
    return;
  }

  // Atajos Ctrl+1 / Ctrl+2 para pestañas
  if (e.ctrlKey && e.key === '1') {
    e.preventDefault();
    switchTab('all');
    return;
  }
  if (e.ctrlKey && e.key === '2') {
    e.preventDefault();
    switchTab('recents');
    return;
  }

  // Navegación en modo Grid (Recientes)
  if (activeTab === 'recents') {
    if (e.key === 'Escape') {
      if (!contextMenu.classList.contains('hidden')) {
        closeContextMenu();
        return;
      }
      if (clearRecentsBtn.classList.contains('confirming')) {
        resetClearConfirm();
        return;
      }
      window.electronAPI.hideApp();
      return;
    }

    if (results.length === 0) return;
    const columns = getGridColumns();

    if (e.key === 'Delete' || (e.key === 'Backspace' && searchInput.value === '')) {
      e.preventDefault();
      removeRecentAtIndex(selectedIndex);
      return;
    }

    if (e.key === 'ArrowRight') {
      selectedIndex = (selectedIndex + 1) % results.length;
      renderRecentsGrid();
    } else if (e.key === 'ArrowLeft') {
      selectedIndex = (selectedIndex - 1 + results.length) % results.length;
      renderRecentsGrid();
    } else if (e.key === 'ArrowDown') {
      selectedIndex = Math.min(results.length - 1, selectedIndex + columns);
      renderRecentsGrid();
    } else if (e.key === 'ArrowUp') {
      selectedIndex = Math.max(0, selectedIndex - columns);
      renderRecentsGrid();
    } else if (e.key === 'Enter') {
      selectEmoji(selectedIndex);
    }
    return;
  }

  // Navegación en modo Lista (Catálogo / Búsqueda)
  if (e.key === 'ArrowDown') {
    selectedIndex = (selectedIndex + 1) % results.length;
    renderListView();
  } else if (e.key === 'ArrowUp') {
    selectedIndex = (selectedIndex - 1 + results.length) % results.length;
    renderListView();
  } else if (e.key === 'ArrowRight') {
    if (results[selectedIndex]?.variants?.length > 0) {
      openVariantIndices.add(selectedIndex);
      renderListView();
    }
  } else if (e.key === 'ArrowLeft') {
    if (openVariantIndices.has(selectedIndex)) {
      openVariantIndices.delete(selectedIndex);
      renderListView();
    }
  } else if (e.key === 'Enter') {
    if (results.length > 0) {
      selectEmoji(selectedIndex);
    }
  } else if (e.key === 'Escape') {
    window.electronAPI.hideApp();
  }
});

// Asegurar que el input tenga el foco siempre que la ventana gane foco
window.addEventListener('focus', () => {
  if (!isModalOpen) {
    searchInput.focus();
  }
});

// Cerrar menús o confirmaciones en clic global
window.addEventListener('mousedown', (e) => {
  if (isModalOpen) {
    if (!e.target.closest('#emoji-modal')) {
      closeModal();
    }
    return;
  }
  if (!e.target.closest('#context-menu')) {
    closeContextMenu();
  }
  if (!e.target.closest('#clear-recents-btn')) {
    resetClearConfirm();
  }
  if (!e.target.closest('#container')) {
    window.electronAPI.hideApp();
  }
});

// Listener para cuando la ventana se muestra
window.electronAPI.onWindowShown(async () => {
  if (isModalOpen) {
    closeModal();
  }

  searchInput.value = '';
  openVariantIndices.clear();
  closeContextMenu();
  resetClearConfirm();

  const recents = await window.electronAPI.getRecents();
  if (recents && recents.length > 0) {
    await switchTab('recents');
  } else {
    await switchTab('all');
  }

  const focusInput = () => {
    searchInput.focus();
    searchInput.select();
  };

  focusInput();
  setTimeout(focusInput, 50);
  setTimeout(focusInput, 150);
});


