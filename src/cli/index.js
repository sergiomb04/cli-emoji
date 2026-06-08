const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { loadEmojisFromTxt } = require('../logic/data');
const data = loadEmojisFromTxt();
const { searchEmojis } = require('../logic/search');
const chalk = require('chalk');
const { execSync } = require('child_process');

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

let input = '';
let selectedIndex = 0;
let results = [];

function render() {
  console.clear();
  console.log('> ' + input);

  results = input.length > 0 ? searchEmojis(input, data) : [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const isSelected = i === selectedIndex;
    const prefix = isSelected ? '> ' : '  ';
    const line = `${prefix}${r.emoji} ${r.keywords[0]}`;
    console.log(isSelected ? chalk.green(line) : line);
  }
}

process.stdin.on('keypress', async (str, key) => {
  // Exit command
  if (input.trim().toLowerCase() === 'exit' && key.name === 'return') {
    console.log('\nExit command received.');
    process.exit();
    return;
  }

  if (key.name === 'return') {
    if (results[selectedIndex]) {
      const selected = results[selectedIndex];
      
      // Simular pulsación de teclas usando PowerShell (sin usar el portapapeles)
      // Esto evita que quede rastro en el historial de Windows (Win + V)
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        
        // Escapar el emoji para PowerShell
        const psCommand = `powershell -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${selected.emoji}')"`;

        try {
          // Ejecutar tecleado y salir
          execSync(psCommand);
          process.exit();
        } catch (err) {
          console.error('\nError al teclear con PowerShell:', err);
          process.exit(1);
        }
      } else {
        // Fallback para no-Windows (si es necesario)
        console.log('\nSeleccionado (Tecleado automático solo disponible en Windows):', selected.emoji);
        process.exit();
      }
    } else {
      process.exit();
    }
    return;
  }

  if (key.name === 'up') {
    selectedIndex = Math.max(0, selectedIndex - 1);
  } else if (key.name === 'down') {
    selectedIndex = Math.min(results.length - 1, selectedIndex + 1);
  } else if (key.name === 'backspace') {
    input = input.slice(0, -1);
    selectedIndex = 0;
  } else if (key.ctrl && key.name === 'c') {
    process.exit();
  } else if (str) {
    input += str;
    selectedIndex = 0;
  }

  render();
});

render();
