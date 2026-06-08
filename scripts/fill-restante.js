const fs = require('fs');
const path = require('path');
const https = require('https');

const EMOJI_URL = "https://unicode.org/Public/emoji/latest/emoji-test.txt";

function loadExistingEmojis() {
  const content = fs.readFileSync(path.join(__dirname, '../data/emojis.txt'), 'utf8');

  return new Set(
    content
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.split(':')[0].trim())
  );
}

function fetchEmojiList() {
  return new Promise((resolve, reject) => {
    https.get(EMOJI_URL, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });
}

function parseEmojis(raw) {
  return raw
    .split('\n')
    // solo emojis válidos
    .filter(line => line.includes('; fully-qualified'))

    // ❌ fuera variantes
    .filter(line => !line.includes('skin tone'))
    .filter(line => !line.includes('ZWJ'))

    // (opcional) ❌ fuera banderas (muchas y poco útiles en búsqueda)
    // .filter(line => !line.includes('flag:'))

    .map(line => {
      const parts = line.split('#');
      if (parts.length < 2) return null;

      return parts[1].trim().split(' ')[0];
    })
    .filter(Boolean);
}

async function findMissing() {
  const existing = loadExistingEmojis();
  const raw = await fetchEmojiList();
  const all = parseEmojis(raw);

  const missing = all.filter(e => !existing.has(e));

  const output = missing.map(e => `${e}:`).join('\n');

  const outputPath = path.join(__dirname, '../data/missing.txt');

  fs.writeFileSync(outputPath, output, 'utf8');

  console.log(`✅ Archivo generado: missing.txt (${missing.length} emojis)`);
}

findMissing().catch(console.error);