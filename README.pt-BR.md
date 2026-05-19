# 🍅 Pomofocus × Todoist

> Um userscript que traz suas tarefas do Todoist direto para o [Pomofocus](https://pomofocus.io/app).

**Outros idiomas:** [🇺🇸 English](./README.md) · [🇪🇸 Español](./README.es.md)

---

## TL;DR

1. Instale o [Violentmonkey](https://violentmonkey.github.io) (ou Tampermonkey)
2. Cole o script [`pomofocus-todoist.user.js`](./pomofocus-todoist.user.js) em um novo script
3. Substitua `YOUR_TODOIST_API_TOKEN_HERE` pelo seu token do Todoist
4. Abra [pomofocus.io/app](https://pomofocus.io/app) → clique no botão 🔴 **Todoist**

---

## Funcionalidades

| Ação | Descrição |
|---|---|
| **Importar** | Adiciona a tarefa ao Pomofocus com cálculo automático de pomodoros |
| **✓ Concluir** | Marca a tarefa como concluída no Todoist |
| **🗑 Excluir** | Exclui permanentemente do Todoist *(exige confirmação)* |
| **Prioridade** | Altere P1–P4 diretamente na lista |
| **Etiquetas** | Ative/desative etiquetas inline |
| **Projeto** | Mova para outro projeto inline |
| **Filtros** | Busca, prioridade, projeto e 📅 Hoje & Atrasadas |

### Cálculo Automático de Pomodoros

Se uma tarefa no Todoist tiver **duração** definida (ex: 90 min), o script divide pela duração atual do pomodoro (lida do Pomofocus) e arredonda para cima.

```
90 min ÷ 25 min = 🍅 × 4
```

Tarefas sem duração recebem **1 pomodoro** por padrão.

---

## Instalação

### Desktop (Chrome, Firefox, Edge)

#### 1. Instale a extensão

| Extensão | Chrome | Firefox |
|---|---|---|
| Violentmonkey *(recomendado)* | [Chrome Web Store](https://chrome.google.com/webstore/detail/violentmonkey/jinjaccalgkegedbjlphkgodlihkgiej) | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/violentmonkey/) |
| Tampermonkey | [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/) |

#### 2. Instale o script

1. Copie o conteúdo de [`pomofocus-todoist.user.js`](./pomofocus-todoist.user.js)
2. Abra o Violentmonkey → **Dashboard** → **+** (Novo script)
3. Cole e salve (`Ctrl+S`)

#### 3. Configure o token da API

No editor do script, encontre a linha:
```js
const API_KEY = 'YOUR_TODOIST_API_TOKEN_HERE';
```
Substitua pelo seu token:
> **Todoist** → Configurações → Integrações → Desenvolvedor → **Token da API** → Copiar

---

### Android (Kiwi Browser + Violentmonkey)

> O Kiwi Browser suporta extensões do Chrome no Android, incluindo o Violentmonkey.

1. Instale o [Kiwi Browser](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser) pelo Google Play
2. Abra o Kiwi → menu (⋮) → **Extensões** → **+ (da loja)**
3. Pesquise **Violentmonkey** → Instalar
4. Siga os passos 2–3 da seção Desktop acima

---

## Como obter o Token da API do Todoist

1. Acesse [todoist.com](https://todoist.com)
2. Clique no seu avatar → **Configurações**
3. Vá em **Integrações** → **Desenvolvedor**
4. Copie o **Token da API**

> ⚠️ **Nunca compartilhe seu token.** Ele dá acesso total à sua conta do Todoist.

---

## Licença

MIT — use como quiser.
