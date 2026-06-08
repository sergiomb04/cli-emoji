function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n");
}

// divide query en tokens
function tokenize(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter(Boolean);
}

function searchEmojis(query, data) {
  const q = normalizeText(query);
  const qTokens = tokenize(query);

  return data
    .map(item => {
      let score = 0;

      const keywords = item.keywords || [];

      for (const keyword of keywords) {
        const kw = normalizeText(keyword);

        // match exacto
        if (kw === q) {
          score += 10;
        }

        // empieza igual (muy fuerte)
        if (kw.startsWith(q)) {
          score += 6;
        }

        // contiene query completo
        if (kw.includes(q)) {
          score += 3;
        }

        // scoring por palabras del query
        for (const token of qTokens) {
          if (kw === token) score += 5;
          else if (kw.startsWith(token)) score += 3;
          else if (kw.includes(token)) score += 1;
        }
      }

      return { ...item, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

module.exports = { searchEmojis };