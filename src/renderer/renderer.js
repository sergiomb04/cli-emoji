const searchInput = document.getElementById('search');
const resultsContainer = document.getElementById('results');
const tabAll = document.getElementById('tab-all');
const tabRecents = document.getElementById('tab-recents');

let activeTab = 'all'; // 'all' | 'recents'
let results = [];
let selectedIndex = 0;
let openVariantIndices = new Set();
let debounceTimer = null;

function getGridColumns() {
  const first = resultsContainer.querySelector('.grid-item');
  if (!first) return 6;
  const containerWidth = resultsContainer.clientWidth - 32;
  const itemWidth = first.offsetWidth + 8;
  return Math.max(1, Math.floor(containerWidth / itemWidth)) || 6;
}

async function switchTab(tab) {
  if (activeTab === tab && results.length > 0) return;
  activeTab = tab;

  if (activeTab === 'all') {
    tabAll.classList.add('active');
    tabRecents.classList.remove('active');
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
}

async function updateResults() {
  const query = searchInput.value.trim();

  // Si el usuario escribe algo mientras está en la pestaña recientes, conmutar a 'all'
  if (query.length > 0 && activeTab !== 'all') {
    activeTab = 'all';
    tabAll.classList.add('active');
    tabRecents.classList.remove('active');
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
    div.innerHTML = item.emoji;
    div.title = `${item.emoji} ${item.keywords ? item.keywords.join(', ') : ''}`;

    div.onclick = (e) => {
      e.stopPropagation();
      selectSpecificEmoji(item.emoji);
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
    if (results.length === 0) return;
    const columns = getGridColumns();

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
    } else if (e.key === 'Escape') {
      window.electronAPI.hideApp();
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

// Ocultar si se hace clic en la zona fuera de la tarjeta/contenedor
window.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#container')) {
    window.electronAPI.hideApp();
  }
});

// Listener para cuando la ventana se muestra
window.electronAPI.onWindowShown(async () => {
  searchInput.value = '';
  openVariantIndices.clear();

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
