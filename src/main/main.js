const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadEmojisFromTxt } = require('../logic/data');
const { searchEmojis } = require('../logic/search');

let win;
let isStickyMode = false; // Controla si la ventana se queda abierta o no
let emojiData = loadEmojisFromTxt();

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

  // Volvemos a show() para que el usuario pueda escribir la búsqueda inmediatamente
  // Es la única forma de que el input reciba teclado.
  win.show();
  win.focus();
  win.setAlwaysOnTop(true, 'screen-saver');

  win.webContents.send('window-shown');
}


app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+Alt+X', () => {
    toggleWindow(false);
  });

  globalShortcut.register('CommandOrControl+Alt+Z', () => {
    toggleWindow(true);
  });

  // Opcional: ocultar de la barra de tareas en macOS si se desea
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC Listeners
ipcMain.handle('search', (event, query) => {
  return searchEmojis(query, emojiData);
});

ipcMain.on('insert-emoji', (event, emoji) => {
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
        win.setAlwaysOnTop(true, 'screen-saver');
        win.webContents.send('window-shown');
      }
    }, 1000); // Delay un poco más largo para permitir que el "tecleo" termine
  }

  // 2. Simular pulsación de teclas usando PowerShell (sin usar el portapapeles)
  // Esto evita que quede rastro en el historial de Windows (Win + V)
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    
    // Escapar el emoji para PowerShell. Como son emojis, basta con comillas simples.
    // Usamos System.Windows.Forms.SendKeys para simular la entrada de teclado.
    const psCommand = `powershell -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${emoji}')"`;

    try {
      exec(psCommand, (err) => {
        if (err) console.error('Error al teclear con PowerShell:', err);
      });
    } catch (e) {
      console.error('Error ejecutando PowerShell:', e);
    }
  } else {
    // En otras plataformas, por ahora fallback a clipboard si no hay método de typing directo
    clipboard.writeText(emoji);
  }
});

ipcMain.on('hide-app', () => {
  win.hide();
});

ipcMain.on('reload-data', () => {
  emojiData = loadEmojisFromTxt();
  console.log('Emoji data reloaded');
});

ipcMain.on('quit-app', () => {
  app.quit();
});