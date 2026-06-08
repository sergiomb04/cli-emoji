const fs = require('fs');
const path = require('path');

const emojisPath = path.join(__dirname, '..', 'data', 'emojis.txt');
const mejorasPath = path.join(__dirname, 'mejoras.txt');

function parseLine(line) {
  if (!line.trim()) return null;
  const [emoji, keywordsStr] = line.split(':');
  if (!emoji || !keywordsStr) return null;
  const keywords = keywordsStr.split(',').map(k => k.trim()).filter(k => k);
  return { emoji: emoji.trim(), keywords };
}

function updateEmojis() {
  console.log('--- Iniciando actualización de emojis ---');

  if (!fs.existsSync(emojisPath)) {
    console.error(`Error: No se encontró el archivo de datos en ${emojisPath}`);
    return;
  }

  if (!fs.existsSync(mejorasPath)) {
    console.error(`Error: No se encontró el archivo de mejoras en ${mejorasPath}`);
    return;
  }

  // Leer emojis actuales
  const emojisContent = fs.readFileSync(emojisPath, 'utf-8');
  const emojisLines = emojisContent.split('\n');
  const emojiMap = new Map();
  const emojiOrder = [];

  for (const line of emojisLines) {
    const parsed = parseLine(line);
    if (parsed) {
      emojiMap.set(parsed.emoji, new Set(parsed.keywords));
      emojiOrder.push(parsed.emoji);
    }
  }

  // Leer mejoras
  const mejorasContent = fs.readFileSync(mejorasPath, 'utf-8');
  const mejorasLines = mejorasContent.split('\n');

  let addedCount = 0;
  let updatedCount = 0;

  for (const line of mejorasLines) {
    const parsed = parseLine(line);
    if (parsed) {
      if (emojiMap.has(parsed.emoji)) {
        const existingKeywords = emojiMap.get(parsed.emoji);
        let changed = false;
        for (const kw of parsed.keywords) {
          if (!existingKeywords.has(kw)) {
            existingKeywords.add(kw);
            changed = true;
          }
        }
        if (changed) updatedCount++;
      } else {
        emojiMap.set(parsed.emoji, new Set(parsed.keywords));
        emojiOrder.push(parsed.emoji);
        addedCount++;
      }
    }
  }

  // Reconstruir el archivo
  const outputLines = emojiOrder.map(emoji => {
    const keywords = Array.from(emojiMap.get(emoji)).join(',');
    return `${emoji}:${keywords}`;
  });

  fs.writeFileSync(emojisPath, outputLines.join('\n') + '\n', 'utf-8');

  console.log(`Actualización completada.`);
  console.log(`Emojis nuevos añadidos: ${addedCount}`);
  console.log(`Emojis actualizados con nuevos keywords: ${updatedCount}`);
}

updateEmojis();
