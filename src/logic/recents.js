const fs = require('fs');
const path = require('path');

const MAX_RECENTS = 36;

class RecentEmojisService {
  constructor(filePath) {
    this.filePath = filePath;
    this.recents = [];
    this.saveTimeout = null;
    this.isLoaded = false;
  }

  load() {
    if (this.isLoaded) return this.recents;

    try {
      if (this.filePath && fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.recents = parsed.slice(0, MAX_RECENTS);
        }
      }
    } catch (err) {
      console.error('Error al cargar recent-emojis.json:', err);
      this.recents = [];
    }

    this.isLoaded = true;
    return this.recents;
  }

  getRecents() {
    if (!this.isLoaded) {
      this.load();
    }
    return [...this.recents];
  }

  addRecent(emoji) {
    if (!emoji || typeof emoji !== 'string') return;
    const cleanEmoji = emoji.trim();
    if (!cleanEmoji) return;

    if (!this.isLoaded) {
      this.load();
    }

    // Filtrar si ya existía para moverlo al frente (MRU puro)
    this.recents = [cleanEmoji, ...this.recents.filter(e => e !== cleanEmoji)].slice(0, MAX_RECENTS);

    this.scheduleSave();
  }

  removeRecent(emoji) {
    if (!emoji || typeof emoji !== 'string') return this.recents;
    const cleanEmoji = emoji.trim();
    if (!cleanEmoji) return this.recents;

    if (!this.isLoaded) {
      this.load();
    }

    const prevLength = this.recents.length;
    this.recents = this.recents.filter(e => e !== cleanEmoji);

    if (this.recents.length !== prevLength) {
      this.scheduleSave();
    }

    return [...this.recents];
  }

  setRecents(list) {
    if (!Array.isArray(list)) return this.recents;

    if (!this.isLoaded) {
      this.load();
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    this.recents = list
      .filter(e => typeof e === 'string' && e.trim().length > 0)
      .map(e => e.trim())
      .slice(0, MAX_RECENTS);

    this.saveSync();
    return [...this.recents];
  }

  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveSync();
    }, 400);
  }

  saveSync() {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.recents, null, 2), 'utf8');
    } catch (err) {
      console.error('Error al guardar recent-emojis.json:', err);
    }
  }

  clear() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.recents = [];
    this.saveSync();
    return [...this.recents];
  }
}

module.exports = {
  RecentEmojisService,
  MAX_RECENTS
};
