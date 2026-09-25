const searchInput = document.getElementById('search');
const resultsContainer = document.getElementById('results');
const tabAll = document.getElementById('tab-all');
const tabRecents = document.getElementById('tab-recents');
const clearRecentsBtn = document.getElementById('clear-recents-btn');
const clearBtnText = document.getElementById('clear-btn-text');
const contextMenu = document.getElementById('context-menu');
const ctxRemoveRecent = document.getElementById('ctx-remove-recent');
const ctxClearRecents = document.getElementById('ctx-clear-recents');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const toastUndoBtn = document.getElementById('toast-undo-btn');
const footerDeleteHint = document.getElementById('footer-delete-hint');
const footerContextHint = document.getElementById('footer-context-hint');

let activeTab = 'all'; // 'all' | 'recents'
let results = [];
let selectedIndex = 0;
let openVariantIndices = new Set();
let debounceTimer = null;
let toastTimer = null;
let clearConfirmTimer = null;
let lastUndoAction = null; // { prevList: string[] }
let contextTarget = null; // { emoji: string, index: number }

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

function openContextMenu(x, y, emoji, index) {
  contextTarget = { emoji, index };
  ctxRemoveRecent.innerHTML = `<span class="ctx-icon">❌</span> Quitar <span class="ctx-emoji-target">${emoji}</span> <span class="ctx-shortcut">Supr</span>`;
  const menuWidth = 215;
  const menuHeight = 90;
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
      openContextMenu(e.clientX, e.clientY, item.emoji, index);
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

  results.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = `result-item ${index === selectedIndex ? 'selected' : ''}`;

    const mainDiv = document.createElement('div');
    mainDiv.className = 'result-main';
    mainDiv.innerHTML = `
      <span class="emoji">${item.emoji}</span>
      <span class="keyword">${item.keywords[0] || ''}</span>
    `;

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
      mainDiv.appendChild(toggle);
    }

    mainDiv.onclick = (e) => {
      if (e.target.closest('.variants-toggle')) return;
      selectEmoji(index);
    };
    div.appendChild(mainDiv);

    if (item.variants && item.variants.length > 0 && openVariantIndices.has(index)) {
      const variantsContainer = document.createElement('div');
      variantsContainer.className = 'variants-container';

      item.variants.forEach(variant => {
        const variantSpan = document.createElement('span');
        variantSpan.className = 'variant-emoji';
        variantSpan.innerHTML = variant.emoji;
        variantSpan.onclick = (e) => {
          e.stopPropagation();
          selectSpecificEmoji(variant.emoji);
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
  }, 500);
});

window.addEventListener('keydown', (e) => {
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
    // Si el menú contextual o confirmación están abiertos, Escape los cierra
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

    // Eliminar emoji seleccionado con Supr o Backspace (si el buscador está vacío)
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
  searchInput.focus();
});

// Cerrar menús o confirmaciones en clic global
window.addEventListener('mousedown', (e) => {
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
  searchInput.value = '';
  openVariantIndices.clear();
  closeContextMenu();
  resetClearConfirm();

  // Si hay recientes, mostrar la pestaña de recientes por defecto para acceso rápido;
  // de lo contrario, arrancar en 'all'
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

