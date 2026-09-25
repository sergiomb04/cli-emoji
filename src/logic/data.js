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

module.exports = {
  loadEmojis,
  loadEmojisFromTxt: loadEmojis, // Alias para compatibilidad hacia atrás
  reloadEmojis,
  buildAndReloadEmojis
};
