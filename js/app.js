/* ============================================================
   APP — owns the two pieces of global state (HOUSEHOLD, the editable
   model; DERIVED, everything computed from it), wires up events, and
   handles load/save. Every edit calls onHouseholdChange(), which
   recomputes and re-renders everything — same "recompute everything,
   re-render everything" approach as budgetr's DATA/BUDGETS_RAW.
   ============================================================ */

let HOUSEHOLD = defaultHousehold();
let DERIVED = computeAll(HOUSEHOLD);

function recomputeDerived() {
  DERIVED = computeAll(HOUSEHOLD);
}

// Inputs are rebuilt from scratch on every render, which would normally
// steal focus/cursor position on every keystroke — this snapshots which
// input had focus (by its stable id) and restores it afterward.
function withFocusPreserved(fn) {
  const active = document.activeElement;
  const id = active && active.id;
  const selStart = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
  const selEnd = active && typeof active.selectionEnd === 'number' ? active.selectionEnd : null;
  fn();
  if (id) {
    const restored = document.getElementById(id);
    if (restored) {
      restored.focus();
      if (selStart != null && restored.setSelectionRange) {
        try { restored.setSelectionRange(selStart, selEnd); } catch (e) { /* not a text-selectable input */ }
      }
    }
  }
}

function onHouseholdChange() {
  withFocusPreserved(() => {
    recomputeDerived();
    renderAll();
  });
}

/* ---------- Load / save JSON (same pattern as budgetr's budget files) ---------- */
function setStatus(msg, kind) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg || '';
  el.className = 'status-msg' + (kind ? ' status-' + kind : '');
}

function timestampedFileName() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `taxr-${d.getFullYear()}-${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}

function downloadHouseholdJSON() {
  const blob = new Blob([JSON.stringify(HOUSEHOLD, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = timestampedFileName();
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  setStatus('Saved ' + a.download, 'ok');
}

async function onLoadPickerChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    HOUSEHOLD = migrateHousehold(JSON.parse(text));
    setStatus('Loaded ' + file.name, 'ok');
    recomputeDerived();
    renderAll();
  } catch (err) {
    setStatus('Could not load file: ' + err.message, 'err');
  } finally {
    e.target.value = '';
  }
}

function resetHousehold() {
  if (!confirm('Discard all entered data and start over?')) return;
  HOUSEHOLD = defaultHousehold();
  setStatus('');
  recomputeDerived();
  renderAll();
}

function init() {
  document.getElementById('loadPicker').addEventListener('change', onLoadPickerChange);
  document.getElementById('saveBtn').addEventListener('click', downloadHouseholdJSON);
  document.getElementById('resetBtn').addEventListener('click', resetHousehold);
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
