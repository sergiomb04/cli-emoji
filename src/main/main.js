const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const logFile = path.join(__dirname, '../../debug.log');
function log(msg) {
  try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`); } catch(e){}
}
process.on('uncaughtException', (err) => { log(`UNCAUGHT: ${err.stack || err}`); });
process.on('unhandledRejection', (err) => { log(`REJECTION: ${err.stack || err}`); });
log('Iniciando main.js...');

const { loadEmojis, reloadEmojis } = require('../logic/data');
const { searchEmojis, clearSearchCache } = require('../logic/search');
const { RecentEmojisService } = require('../logic/recents');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log('Otra instancia ya está ejecutándose. Saliendo de esta instancia...');
  app.quit();
}

app.on('second-instance', () => {
  log('Segunda instancia invocada: mostrando ventana...');
  if (win) {
    toggleWindow(false);
  }
});

let win;
let isStickyMode = false; // Controla si la ventana se queda abierta o no
let emojiData = loadEmojis();
const recentsFile = path.join(app.getPath('userData'), 'recent-emojis.json');
const recentsService = new RecentEmojisService(recentsFile);
recentsService.load();
let lastForegroundHwnd = '0';
const inserterExe = path.join(__dirname, '../../bin/inserter.exe');

function captureActiveWindowSync() {
  if (process.platform !== 'win32' || !fs.existsSync(inserterExe)) return '0';
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync(inserterExe, ['--get-active'], { windowsHide: true }).toString().trim();
    if (out && out !== '0') {
      log(`Ventana previa capturada: HWND ${out}`);
      return out;
    }
  } catch (e) {
    log(`Error capturando ventana previa: ${e}`);
  }
  return '0';
}

function createWindow() {
  win = new BrowserWindow({
    width: 600,
    height: 450,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    // type: 'toolbar', // Comentado para mejorar el comportamiento del foco en Windows
    center: true,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    focusable: true
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Pre-renderizado invisible cuando termine de cargar para evitar lag de primera apertura
  win.webContents.once('did-finish-load', () => {
    win.setOpacity(0);
    win.showInactive();
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.hide();
        win.setOpacity(1);
      }
    }, 50);
  });

  // Removido: No ocultar automáticamente al perder el foco para permitir selección múltiple
  // win.on('blur', () => {
  //   win.hide();
  // });
}

function toggleWindow(sticky = false) {
  if (!win || win.isDestroyed()) {
    createWindow();
  }

  // Si la ventana está visible y el modo es el mismo, la ocultamos
  // Si el modo cambia, la mantenemos visible pero actualizamos el modo
  if (win.isVisible() && isStickyMode === sticky) {
    win.hide();
    return;
  }

  isStickyMode = sticky;
  // Soporte multi-pantalla: Centrar en la pantalla donde esté el ratón
  const mousePoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(mousePoint);
  const { width, height, x, y } = activeDisplay.bounds;

  const windowWidth = 600;
  const windowHeight = 450;

  const posX = x + Math.round((width - windowWidth) / 2);
  const posY = y + Math.round((height - windowHeight) / 2);

  win.setPosition(posX, posY);

  win.show();
  win.focus();
  try {
    win.setAlwaysOnTop(true, 'screen-saver');
  } catch (e) {
    win.setAlwaysOnTop(true);
  }

  win.webContents.send('window-shown');
}


app.whenReady().then(() => {
  log('app.whenReady completado, creando ventana...');
  createWindow();

  const regX = globalShortcut.register('CommandOrControl+Alt+X', () => {
    log('Atajo Ctrl+Alt+X presionado');
    if (!win || !win.isVisible()) {
      lastForegroundHwnd = captureActiveWindowSync();
    }
    toggleWindow(false);
  });
  log(`Atajo Ctrl+Alt+X registrado: ${regX}`);

  const regZ = globalShortcut.register('CommandOrControl+Alt+Z', () => {
    log('Atajo Ctrl+Alt+Z presionado');
    if (!win || !win.isVisible()) {
      lastForegroundHwnd = captureActiveWindowSync();
    }
    toggleWindow(true);
  });
  log(`Atajo Ctrl+Alt+Z registrado: ${regZ}`);

  // Opcional: ocultar de la barra de tareas en macOS si se desea
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

app.on('window-all-closed', (e) => {
  log('EVENT: window-all-closed disparado. Evitando salida (e.preventDefault)...');
  e.preventDefault(); // Evitar que Electron se cierre automáticamente
});

app.on('will-quit', () => {
  log('EVENT: will-quit disparado');
  recentsService.saveSync();
  globalShortcut.unregisterAll();
});

app.on('quit', (e, exitCode) => {
  log(`EVENT: quit disparado con exitCode: ${exitCode}`);
});

// IPC Listeners
ipcMain.handle('search', (event, query) => {
  return searchEmojis(query, emojiData);
});

ipcMain.handle('get-recents', () => {
  const recentList = recentsService.getRecents();
  const emojiMap = new Map();
  emojiData.forEach(item => {
    emojiMap.set(item.emoji, item);
    if (item.variants && Array.isArray(item.variants)) {
      item.variants.forEach(v => emojiMap.set(v.emoji, v));
    }
  });

  return recentList.map(emoji => {
    const found = emojiMap.get(emoji);
    return {
      emoji,
      keywords: found && found.keywords ? found.keywords : ['reciente']
    };
  });
});

ipcMain.on('track-emoji', (event, emoji) => {
  recentsService.addRecent(emoji);
});

ipcMain.on('insert-emoji', (event, emoji) => {
  log(`ipcMain insert-emoji recibido: ${emoji}, destino HWND: ${lastForegroundHwnd}`);
  recentsService.addRecent(emoji);

  // 1. Manejo de foco según el modo
  // Ocultamos la ventana para que el foco vuelva a la aplicación anterior
  win.setAlwaysOnTop(false);
  win.blur();
  win.hide();

  if (isStickyMode) {
    // Modo Sticky: Forzamos el foco de vuelta después de un tiempo
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.show();
        win.focus();
        try {
          win.setAlwaysOnTop(true, 'screen-saver');
        } catch (e) {
          win.setAlwaysOnTop(true);
        }
        win.webContents.send('window-shown');
      }
    }, 1000);
  }

  // 2. Insertar emoji restaurando foco en la aplicación y campo activo
  if (process.platform === 'win32') {
    if (fs.existsSync(inserterExe)) {
      const { execFile } = require('child_process');
      const targetHwnd = (lastForegroundHwnd && lastForegroundHwnd !== '0') ? lastForegroundHwnd : '0';
      execFile(inserterExe, [targetHwnd, emoji], { windowsHide: true }, (err) => {
        if (err) {
          log(`Error en inserter.exe: ${err}`);
        } else {
          log(`Inserter ejecutado con éxito para emoji: ${emoji}`);
        }
      });
    } else {
      clipboard.writeText(emoji);
    }
  } else {
    // En otras plataformas, fallback a clipboard si no hay método de typing directo
    clipboard.writeText(emoji);
  }
});

ipcMain.on('hide-app', () => {
  win.hide();
});

ipcMain.on('reload-data', () => {
  clearSearchCache();
  emojiData = reloadEmojis();
  console.log('Emoji data reloaded');
});

ipcMain.on('quit-app', () => {
  app.quit();
});