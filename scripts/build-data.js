const fs = require('fs');
const path = require('path');

const emojisTxtPath = path.join(__dirname, '../data/emojis.txt');
const cacheJsonPath = path.join(__dirname, '../data/emojis.cache.json');

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n");
}

function tokenize(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter(Boolean);
}

function buildEmojiData() {
  console.log('--- Compilando caché optimizado de emojis ---');
  const startTime = Date.now();

  if (!fs.existsSync(emojisTxtPath)) {
    throw new Error(`Archivo no encontrado: ${emojisTxtPath}`);
  }

  const content = fs.readFileSync(emojisTxtPath, 'utf8');
  const lines = content.split('\n');

  const rawList = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const emoji = trimmed.slice(0, colonIndex).trim();
    const keywordsStr = trimmed.slice(colonIndex + 1).trim();
    const keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()).filter(Boolean) : [];

    rawList.push({
      emoji,
      keywords,
      variants: []
    });
  }

  // Agrupar variantes de tono de piel (Fitzpatrick modifiers)
  const grouped = [];
  const baseIndexMap = new Map();
  const skinToneRegex = /[\u{1F3FB}-\u{1F3FF}]/gu;

  for (const item of rawList) {
    const baseMatch = item.emoji.replace(skinToneRegex, '');
    if (baseMatch !== item.emoji && baseIndexMap.has(baseMatch)) {
      grouped[baseIndexMap.get(baseMatch)].variants.push({
        emoji: item.emoji,
        keywords: item.keywords
      });
    } else {
      baseIndexMap.set(item.emoji, grouped.length);
      grouped.push({
        id: grouped.length,
        emoji: item.emoji,
        keywords: item.keywords,
        normalized: item.keywords.map(k => normalizeText(k)),
        variants: []
      });
    }
  }

  // Construir índice invertido de tokens para búsquedas ultrarrápidas
  const tokenIndex = {};
  for (let i = 0; i < grouped.length; i++) {
    const item = grouped[i];
    const seenTokens = new Set();

    for (const kw of item.normalized) {
      // Indexar la palabra clave completa
      if (!seenTokens.has(kw)) {
        seenTokens.add(kw);
        if (!tokenIndex[kw]) tokenIndex[kw] = [];
        tokenIndex[kw].push(i);
      }

      // Indexar tokens individuales si la keyword es compuesta
      const subTokens = kw.split(/\s+/).filter(Boolean);
      if (subTokens.length > 1) {
        for (const token of subTokens) {
          if (!seenTokens.has(token)) {
            seenTokens.add(token);
            if (!tokenIndex[token]) tokenIndex[token] = [];
            tokenIndex[token].push(i);
          }
        }
      }
    }
  }

  const payload = {
    version: 1,
    generatedAt: Date.now(),
    totalEmojis: grouped.length,
    emojis: grouped,
    tokenIndex
  };

  fs.writeFileSync(cacheJsonPath, JSON.stringify(payload), 'utf8');

  const elapsed = Date.now() - startTime;
  console.log(`✅ Caché generado con éxito en: ${cacheJsonPath}`);
  console.log(`📦 Emojis base: ${grouped.length} | Tokens indexados: ${Object.keys(tokenIndex).length}`);
  console.log(`⚡ Tiempo de compilación: ${elapsed}ms`);

  return payload;
}

if (require.main === module) {
  buildEmojiData();
}

module.exports = { buildEmojiData, normalizeText, tokenize };
