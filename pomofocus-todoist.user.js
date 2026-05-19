// ==UserScript==
// @name         Pomofocus × Todoist
// @namespace    https://pomofocus.io
// @version      1.0.0
// @description  Import and manage Todoist tasks directly in Pomofocus. Supports import (with auto pomodoro calculation from task duration), complete, delete, priority, labels, and project changes.
// @author       JuninhoFreitas
// @match        https://pomofocus.io/*
// @grant        GM_xmlhttpRequest
// @connect      api.todoist.com
// @run-at       document-idle
// ==/UserScript==

/**
 * SETUP
 * 1. Install Violentmonkey (or Tampermonkey) — see README for links
 * 2. Create a new script and paste this file
 * 3. Replace YOUR_TODOIST_API_TOKEN_HERE with your token:
 *    Todoist → Settings → Integrations → Developer → API token
 * 4. Save. Visit https://pomofocus.io/app — a red "🔴 Todoist" button appears in the header.
 *
 * POMODORO CALCULATION
 * If a Todoist task has a duration set (e.g. 90 minutes), the script divides it
 * by the current Pomofocus pomodoro length (read from settings, default 25 min)
 * and rounds up. Tasks without a duration default to 1 pomodoro.
 *
 * ACTIONS
 * Import   → Adds task to Pomofocus with calculated pomodoro count
 * ✓ Done   → Marks task complete in Todoist and removes it from the list
 * 🗑 Delete → Permanently deletes task from Todoist (requires confirmation)
 * ▸ Edit   → Expand to change priority / labels / project inline
 */

(function () {
  'use strict';

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  // Replace with your Todoist API token:
  // Todoist → Settings → Integrations → Developer → API token
  const API_KEY = 'YOUR_TODOIST_API_TOKEN_HERE';
  const BASE    = 'https://api.todoist.com/api/v1'; // REST v2 is deprecated

  // ─── PRIORITY MAP (Todoist: 4=P1 urgent … 1=P4 normal) ────────────────────
  const PRIORITY = {
    4: { label: 'P1', color: '#db4035' },
    3: { label: 'P2', color: '#ff9933' },
    2: { label: 'P3', color: '#4073ff' },
    1: { label: 'P4', color: '#808080' },
  };

  // ─── API ───────────────────────────────────────────────────────────────────
  function api(method, path, data) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url: BASE + path,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        data: data ? JSON.stringify(data) : undefined,
        onload(r) {
          if (r.status >= 200 && r.status < 300) {
            if (!r.responseText) { resolve(null); return; }
            const parsed = JSON.parse(r.responseText);
            // API v1 wraps lists in {results: [...], next_cursor: ...}
            resolve(parsed && typeof parsed === 'object' && Array.isArray(parsed.results)
              ? parsed.results
              : parsed);
          } else {
            reject(new Error(`HTTP ${r.status}: ${r.responseText}`));
          }
        },
        onerror: (e) => reject(new Error('Network error: ' + JSON.stringify(e))),
      });
    });
  }

  // Fetches all pages for paginated list endpoints
  async function fetchAll(path) {
    const results = [];
    let cursor = null;
    do {
      const url = cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
      const raw = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET', url: BASE + url,
          headers: { Authorization: `Bearer ${API_KEY}` },
          onload(r) {
            if (r.status >= 200 && r.status < 300) resolve(JSON.parse(r.responseText));
            else reject(new Error(`HTTP ${r.status}`));
          },
          onerror: reject,
        });
      });
      results.push(...(raw.results || []));
      cursor = raw.next_cursor || null;
    } while (cursor);
    return results;
  }

  const fetchTasks    = ()         => fetchAll('/tasks');
  const fetchProjects = ()         => fetchAll('/projects');
  const fetchLabels   = ()         => fetchAll('/labels');
  const completeTask  = (id)       => api('POST',   `/tasks/${id}/close`);
  const deleteTask    = (id)       => api('DELETE', `/tasks/${id}`);
  const updateTask    = (id, data) => api('POST',   `/tasks/${id}`, data);

  // ─── POMOFOCUS INTEGRATION ─────────────────────────────────────────────────

  /** Reads the current pomodoro session length from the Pomofocus settings inputs. */
  function getPomoMinutes() {
    // Pomofocus renders timer setting inputs in the DOM even when settings panel is closed.
    // They are number inputs with min=0 and step=1. The first valid value (1–90) is the
    // pomodoro duration.
    const inputs = document.querySelectorAll('input[type="number"][min="0"][step="1"]');
    for (const inp of inputs) {
      const v = parseInt(inp.value, 10);
      if (v >= 1 && v <= 90) return v;
    }
    return 25; // fallback
  }

  /**
   * Returns the estimated number of pomodoro sessions for a task.
   * Uses task.duration if set; otherwise returns 1.
   */
  function calcPomodoros(task) {
    if (!task.duration) return 1;
    const pomoMin = getPomoMinutes();
    const taskMin = task.duration.unit === 'minute'
      ? task.duration.amount
      : task.duration.amount * 60 * 24; // 'day' unit
    return Math.max(1, Math.ceil(taskMin / pomoMin));
  }

  /**
   * Programmatically adds a task to Pomofocus by simulating user interaction
   * with the task form. Uses React's native input value setter to trigger
   * onChange handlers.
   */
  async function addToPomofocus(title, estPomos) {
    // If the task form is not open, open it
    let titleEl = document.getElementById('input_activity_title');
    if (!titleEl) {
      const addBtn = document.querySelector('[title*="create a new task"]');
      if (!addBtn) throw new Error('Add Task button not found in DOM');
      addBtn.click();
      await sleep(200);
      titleEl = document.getElementById('input_activity_title');
    }
    if (!titleEl) throw new Error('Task title input not found after opening form');

    const pomosEl = document.getElementById('input_est_pomodoro');

    // Use React's internal native setter to trigger React's onChange
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

    nativeSetter.call(titleEl, title);
    titleEl.dispatchEvent(new Event('input', { bubbles: true }));

    if (pomosEl) {
      nativeSetter.call(pomosEl, String(estPomos));
      pomosEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await sleep(80);

    // Walk up from the title input to find the Save button scoped to the task form,
    // avoiding any "Save" buttons in other panels (e.g. settings).
    let saveBtn = null;
    let container = titleEl.parentElement;
    while (container && !saveBtn) {
      const candidates = Array.from(container.querySelectorAll('button'));
      saveBtn = candidates.find((b) => b.textContent.trim() === 'Save');
      container = container.parentElement;
    }
    if (!saveBtn) throw new Error('Save button not found in task form');
    saveBtn.click();
  }

  // ─── DOM HELPERS ───────────────────────────────────────────────────────────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Minimal element factory: el('div', {style: {color:'red'}, onclick: fn}, 'text') */
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function styledBtn(text, bg, onclick) {
    return el('button', {
      style: {
        background: bg, color: '#fff', border: 'none', borderRadius: '6px',
        padding: '4px 10px', cursor: 'pointer', fontSize: '12px',
        fontWeight: '600', whiteSpace: 'nowrap', transition: 'opacity 0.15s',
      },
      onclick,
    }, text);
  }

  // ─── MODAL STATE ───────────────────────────────────────────────────────────
  let modal       = null;
  let allTasks    = [];
  let allProjects = [];
  let allLabels   = [];
  let filterText  = '';
  let filterPrio  = 0;
  let filterProj  = '';
  let filterDue   = false;

  // ─── MODAL ─────────────────────────────────────────────────────────────────
  function openModal() {
    if (modal) { modal.remove(); modal = null; }
    filterText = ''; filterPrio = 0; filterProj = ''; filterDue = false;

    modal = el('div', {
      id: 'ptd-overlay',
      style: {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: '99999', fontFamily: 'Arial, sans-serif',
      },
      onclick(e) { if (e.target === modal) closeModal(); },
    });

    const dialog = el('div', {
      style: {
        background: '#2c2e33', color: '#fff', borderRadius: '12px',
        width: '700px', maxWidth: '96vw', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      },
    });

    // Header
    const header = el('div', {
      style: {
        padding: '16px 20px', borderBottom: '1px solid #3a3c42',
        display: 'flex', alignItems: 'center', gap: '10px',
      },
    });
    header.appendChild(el('span', { style: { fontSize: '17px', fontWeight: '700', flex: '1' } }, '🔴 Todoist Tasks'));
    const closeX = el('button', {
      style: { background: 'none', border: 'none', color: '#aaa', fontSize: '22px', cursor: 'pointer', lineHeight: '1' },
      onclick: closeModal,
    }, '×');
    header.appendChild(closeX);

    // Filters
    const filters = el('div', {
      style: {
        padding: '10px 20px', borderBottom: '1px solid #3a3c42',
        display: 'flex', gap: '8px', flexWrap: 'wrap',
      },
    });

    const searchInp = el('input', {
      type: 'text', placeholder: '🔍 Search tasks…',
      style: {
        flex: '1', minWidth: '140px', background: '#3a3c42', border: 'none',
        borderRadius: '6px', padding: '6px 10px', color: '#fff', outline: 'none',
      },
      oninput(e) { filterText = e.target.value.toLowerCase(); renderList(); },
    });
    filters.appendChild(searchInp);

    const prioSel = el('select', {
      style: { background: '#3a3c42', border: 'none', borderRadius: '6px', padding: '6px 8px', color: '#fff', cursor: 'pointer' },
      onchange(e) { filterPrio = parseInt(e.target.value, 10); renderList(); },
    });
    [['All priorities', 0], ['P1 urgent', 4], ['P2 high', 3], ['P3 medium', 2], ['P4 normal', 1]].forEach(([t, v]) =>
      prioSel.appendChild(el('option', { value: String(v) }, t))
    );
    filters.appendChild(prioSel);

    const projSel = el('select', {
      id: 'ptd-proj-filter',
      style: { background: '#3a3c42', border: 'none', borderRadius: '6px', padding: '6px 8px', color: '#fff', cursor: 'pointer' },
      onchange(e) { filterProj = e.target.value; renderList(); },
    });
    projSel.appendChild(el('option', { value: '' }, 'All projects'));
    filters.appendChild(projSel);

    // Today & Overdue toggle
    const dueBtn = el('button', {
      id: 'ptd-due-btn',
      title: 'Show only tasks due today or overdue',
      style: {
        background: '#3a3c42', color: '#aaa', border: '1px solid #555',
        borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
        fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap',
      },
      onclick() {
        filterDue = !filterDue;
        dueBtn.style.background = filterDue ? '#ba4949' : '#3a3c42';
        dueBtn.style.color      = filterDue ? '#fff'    : '#aaa';
        dueBtn.style.border     = filterDue ? '1px solid #ba4949' : '1px solid #555';
        renderList();
      },
    }, '📅 Today & Overdue');
    filters.appendChild(dueBtn);

    // Task list
    const listEl = el('div', {
      id: 'ptd-task-list',
      style: { flex: '1', overflowY: 'auto', padding: '10px 20px' },
    });

    // Footer
    const footer = el('div', {
      id: 'ptd-footer',
      style: {
        padding: '10px 20px', borderTop: '1px solid #3a3c42',
        color: '#888', fontSize: '12px',
      },
    }, 'Loading…');

    dialog.appendChild(header);
    dialog.appendChild(filters);
    dialog.appendChild(listEl);
    dialog.appendChild(footer);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    loadData();
  }

  async function loadData() {
    setFooter('Loading…');
    try {
      [allTasks, allProjects, allLabels] = await Promise.all([
        fetchTasks(), fetchProjects(), fetchLabels(),
      ]);

      const projSel = document.getElementById('ptd-proj-filter');
      if (projSel) {
        allProjects.forEach((p) =>
          projSel.appendChild(el('option', { value: p.id }, p.name))
        );
      }

      renderList();
    } catch (e) {
      setFooter('Error: ' + e.message);
      const listEl = document.getElementById('ptd-task-list');
      if (listEl) {
        const errDiv = document.createElement('div');
        errDiv.style.cssText = 'color:#f87171;padding:20px';
        errDiv.textContent = 'Failed to load tasks: ' + e.message;
        listEl.appendChild(errDiv);
      }
    }
  }

  function renderList() {
    const listEl = document.getElementById('ptd-task-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const today = new Date().toISOString().split('T')[0];
    const visible = allTasks.filter((t) => {
      if (filterText && !t.content.toLowerCase().includes(filterText)) return false;
      if (filterPrio && t.priority !== filterPrio) return false;
      if (filterProj && t.project_id !== filterProj) return false;
      if (filterDue) {
        const dueDate = t.due ? (t.due.date || '').split('T')[0] : null;
        if (!dueDate || dueDate > today) return false;
      }
      return true;
    });

    if (!visible.length) {
      listEl.appendChild(el('div', {
        style: { color: '#888', textAlign: 'center', padding: '40px 20px' },
      }, 'No tasks found.'));
    } else {
      visible.forEach((task) => listEl.appendChild(buildCard(task)));
    }

    setFooter(`${visible.length} task${visible.length !== 1 ? 's' : ''} · Pomo = ${getPomoMinutes()} min`);
  }

  function buildCard(task) {
    const project = allProjects.find((p) => p.id === task.project_id);
    const labels  = (task.labels || []);
    const pomos   = calcPomodoros(task);
    const prio    = PRIORITY[task.priority] || PRIORITY[1];

    const card = el('div', {
      'data-task-id': task.id,
      style: {
        background: '#3a3c42', borderRadius: '8px', padding: '10px 14px',
        marginBottom: '8px', borderLeft: `3px solid ${prio.color}`,
      },
    });

    // ── Top row: title + action buttons ────────────────────────────────────
    const topRow = el('div', {
      style: { display: 'flex', alignItems: 'flex-start', gap: '8px' },
    });

    // Title + meta
    const titleCol = el('div', { style: { flex: '1', minWidth: '0' } });
    titleCol.appendChild(el('div', {
      style: {
        fontWeight: '600', fontSize: '14px', marginBottom: '5px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      },
      title: task.content,
    }, task.content));

    // Meta chips
    const meta = el('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' } });

    // Priority chip
    meta.appendChild(el('span', {
      style: {
        background: prio.color + '33', color: prio.color,
        border: `1px solid ${prio.color}66`, borderRadius: '4px',
        padding: '1px 5px', fontSize: '11px', fontWeight: '700',
      },
    }, prio.label));

    // Project chip
    if (project) {
      meta.appendChild(chip('📁 ' + project.name));
    }

    // Label chips
    labels.forEach((l) => meta.appendChild(chip('🏷 ' + l)));

    // Duration + pomodoros
    if (task.duration) {
      const d = task.duration.unit === 'minute'
        ? `${task.duration.amount}m`
        : `${task.duration.amount}d`;
      meta.appendChild(chip(`⏱ ${d} → 🍅 ×${pomos}`));
    } else {
      meta.appendChild(el('span', { style: { color: '#888', fontSize: '11px' } }, `🍅 ×${pomos}`));
    }

    // Due date (API v1: due.date may be "2026-05-19T07:30:00" or "2026-05-19")
    if (task.due) {
      const dateStr = (task.due.date || '').split('T')[0];
      const today   = new Date().toISOString().split('T')[0];
      const overdue = dateStr && dateStr < today;
      const display = task.due.is_recurring ? `🔁 ${dateStr}` : `📅 ${dateStr}`;
      meta.appendChild(el('span', {
        style: { color: overdue ? '#f87171' : '#888', fontSize: '11px' },
      }, display));
    }

    titleCol.appendChild(meta);
    topRow.appendChild(titleCol);

    // Action buttons
    const actions = el('div', { style: { display: 'flex', gap: '4px', flexShrink: '0', alignItems: 'flex-start' } });

    // Import button
    const importBtn = styledBtn('Import', '#ba4949', async () => {
      importBtn.textContent = '…';
      importBtn.disabled = true;
      try {
        await addToPomofocus(task.content, pomos);
        importBtn.textContent = '✓ Imported';
        importBtn.style.background = '#4caf50';
      } catch (e) {
        importBtn.textContent = '✗ Error';
        importBtn.style.background = '#f44336';
        importBtn.title = e.message;
        console.error('[PTD] Import error:', e);
        setTimeout(() => {
          importBtn.textContent = 'Import';
          importBtn.style.background = '#ba4949';
          importBtn.disabled = false;
        }, 2500);
      }
    });
    actions.appendChild(importBtn);

    // Complete in Todoist
    const doneBtn = styledBtn('✓ Done', '#45474b', async () => {
      if (!confirm(`Mark "${task.content}" as complete in Todoist?`)) return;
      doneBtn.disabled = true; doneBtn.textContent = '…';
      try {
        await completeTask(task.id);
        allTasks = allTasks.filter((t) => t.id !== task.id);
        renderList();
      } catch (e) {
        doneBtn.textContent = '✗'; doneBtn.title = e.message;
        setTimeout(() => { doneBtn.textContent = '✓ Done'; doneBtn.disabled = false; }, 2000);
      }
    });
    actions.appendChild(doneBtn);

    // Delete from Todoist
    const delBtn = styledBtn('🗑', '#5a3030', async () => {
      if (!confirm(`⚠️ Permanently DELETE "${task.content}" from Todoist?\n\nThis cannot be undone.`)) return;
      delBtn.disabled = true; delBtn.textContent = '…';
      try {
        await deleteTask(task.id);
        allTasks = allTasks.filter((t) => t.id !== task.id);
        renderList();
      } catch (e) {
        delBtn.textContent = '✗'; delBtn.title = e.message;
        setTimeout(() => { delBtn.textContent = '🗑'; delBtn.disabled = false; }, 2000);
      }
    });
    actions.appendChild(delBtn);

    topRow.appendChild(actions);
    card.appendChild(topRow);

    // ── Expandable edit section ─────────────────────────────────────────────
    const editToggle = el('div', {
      style: { marginTop: '6px', cursor: 'pointer', color: '#888', fontSize: '11px', userSelect: 'none' },
    }, '▸ Edit priority / labels / project');

    const editSection = el('div', {
      style: {
        display: 'none', marginTop: '8px', paddingTop: '8px',
        borderTop: '1px solid #4a4c52',
      },
    });

    editToggle.addEventListener('click', () => {
      const open = editSection.style.display === 'block';
      editSection.style.display = open ? 'none' : 'block';
      editToggle.textContent = (open ? '▸' : '▾') + ' Edit priority / labels / project';
    });

    // Priority selector
    const prioRow = el('div', {
      style: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' },
    });
    prioRow.appendChild(label('Priority:'));
    [4, 3, 2, 1].forEach((p) => {
      const pp = PRIORITY[p];
      const active = task.priority === p;
      const b = el('button', {
        style: {
          background: active ? pp.color : '#4a4c52',
          color: active ? '#fff' : '#aaa',
          border: `1px solid ${active ? pp.color : '#666'}`,
          borderRadius: '4px', padding: '2px 8px',
          cursor: 'pointer', fontSize: '12px', fontWeight: active ? '700' : '400',
        },
        async onclick() {
          try {
            await updateTask(task.id, { priority: p });
            task.priority = p;
            card.replaceWith(buildCard(task));
          } catch (e) { alert('Update failed: ' + e.message); }
        },
      }, pp.label);
      prioRow.appendChild(b);
    });
    editSection.appendChild(prioRow);

    // Labels selector (toggle chips)
    if (allLabels.length) {
      const labRow = el('div', {
        style: { display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' },
      });
      labRow.appendChild(label('Labels:'));
      allLabels.forEach((l) => {
        const active = labels.includes(l.name);
        const c = el('button', {
          style: {
            background: active ? '#5a6a8a' : '#3a3c42',
            color: active ? '#fff' : '#aaa',
            border: `1px solid ${active ? '#7a9ac0' : '#555'}`,
            borderRadius: '10px', padding: '2px 8px',
            cursor: 'pointer', fontSize: '11px',
          },
          async onclick() {
            const updated = active
              ? labels.filter((x) => x !== l.name)
              : [...labels, l.name];
            try {
              await updateTask(task.id, { labels: updated });
              task.labels = updated;
              card.replaceWith(buildCard(task));
            } catch (e) { alert('Update failed: ' + e.message); }
          },
        }, l.name);
        labRow.appendChild(c);
      });
      editSection.appendChild(labRow);
    }

    // Project selector (dropdown)
    if (allProjects.length) {
      const projRow = el('div', {
        style: { display: 'flex', gap: '6px', alignItems: 'center' },
      });
      projRow.appendChild(label('Project:'));
      const drop = el('select', {
        style: {
          background: '#3a3c42', border: '1px solid #555',
          borderRadius: '6px', padding: '3px 7px', color: '#fff', fontSize: '12px',
        },
        async onchange(e) {
          try {
            await updateTask(task.id, { project_id: e.target.value });
            task.project_id = e.target.value;
            card.replaceWith(buildCard(task));
          } catch (err) { alert('Update failed: ' + err.message); }
        },
      });
      allProjects.forEach((p) => {
        const opt = el('option', { value: p.id }, p.name);
        if (p.id === task.project_id) opt.selected = true;
        drop.appendChild(opt);
      });
      projRow.appendChild(drop);
      editSection.appendChild(projRow);
    }

    card.appendChild(editToggle);
    card.appendChild(editSection);
    return card;
  }

  // ─── SMALL HELPERS ─────────────────────────────────────────────────────────
  function chip(text) {
    return el('span', {
      style: {
        background: '#4a4c52', borderRadius: '4px',
        padding: '1px 6px', fontSize: '11px', color: '#ccc',
      },
    }, text);
  }

  function label(text) {
    return el('span', { style: { fontSize: '12px', color: '#aaa', minWidth: '58px' } }, text);
  }

  function setFooter(text) {
    const f = document.getElementById('ptd-footer');
    if (f) f.textContent = text;
  }

  function closeModal() {
    if (modal) { modal.remove(); modal = null; }
  }

  // ─── INJECT HEADER BUTTON ──────────────────────────────────────────────────
  function injectButton() {
    if (document.getElementById('ptd-open-btn')) return;

    // Find the nav buttons container (sits next to Report + Setting buttons)
    const graphImg = document.querySelector('img[alt="graph icon"]');
    const container = graphImg?.closest('button')?.parentElement;
    if (!container) return;

    const btn = el('button', {
      id: 'ptd-open-btn',
      title: 'Open Todoist task importer',
      style: {
        background: '#db4035', color: '#fff', border: 'none',
        borderRadius: '8px', padding: '6px 12px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '700',
        display: 'inline-flex', alignItems: 'center', gap: '5px',
      },
      onclick: openModal,
    }, '🔴 Todoist');

    container.insertBefore(btn, container.firstChild);
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function tryInit() {
    injectButton();
  }

  // Wait for SPA to mount (Pomofocus renders asynchronously)
  setTimeout(tryInit, 1200);

  // Re-inject if SPA navigation removes the button
  let debounceTimer;
  new MutationObserver(() => {
    if (!document.getElementById('ptd-open-btn')) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(tryInit, 600);
    }
  }).observe(document.body, { childList: true, subtree: false });

})();
