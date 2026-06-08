const fs = require('fs');
const path = require('path');

function loadEmojisFromTxt() {
  try {
    const content = fs.readFileSync(path.join(__dirname, '../../data/emojis.txt'), 'utf8');
    const list = content
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const [emoji, keywordsStr] = line.split(':');
        return {
          emoji: emoji.trim(),
          keywords: keywordsStr ? keywordsStr.split(',').map(k => k.trim()) : [],
          variants: []
        };
      });

    const grouped = [];
    const baseIndexMap = new Map();

    list.forEach(item => {
      const baseMatch = item.emoji.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
      if (baseMatch !== item.emoji && baseIndexMap.has(baseMatch)) {
        grouped[baseIndexMap.get(baseMatch)].variants.push(item);
      } else {
        baseIndexMap.set(item.emoji, grouped.length);
        grouped.push(item);
      }
    });

    return grouped;
  } catch (err) {
    console.error('Error loading emojis.txt:', err);
    return [];
  }
}

module.exports = { loadEmojisFromTxt };
