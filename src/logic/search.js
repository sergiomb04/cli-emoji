function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n");
}

// Divide query en tokens
function tokenize(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter(Boolean);
}

// Cache de consultas recientes para respuestas instantáneas (< 0.01ms)
const queryCache = new Map();
const MAX_CACHE_ENTRIES = 150;

function clearSearchCache() {
  queryCache.clear();
}

function searchEmojis(query, data) {
  const items = data || [];
  if (!query || typeof query !== 'string' || !query.trim()) {
    // Si la búsqueda está vacía, devolver los primeros 15 emojis por defecto
    return items.slice(0, 15);
  }
  const cleanQuery = query.trim();

  const q = normalizeText(cleanQuery);
  if (!q) return items.slice(0, 15);

  // Retorno instantáneo si la consulta ya fue computada recientemente
  if (queryCache.has(q)) {
    return queryCache.get(q);
  }

  const qTokens = tokenize(cleanQuery);
  const matches = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let score = 0;

    // Utilizar keywords pre-normalizadas de la caché o fallback on-the-fly
    const normalizedKeywords = item.normalized || (item.keywords ? item.keywords.map(normalizeText) : []);

    for (let j = 0; j < normalizedKeywords.length; j++) {
      const kw = normalizedKeywords[j];

      // Match exacto
      if (kw === q) {
        score += 10;
      }

      // Empieza igual (muy fuerte)
      if (kw.startsWith(q)) {
        score += 6;
      }

      // Contiene query completo
      if (kw.includes(q)) {
        score += 3;
      }

      // Scoring por palabras/tokens individuales del query
      for (let t = 0; t < qTokens.length; t++) {
        const token = qTokens[t];
        if (kw === token) score += 5;
        else if (kw.startsWith(token)) score += 3;
        else if (kw.includes(token)) score += 1;
      }
    }

    if (score > 0) {
      matches.push({ ...item, score });
    }
  }

  // Ordenar de mayor a menor relevancia y limitar a los 15 mejores
  matches.sort((a, b) => b.score - a.score);
  const topResults = matches.slice(0, 15);

  // Almacenar en caché LRU básica
  if (queryCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = queryCache.keys().next().value;
    queryCache.delete(firstKey);
  }
  queryCache.set(q, topResults);

  return topResults;
}

module.exports = {
  searchEmojis,
  normalizeText,
  tokenize,
  clearSearchCache
};