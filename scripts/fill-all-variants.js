const fs = require('fs');
const path = require('path');
const https = require('https');

const EMOJI_URL = "https://unicode.org/Public/emoji/latest/emoji-test.txt";
const emojisPath = path.join(__dirname, '../data/emojis.txt');

function loadExistingEmojis() {
  if (!fs.existsSync(emojisPath)) return new Map();
  
  const content = fs.readFileSync(emojisPath, 'utf8');
  const map = new Map();
  content.split('\n').forEach(line => {
    if (!line.trim()) return;
    const parts = line.split(':');
    const emoji = parts.shift().trim();
    const keywords = parts.join(':').trim();
    map.set(emoji, keywords);
  });
  return map;
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

// Expresión regular para quitar los modificadores de tono de piel (Fitzpatrick)
const skinTones = /[\u{1F3FB}-\u{1F3FF}]/gu;

async function fillAllVariants() {
  console.log('Cargando emojis existentes...');
  const existingMap = loadExistingEmojis();
  console.log(`Se cargaron ${existingMap.size} emojis de data/emojis.txt.`);
  
  console.log('Descargando lista oficial de emojis desde unicode.org...');
  const raw = await fetchEmojiList();
  
  const lines = raw.split('\n');
  const allEmojis = [];
  
  for (const line of lines) {
    if (!line.includes('; fully-qualified')) continue;
    
    const parts = line.split('#');
    if (parts.length < 2) continue;
    
    // Extraer el emoji (el primer carácter visible después del #)
    const emojiMatch = parts[1].trim().match(/^(\S+)/);
    if (!emojiMatch) continue;
    const emoji = emojiMatch[1];
    
    // Extraer la descripción oficial
    const description = parts[1].trim().substring(emoji.length).trim();
    const name = description.replace(/^E\d+\.\d+\s+/, '');
    
    allEmojis.push({ emoji, name });
  }
  
  console.log(`Se encontraron ${allEmojis.length} emojis válidos en total en el estándar de Unicode.`);
  
  let addedVariants = 0;
  let addedNew = 0;
  
  const newMap = new Map();
  
  for (const { emoji, name } of allEmojis) {
    if (existingMap.has(emoji)) {
      // Ya lo tenemos, mantener las palabras clave existentes
      newMap.set(emoji, existingMap.get(emoji));
    } else {
      // Es nuevo, intentamos buscar sus palabras clave base quitando tonos de piel
      const baseEmoji = emoji.replace(skinTones, '');
      if (baseEmoji !== emoji && existingMap.has(baseEmoji)) {
        // Es una variante de un emoji existente, copiamos sus keywords
        newMap.set(emoji, existingMap.get(baseEmoji));
        addedVariants++;
      } else {
        // Es un emoji completamente nuevo que no teníamos, usamos su nombre en inglés temporalmente
        newMap.set(emoji, name);
        addedNew++;
      }
    }
  }
  
  // Guardar todo de vuelta en emojis.txt, manteniendo el orden de unicode.org
  const output = [];
  for (const [emoji, keywords] of newMap.entries()) {
    output.push(`${emoji}:${keywords}`);
  }
  
  fs.writeFileSync(emojisPath, output.join('\n') + '\n', 'utf8');
  
  console.log(`\n✅ Archivo emojis.txt actualizado con éxito.`);
  console.log(`✨ Se han añadido ${addedVariants} variantes nuevas (heredando keywords).`);
  console.log(`✨ Se han añadido ${addedNew} emojis completamente nuevos.`);
  console.log(`📈 Total de emojis ahora: ${newMap.size}`);

  // Regenerar automáticamente el caché optimizado
  try {
    const { buildEmojiData } = require('./build-data');
    buildEmojiData();
  } catch (err) {
    console.error('Error al regenerar caché:', err);
  }
}

fillAllVariants().catch(console.error);
