# 🍅 Pomofocus × Todoist

> Un userscript que lleva tus tareas de Todoist directamente a [Pomofocus](https://pomofocus.io/app).

**Otros idiomas:** [🇺🇸 English](./README.md) · [🇧🇷 Português](./README.pt-BR.md)

---

## TL;DR

1. Instala [Violentmonkey](https://violentmonkey.github.io) (o Tampermonkey)
2. Pega el script [`pomofocus-todoist.user.js`](./pomofocus-todoist.user.js) en un nuevo script
3. Reemplaza `YOUR_TODOIST_API_TOKEN_HERE` con tu token de Todoist
4. Abre [pomofocus.io/app](https://pomofocus.io/app) → haz clic en el botón 🔴 **Todoist**

---

## Funcionalidades

| Acción | Descripción |
|---|---|
| **Importar** | Agrega la tarea a Pomofocus con cálculo automático de pomodoros |
| **✓ Completar** | Marca la tarea como completada en Todoist |
| **🗑 Eliminar** | Elimina permanentemente de Todoist *(requiere confirmación)* |
| **Prioridad** | Cambia P1–P4 directamente en la lista |
| **Etiquetas** | Activa/desactiva etiquetas inline |
| **Proyecto** | Mueve a otro proyecto inline |
| **Filtros** | Búsqueda, prioridad, proyecto y 📅 Hoy & Vencidas |

### Cálculo Automático de Pomodoros

Si una tarea en Todoist tiene **duración** definida (ej: 90 min), el script la divide por la duración actual del pomodoro (leída de Pomofocus) y redondea hacia arriba.

```
90 min ÷ 25 min = 🍅 × 4
```

Las tareas sin duración usan **1 pomodoro** por defecto.

---

## Instalación

### Escritorio (Chrome, Firefox, Edge)

#### 1. Instala la extensión

| Extensión | Chrome | Firefox |
|---|---|---|
| Violentmonkey *(recomendado)* | [Chrome Web Store](https://chrome.google.com/webstore/detail/violentmonkey/jinjaccalgkegedbjlphkgodlihkgiej) | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/violentmonkey/) |
| Tampermonkey | [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/) |

#### 2. Instala el script

1. Copia el contenido de [`pomofocus-todoist.user.js`](./pomofocus-todoist.user.js)
2. Abre Violentmonkey → **Dashboard** → **+** (Nuevo script)
3. Pega y guarda (`Ctrl+S`)

#### 3. Configura el token de API

En el editor del script, encuentra la línea:
```js
const API_KEY = 'YOUR_TODOIST_API_TOKEN_HERE';
```
Reemplázala con tu token:
> **Todoist** → Configuración → Integraciones → Desarrollador → **Token de API** → Copiar

---

### Android (Kiwi Browser + Violentmonkey)

> Kiwi Browser soporta extensiones de Chrome en Android, incluyendo Violentmonkey.

1. Instala [Kiwi Browser](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser) desde Google Play
2. Abre Kiwi → menú (⋮) → **Extensiones** → **+ (de la tienda)**
3. Busca **Violentmonkey** → Instalar
4. Sigue los pasos 2–3 de la sección de Escritorio

---

## Cómo obtener el Token de API de Todoist

1. Entra a [todoist.com](https://todoist.com)
2. Haz clic en tu avatar → **Configuración**
3. Ve a **Integraciones** → **Desarrollador**
4. Copia el **Token de API**

> ⚠️ **Nunca compartas tu token.** Da acceso completo a tu cuenta de Todoist.

---

## Licencia

MIT — úsalo como quieras.
