# cli-emoji

Buscador e insertador de emojis ultrarrápido y ligero para Windows, diseñado para escribir al instante en cualquier aplicación, navegador o campo de texto sin perder el foco y sin ensuciar el historial del portapapeles (`Win + V`).

---

## ⚡ Modos de Funcionamiento

1. **Modo Overlay (Electron flotante):** Ventana transparente y sin marco que aparece mediante atajos globales sobre la app activa, lista para escribir o hacer clic.
2. **Modo CLI (Terminal):** Buscador interactivo directamente en consola para entornos de comandos (`npm start`).

---

## ✨ Características Principales

- **Cero pérdida de foco:** Detecta automáticamente la ventana y pestaña de origen (navegador, bloc de notas, editor de código, chat, etc.) y restaura el cursor/caret exactamente en el input donde estabas escribiendo al insertar el emoji.
- **Inserción por clic o Enter:** Puedes seleccionar con el teclado (`Enter`) o hacer clic directo con el ratón en cualquier emoji o variante para insertarlo inmediatamente.
- **Sin contaminación de portapapeles:** Utiliza inserción nativa de teclado de Windows (`SendInput` Unicode de 64 bits) en lugar de copiar/pegar, preservando íntegro tu portapapeles y el historial `Win + V`.
- **Carga instantánea (< 2 ms):** Catálogo precompilado con índice invertido en JSON (`emojis.cache.json`), eliminando parseos lentos de texto al reiniciar el PC.
- **Búsqueda en tiempo real (< 0.3 ms):**
  - Normalización inteligente: ignora tildes (`corazón` = `corazon`) y trata `ñ` como `n`.
  - Coincidencias exactas, por prefijo, contenido y palabras clave compuestas.
  - Resultados inmediatos al abrir la ventana (top 15 por defecto) y micro-debounce para escritura fluida.
- **Agrupación de tonos de piel:** Variantes Fitzpatrick desplegables (`▼` / flecha derecha) integradas bajo el emoji base.
- **Modo Normal y Modo Sticky:**
  - `Ctrl + Alt + X`: Modo normal (se oculta al insertar).
  - `Ctrl + Alt + Z`: Modo sticky (reaparece automáticamente para insertar múltiples emojis seguidos).

---

## 🚀 Inicio Rápido

### Requisitos
- Windows 10 o Windows 11 (recomendado para inserción nativa de foco y teclado).
- Node.js 16+ instalado.

### Instalación
```bash
npm install
npm run build:data
```

### Iniciar la Aplicación

#### Opción A: Inicio rápido en segundo plano (Recomendado para el día a día)
```powershell
# Ejecuta Electron directamente en segundo plano sin consola abierta
.\start.ps1
```
O haz doble clic en **`start-fast.vbs`** (100% silencioso, ideal para crear un acceso directo en `shell:startup`).

#### Opción B: Modo desarrollador / consola
```bash
npm run electron
```

#### Opción C: Modo Terminal (CLI)
```bash
npm start
```

---

## ⌨️ Controles y Atajos

### Atajos Globales (en cualquier parte del sistema)
| Atajo | Acción |
| :--- | :--- |
| `Ctrl + Alt + X` | Abrir / Ocultar overlay en **Modo Normal** |
| `Ctrl + Alt + Z` | Abrir / Ocultar overlay en **Modo Sticky** (para insertar varios emojis) |

### Controles en el Overlay
| Tecla / Acción | Comportamiento |
| :--- | :--- |
| **Clic izquierdo** | Inserta el emoji pulsado directamente en el campo de texto activo |
| `Enter` | Inserta el emoji seleccionado actualmente |
| `↑` / `↓` | Moverse por la lista de resultados |
| `→` / `←` | Desplegar o contraer variantes de tono de piel |
| `Esc` | Ocultar la ventana y devolver el foco |
| Botón `↻` | Recargar y recompilar la base de datos de emojis |
| Botón `×` | Cerrar la aplicación por completo |

---

## 📁 Estructura del Proyecto

```text
cli-emoji/
├── bin/
│   └── inserter.exe         # Binario nativo C# ultrarrápido (foco de ventana + SendInput)
├── data/
│   ├── emojis.txt           # Base editable: emoji:keyword1,keyword2,...
│   ├── emojis.cache.json    # Catálogo precompilado e índice invertido para arranque en 1ms
│   └── missing.txt          # Salida auxiliar de emojis faltantes de Unicode
├── docs/
│   ├── APP-CONTEXT.md       # Contexto técnico de la arquitectura
│   └── PLAN-MIGRACION-OPTIMIZACION.md # Análisis de cuellos de botella y rendimiento
├── scripts/
│   ├── build-data.js        # Compilador de caché e índice invertido
│   ├── update_emojis.js     # Fusiona mejoras de scripts/mejoras.txt y auto-recompila
│   ├── fill-all-variants.js # Descarga variantes oficiales desde unicode.org y auto-recompila
│   └── fill-restante.js     # Detecta emojis faltantes respecto al estándar Unicode
├── src/
│   ├── cli/index.js         # Interfaz interactiva de terminal
│   ├── logic/
│   │   ├── data.js          # Cargador con fallback y auto-regeneración
│   │   └── search.js        # Motor de búsqueda optimizado con caché LRU
│   ├── main/main.js         # Proceso principal de Electron (hotkeys, foco, IPC)
│   ├── native/inserter.cs   # Código fuente del insertador Win32 nativo
│   ├── preload/preload.js   # Context bridge seguro
│   └── renderer/            # Frontend (HTML, CSS glassmorphism, JS)
├── start.bat                # Lanzador batch optimizado
├── start.ps1                # Lanzador PowerShell directo sin intermediarios
└── start-fast.vbs           # Lanzador 100% invisible para el inicio de Windows
```

---

## 🔧 Mantenimiento de la Base de Emojis

1. **Añadir o editar palabras clave:**
   - Puedes editar directamente `data/emojis.txt` o añadir términos en `scripts/mejoras.txt`.
   - Si usas `mejoras.txt`, ejecuta:
     ```bash
     npm run update-emojis
     ```
     *(El script actualizará `emojis.txt` y recompilará automáticamente `emojis.cache.json`).*

2. **Recompilar la caché manualmente:**
   ```bash
   npm run build:data
   ```

3. **Completar catálogo con el estándar Unicode:**
   ```bash
   node scripts/fill-all-variants.js
   ```

---

## 💡 Cómo Funciona la Inserción de Foco

1. Cuando pulsas `Ctrl + Alt + X`, la aplicación captura de forma asíncrona el manejador nativo (`HWND`) de la ventana y pestaña donde estabas escribiendo.
2. Al hacer clic en un emoji o presionar `Enter`:
   - Electron oculta su ventana.
   - `bin/inserter.exe` invoca `AttachThreadInput` y `SetForegroundWindow` para devolver el foco exactamente al control de entrada anterior.
   - Envía los caracteres Unicode mediante `SendInput`, logrando una inserción limpia en milisegundos sin depender de portapapeles ni PowerShell.

---

## Licencia

ISC
