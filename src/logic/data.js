const fs = require('fs');
const path = require('path');

const cachePath = path.join(__dirname, '../../data/emojis.cache.json');
const txtPath = path.join(__dirname, '../../data/emojis.txt');

let memoryCache = null;

function loadEmojis() {
  if (memoryCache) {
    return memoryCache;
  }

  // 1. Intentar cargar desde el caché precompilado JSON (tiempo de carga ~1ms)
  if (fs.existsSync(cachePath)) {
    try {
      const raw = fs.readFileSync(cachePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.emojis)) {
        memoryCache = parsed.emojis;
        return memoryCache;
      }
    } catch (err) {
      console.warn('Advertencia al leer emojis.cache.json, regenerando...', err);
    }
  }

  // 2. Si no existe o falló, construir el caché a partir de emojis.txt de forma automática
  try {
    const { buildEmojiData } = require('../../scripts/build-data');
    const built = buildEmojiData();
    memoryCache = built.emojis;
    return memoryCache;
  } catch (buildErr) {
    console.error('Error al generar caché automáticamente:', buildErr);
  }

  // 3. Fallback de emergencia a parseo de texto plano si todo lo demás falla
  return parseFallbackTxt();
}

function parseFallbackTxt() {
  try {
    if (!fs.existsSync(txtPath)) return [];
    const content = fs.readFileSync(txtPath, 'utf8');
    const list = content
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const [emoji, keywordsStr] = line.split(':');
        return {
          emoji: emoji ? emoji.trim() : '',
          keywords: keywordsStr ? keywordsStr.split(',').map(k => k.trim()) : [],
          normalized: keywordsStr ? keywordsStr.split(',').map(k => k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ñ/g, "n")) : [],
          variants: []
        };
      });

    const grouped = [];
    const baseIndexMap = new Map();

    list.forEach(item => {
      const baseMatch = item.emoji.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
      if (baseMatch !== item.emoji && baseIndexMap.has(baseMatch)) {
        grouped[baseIndexMap.get(baseMatch)].variants.push({
          emoji: item.emoji,
          keywords: item.keywords
        });
      } else {
        baseIndexMap.set(item.emoji, grouped.length);
        grouped.push(item);
      }
    });

    memoryCache = grouped;
    return grouped;
  } catch (err) {
    console.error('Error loading emojis fallback:', err);
    return [];
  }
}

function reloadEmojis() {
  memoryCache = null;
  // Si existe el compilador, regenerar
  try {
    const { buildEmojiData } = require('../../scripts/build-data');
    buildEmojiData();
  } catch (e) {
    // ignorar si no está disponible
  }
  return loadEmojis();
}

function buildAndReloadEmojis() {
  memoryCache = null;

  // Compilar emojis.txt -> emojis.cache.json
  const { buildEmojiData } = require('../../scripts/build-data');
  const buildResult = buildEmojiData();

  // Actualizar memoria
  memoryCache = buildResult.emojis;

  return {
    total: buildResult.totalEmojis,
    emojis: memoryCache
  };
}

function getEmojiDetails(emojiChar) {
  if (!emojiChar || typeof emojiChar !== 'string') return null;
  const clean = emojiChar.trim();

  // Buscar primero en emojis.txt para obtener la lista exacta de keywords
  if (fs.existsSync(txtPath)) {
    try {
      const content = fs.readFileSync(txtPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) continue;
        const emoji = trimmed.slice(0, colonIdx).trim();
        if (emoji === clean) {
          const keywordsStr = trimmed.slice(colonIdx + 1).trim();
          const keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()).filter(Boolean) : [];
          return { emoji, keywords };
        }
      }
    } catch (e) {
      console.error('Error al leer emojis.txt en getEmojiDetails:', e);
    }
  }

  // Fallback a memoria
  const emojis = loadEmojis();
  for (const item of emojis) {
    if (item.emoji === clean) {
      return { emoji: item.emoji, keywords: item.keywords || [] };
    }
    if (item.variants && Array.isArray(item.variants)) {
      const foundVar = item.variants.find(v => v.emoji === clean);
      if (foundVar) {
        return { emoji: foundVar.emoji, keywords: foundVar.keywords || [] };
      }
    }
  }

  return null;
}

function saveEmoji({ emoji, keywords, originalEmoji, overwrite = false }) {
  if (!emoji || typeof emoji !== 'string' || !emoji.trim()) {
    return { success: false, error: 'INVALID_EMOJI', message: 'El emoji no puede estar vacío.' };
  }
  const cleanEmoji = emoji.trim();

  let cleanKeywords = [];
  if (Array.isArray(keywords)) {
    cleanKeywords = keywords;
  } else if (typeof keywords === 'string') {
    cleanKeywords = keywords.split(',');
  }
  cleanKeywords = Array.from(new Set(
    cleanKeywords
      .map(k => (typeof k === 'string' ? k.trim().toLowerCase() : ''))
      .filter(Boolean)
  ));

  if (cleanKeywords.length === 0) {
    return { success: false, error: 'NO_KEYWORDS', message: 'Debes añadir al menos una palabra clave.' };
  }

  if (!fs.existsSync(txtPath)) {
    return { success: false, error: 'FILE_NOT_FOUND', message: 'No se encontró emojis.txt' };
  }

  const content = fs.readFileSync(txtPath, 'utf8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

  const isEditing = Boolean(originalEmoji && originalEmoji.trim());
  const searchEmoji = isEditing ? originalEmoji.trim() : cleanEmoji;

  let targetIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const colonIdx = lines[i].indexOf(':');
    if (colonIdx === -1) continue;
    const currentEmoji = lines[i].slice(0, colonIdx).trim();
    if (currentEmoji === searchEmoji) {
      targetIndex = i;
      break;
    }
  }

  // Si estamos creando y el emoji ya existe
  if (!isEditing && targetIndex !== -1 && !overwrite) {
    return {
      success: false,
      error: 'ALREADY_EXISTS',
      message: `El emoji ${cleanEmoji} ya existe en el catálogo.`,
      existingEmoji: cleanEmoji
    };
  }

  // Si estamos editando y el emoji cambió de carácter a uno que ya existe en otra línea
  if (isEditing && searchEmoji !== cleanEmoji) {
    const duplicateIndex = lines.findIndex(l => {
      const colonIdx = l.indexOf(':');
      if (colonIdx === -1) return false;
      return l.slice(0, colonIdx).trim() === cleanEmoji;
    });
    if (duplicateIndex !== -1 && duplicateIndex !== targetIndex) {
      return {
        success: false,
        error: 'DUPLICATE_NEW_EMOJI',
        message: `El nuevo emoji ${cleanEmoji} ya existe en el catálogo.`
      };
    }
  }

  const newLine = `${cleanEmoji}:${cleanKeywords.join(',')}`;

  if (targetIndex !== -1) {
    lines[targetIndex] = newLine;
  } else {
    lines.push(newLine);
  }

  const updatedContent = lines.join(eol) + eol;
  fs.writeFileSync(txtPath, updatedContent, 'utf8');

  // Recompilar JSON de caché y actualizar memoria
  const reloadResult = buildAndReloadEmojis();

  return {
    success: true,
    isNew: targetIndex === -1,
    emoji: cleanEmoji,
    keywords: cleanKeywords,
    total: reloadResult.total,
    emojis: reloadResult.emojis
  };
}

function deleteEmoji(emojiChar) {
  if (!emojiChar || typeof emojiChar !== 'string' || !emojiChar.trim()) {
    return { success: false, error: 'INVALID_EMOJI', message: 'Emoji no válido.' };
  }
  const cleanEmoji = emojiChar.trim();

  if (!fs.existsSync(txtPath)) {
    return { success: false, error: 'FILE_NOT_FOUND', message: 'No se encontró emojis.txt' };
  }

  const content = fs.readFileSync(txtPath, 'utf8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

  const initialCount = lines.length;
  const filteredLines = lines.filter(l => {
    const colonIdx = l.indexOf(':');
    if (colonIdx === -1) return true;
    return l.slice(0, colonIdx).trim() !== cleanEmoji;
  });

  if (filteredLines.length === initialCount) {
    return { success: false, error: 'NOT_FOUND', message: 'El emoji no fue encontrado en el catálogo.' };
  }

  const updatedContent = filteredLines.join(eol) + eol;
  fs.writeFileSync(txtPath, updatedContent, 'utf8');

  const reloadResult = buildAndReloadEmojis();

  return {
    success: true,
    emoji: cleanEmoji,
    total: reloadResult.total,
    emojis: reloadResult.emojis
  };
}

module.exports = {
  loadEmojis,
  loadEmojisFromTxt: loadEmojis, // Alias para compatibilidad hacia atrás
  reloadEmojis,
  buildAndReloadEmojis,
  getEmojiDetails,
  saveEmoji,
  deleteEmoji
};
