const searchInput = document.getElementById('search');
const resultsContainer = document.getElementById('results');

let results = [];
let selectedIndex = 0;
let openVariantIndices = new Set();

async function updateResults() {
  const query = searchInput.value;
  if (!query) {
    results = [];
    renderResults();
    return;
  }

  results = await window.electronAPI.search(query);
  selectedIndex = 0;
  renderResults();
}

function renderResults() {
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
        renderResults();
      };
      mainDiv.appendChild(toggle);
    }

    mainDiv.onclick = () => selectEmoji(index);
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

function selectSpecificEmoji(emoji) {
  if (emoji) {
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

searchInput.addEventListener('input', updateResults);

document.getElementById('close-btn').addEventListener('click', () => {
  window.electronAPI.quitApp();
});

document.getElementById('reload-btn').addEventListener('click', () => {
  const btn = document.getElementById('reload-btn');
  btn.classList.add('loading');
  
  window.electronAPI.reloadData();
  
  // Pequeño delay para que se vea la animación y confirmar que algo pasó
  setTimeout(() => {
    btn.classList.remove('loading');
    updateResults(); // Refrescar resultados actuales si hay búsqueda
  }, 500);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    selectedIndex = (selectedIndex + 1) % results.length;
    renderResults();
  } else if (e.key === 'ArrowUp') {
    selectedIndex = (selectedIndex - 1 + results.length) % results.length;
    renderResults();
  } else if (e.key === 'ArrowRight') {
    if (results[selectedIndex]?.variants?.length > 0) {
      openVariantIndices.add(selectedIndex);
      renderResults();
    }
  } else if (e.key === 'ArrowLeft') {
    if (openVariantIndices.has(selectedIndex)) {
      openVariantIndices.delete(selectedIndex);
      renderResults();
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

// Listener para cuando la ventana se muestra
window.electronAPI.onWindowShown(() => {
  searchInput.value = '';
  results = [];
  renderResults();
  
  // Múltiples intentos de foco para asegurar que Windows lo procese correctamente
  const focusInput = () => {
    searchInput.focus();
    searchInput.select();
  };

  focusInput();
  setTimeout(focusInput, 50);
  setTimeout(focusInput, 150);
});
