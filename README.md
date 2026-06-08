# cli-emoji

Buscador e insertador de emojis para Windows, pensado para escribir rápido en cualquier app sin ensuciar el historial del portapapeles.

Este proyecto tiene dos modos:

- Modo CLI en terminal
- Modo overlay con Electron (ventana flotante con atajos globales)

## Características

- Búsqueda por keywords (español/inglés) con ranking por relevancia.
- Normalización inteligente:
  - Ignora tildes.
  - Trata `ñ` como `n` para facilitar escritura.
- Inserción por tecleo simulado en Windows (PowerShell `SendKeys`) en vez de copiar/pegar.
- Modo normal y modo sticky en la UI de Electron.
- Soporte de variantes de tono de piel agrupadas bajo el emoji base.
- Recarga de datos desde la propia UI (`↻`).

## Por qué no usa portapapeles en Windows

La inserción principal en Windows se hace con `System.Windows.Forms.SendKeys` para evitar dejar rastro en el historial `Win + V`.

Ventajas:

- No contamina el historial de portapapeles.
- Respeta lo que ya tengas copiado.

## Requisitos

- Windows (recomendado para la experiencia completa de inserción automática).
- Node.js + npm.

Notas de plataforma:

- En Windows: inserta emojis tecleándolos automáticamente.
- En otras plataformas: hay fallback parcial (por ejemplo, portapapeles en Electron), pero el flujo está optimizado para Windows.

## Instalación

```bash
npm install
```

## Uso rápido

### 1) Modo CLI (terminal)

```bash
npm start
```

Controles en CLI:

- Escribir para buscar.
- `↑` / `↓` para moverte por resultados.
- `Enter` para insertar el emoji seleccionado.
- `Backspace` para borrar.
- `Ctrl + C` para salir.
- También puedes escribir `exit` y pulsar `Enter`.

### 2) Modo overlay (Electron)

```bash
npm run electron
```

También puedes usar:

- `start.bat`
- `start.ps1`

Atajos globales:

- `Ctrl + Alt + X`: abrir/cerrar en modo normal.
- `Ctrl + Alt + Z`: abrir/cerrar en modo sticky (tras insertar, reaparece automáticamente).

Controles en la ventana:

- `Esc`: ocultar ventana.
- `Enter`: insertar emoji seleccionado.
- `↑` / `↓`: navegar resultados.
- `→` / `←`: abrir/cerrar variantes del resultado actual.
- Botón `↻`: recargar base de emojis.
- Botón `×`: cerrar la app completa.

## Estructura del proyecto

```text
src/
  cli/        # interfaz de terminal
  logic/      # carga de datos + motor de búsqueda
  main/       # proceso principal de Electron
  preload/    # puente seguro IPC
  renderer/   # UI (html/css/js)
data/
  emojis.txt  # base principal emoji:keyword1,keyword2,...
  missing.txt # salida auxiliar de script de faltantes
scripts/
  update_emojis.js    # fusiona mejoras desde scripts/mejoras.txt
  fill-all-variants.js# completa variantes usando unicode.org
  fill-restante.js    # detecta emojis faltantes y genera data/missing.txt
```

## Formato de datos

Archivo: `data/emojis.txt`

Cada línea:

```text
😀:sonrisa,feliz,smile,happy
```

Reglas:

- Izquierda: emoji.
- Derecha: keywords separadas por comas.
- Líneas vacías se ignoran.

## Scripts de mantenimiento

### Actualizar keywords desde mejoras locales

```bash
npm run update-emojis
```

Toma entradas de `scripts/mejoras.txt` y:

- Añade emojis nuevos si no existen.
- Fusiona keywords sin duplicar para emojis existentes.

### Completar variantes y nuevos emojis desde Unicode

```bash
node scripts/fill-all-variants.js
```

- Descarga `emoji-test.txt` oficial de Unicode.
- Añade variantes heredando keywords cuando corresponde.
- Añade emojis completamente nuevos con nombre base temporal.

### Detectar faltantes

```bash
node scripts/fill-restante.js
```

- Compara base local con lista oficial Unicode.
- Genera `data/missing.txt` con los emojis ausentes.

## Cómo funciona internamente

- `src/logic/data.js`:
  - Carga `data/emojis.txt`.
  - Agrupa variantes de tono de piel bajo su emoji base.
- `src/logic/search.js`:
  - Normaliza texto (tildes y `ñ`).
  - Puntúa coincidencias (exacta, prefijo, contiene y por tokens).
  - Devuelve top 15 resultados.
- `src/main/main.js`:
  - Registra atajos globales.
  - Gestiona ventana overlay y foco.
  - Inserta emojis por PowerShell en Windows.
- `src/renderer/renderer.js`:
  - Gestiona input, navegación, renderizado y variantes.

## Solución de problemas

- No se insertan emojis en Windows:
  - Asegúrate de que PowerShell esté disponible.
  - Prueba abrir la app destino con foco real antes de insertar.
  - Si la app destino bloquea input simulado, prueba en otra (Notepad, navegador, etc.).
- Atajos globales no responden:
  - Cierra otras apps que puedan capturar `Ctrl + Alt + X/Z`.
  - Reinicia la app Electron.
- Cambiaste `data/emojis.txt` y no ves cambios:
  - Pulsa `↻` en la UI o reinicia la app.

## Estado actual

- Proyecto funcional para uso diario en Windows.
- Sin tests automatizados aún (`npm test` no está implementado).

## Licencia

ISC (según `package.json`).
