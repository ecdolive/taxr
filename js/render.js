/* ============================================================
   RENDER — builds each panel's DOM from scratch from HOUSEHOLD/DERIVED
   (both live in app.js). Every edit triggers a full renderAll(); focus is
   restored afterward by id (see withFocusPreserved in app.js), so typing
   in an input doesn't visibly lose its place.
   ============================================================ */

function fmt(n) {
  if (n == null || isNaN(n)) n = 0;
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  });
  (children || []).forEach(c => node.appendChild(c));
  return node;
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}
function bindId(path) {
  return 'f_' + path.replace(/[.[\]]+/g, '_');
}

function numberInput(path, opts) {
  opts = opts || {};
  const input = el('input', { type: 'number', step: opts.step || '0.01', id: bindId(path) });
  const raw = getPath(HOUSEHOLD, path) || 0;
  input.value = round(opts.percent ? raw * 100 : raw, opts.percent ? 4 : 2);
  input.addEventListener('input', () => {
    const v = input.value === '' ? 0 : parseFloat(input.value);
    setPath(HOUSEHOLD, path, isNaN(v) ? 0 : (opts.percent ? v / 100 : v));
    onHouseholdChange();
  });
  return input;
}
function textInput(path) {
  const input = el('input', { type: 'text', id: bindId(path) });
  input.value = getPath(HOUSEHOLD, path) || '';
  input.addEventListener('input', () => { setPath(HOUSEHOLD, path, input.value); onHouseholdChange(); });
  return input;
}
function checkboxInput(path) {
  const input = el('input', { type: 'checkbox', id: bindId(path) });
  input.checked = !!getPath(HOUSEHOLD, path);
  input.addEventListener('change', () => { setPath(HOUSEHOLD, path, input.checked); onHouseholdChange(); });
  return input;
}
function selectInput(path, options) {
  const select = el('select', { id: bindId(path) });
  options.forEach(o => select.appendChild(el('option', { value: o.value, text: o.label })));
  select.value = getPath(HOUSEHOLD, path);
  select.addEventListener('change', () => { setPath(HOUSEHOLD, path, select.value); onHouseholdChange(); });
  return select;
}
function round(n, places) {
  const m = Math.pow(10, places);
  return Math.round((n + Number.EPSILON) * m) / m;
}

function field(labelText, inputEl) {
  return el('label', { className: 'field' }, [el('span', { className: 'field-label', text: labelText }), inputEl]);
}

/* ---------- Settings panel ---------- */
function renderSettings() {
  const panel = document.getElementById('settingsPanel');
  panel.innerHTML = '';
  panel.appendChild(el('h2', { text: 'Household' }));
  const row = el('div', { className: 'settings-row' });

  row.appendChild(field('Tax year', selectInput('taxYear', Object.keys(TAX_YEARS).map(y => ({ value: y, label: y })))));
  row.appendChild(field('Filing status', selectInput('filingStatus', FILING_STATUSES)));
  row.appendChild(field('State', selectInput('state', Object.keys(STATES).map(code => ({ value: code, label: STATES[code].label })))));
  row.appendChild(field('Qualifying children', numberInput('dependents.qualifyingChildren', { step: 1 })));
  row.appendChild(field('Other dependents', numberInput('dependents.otherDependents', { step: 1 })));

  panel.appendChild(row);
}

/* ---------- Filer income panels ---------- */
function row3(label, ytdEl, remainingEl, annualValue) {
  return el('tr', {}, [
    el('th', { text: label }),
    el('td', {}, ytdEl ? [ytdEl] : []),
    el('td', {}, remainingEl ? [remainingEl] : []),
    el('td', { className: 'computed', text: fmt(annualValue) }),
  ]);
}
function rowComputed(label, ytdValue, annualValue) {
  return el('tr', { className: 'computed-row' }, [
    el('th', { text: label }),
    el('td', { className: 'computed', text: fmt(ytdValue) }),
    el('td', {}, []),
    el('td', { className: 'computed', text: fmt(annualValue) }),
  ]);
}

function deductionRow(filer, idx, dIdx, rollupRow) {
  const path = `filers.${idx}.deductions.${dIdx}`;
  const d = filer.deductions[dIdx];
  const remainingInput = d.type === 'percentOfGross'
    ? numberInput(path + '.remainingValue', { percent: true, step: '0.01' })
    : numberInput(path + '.remainingValue', { step: '0.01' });

  const removeBtn = el('button', { className: 'icon-btn', title: 'Remove', text: '✕' });
  removeBtn.addEventListener('click', () => { filer.deductions.splice(dIdx, 1); onHouseholdChange(); });

  const tr = el('tr', { className: 'deduction-row' }, [
    el('td', {}, [textInput(path + '.label')]),
    el('td', {}, [selectInput(path + '.type', [{ value: 'flatPerPeriod', label: '$ / period' }, { value: 'percentOfGross', label: '% of gross' }])]),
    el('td', {}, [numberInput(path + '.ytdAmount')]),
    el('td', {}, [remainingInput]),
    el('td', { className: 'basis-cell' }, [checkboxInput(path + '.reducesFederalTaxable')]),
    el('td', { className: 'basis-cell' }, [checkboxInput(path + '.reducesFicaTaxable')]),
    el('td', { className: 'basis-cell' }, [checkboxInput(path + '.reducesStateTaxable')]),
    el('td', { className: 'computed', text: fmt(rollupRow.annualAmount) }),
    el('td', {}, [removeBtn]),
  ]);
  return tr;
}

function renderFilerCard(filer, idx, rollup) {
  const card = el('div', { className: 'card filer-card' });
  const header = el('div', { className: 'card-header' });
  header.appendChild(textInput(`filers.${idx}.name`));
  if (HOUSEHOLD.filers.length > 1) {
    const removeBtn = el('button', { className: 'btn btn-secondary', text: 'Remove filer' });
    removeBtn.addEventListener('click', () => {
      if (!confirm(`Remove ${filer.name}?`)) return;
      HOUSEHOLD.filers.splice(idx, 1);
      onHouseholdChange();
    });
    header.appendChild(removeBtn);
  }
  card.appendChild(header);

  const table = el('table', { className: 'income-table' });
  table.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', { text: '' }), el('th', { text: 'YTD' }), el('th', { text: 'Per remaining period' }), el('th', { text: 'Annual' }),
  ])]));

  const body = el('tbody');
  body.appendChild(el('tr', { className: 'periods-row' }, [
    el('th', { text: 'Pay periods remaining' }),
    el('td', {}, []),
    el('td', {}, [numberInput(`filers.${idx}.payPeriodsRemaining`, { step: 1 })]),
    el('td', {}, []),
  ]));
  body.appendChild(row3('Gross pay',
    numberInput(`filers.${idx}.grossPayYTD`), numberInput(`filers.${idx}.grossPayPerPeriod`), rollup.grossPay.annual));
  body.appendChild(row3('Taxable benefits',
    numberInput(`filers.${idx}.taxableBenefitsYTD`), numberInput(`filers.${idx}.taxableBenefitsPerPeriod`), rollup.taxableBenefits.annual));
  table.appendChild(body);
  card.appendChild(table);

  // Deductions get their own table since each row needs extra columns
  // (type, which taxable-pay bases it reduces) that don't apply above.
  const dTable = el('table', { className: 'deductions-table' });
  dTable.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', { text: 'Deduction' }), el('th', { text: 'Type' }), el('th', { text: 'YTD' }), el('th', { text: 'Per period' }),
    el('th', { text: 'Fed' }), el('th', { text: 'FICA' }), el('th', { text: 'State' }), el('th', { text: 'Annual' }), el('th', { text: '' }),
  ])]));
  const dBody = el('tbody');
  filer.deductions.forEach((d, dIdx) => dBody.appendChild(deductionRow(filer, idx, dIdx, rollup.deductions[dIdx])));
  dTable.appendChild(dBody);
  card.appendChild(dTable);

  const addDeductionBtn = el('button', { className: 'btn btn-secondary btn-small', text: '+ Add deduction' });
  addDeductionBtn.addEventListener('click', () => {
    filer.deductions.push(defaultDeduction({ label: 'New deduction', type: 'flatPerPeriod', reducesFederalTaxable: true, reducesFicaTaxable: true, reducesStateTaxable: true }));
    onHouseholdChange();
  });
  card.appendChild(addDeductionBtn);

  // Taxable-pay bases and withholdings go back in the main income-shaped table.
  const table2 = el('table', { className: 'income-table' });
  const body2 = el('tbody');
  body2.appendChild(rowComputed('Federal-taxable pay', rollup.federalTaxablePay.ytd, rollup.federalTaxablePay.annual));
  body2.appendChild(rowComputed('FICA-taxable pay', rollup.ficaTaxablePay.ytd, rollup.ficaTaxablePay.annual));
  body2.appendChild(rowComputed('State-taxable pay', rollup.stateTaxablePay.ytd, rollup.stateTaxablePay.annual));

  const fedWhRemaining = el('div', { className: 'rate-plus-extra' }, [
    numberInput(`filers.${idx}.federalWithholdingRate`, { percent: true }), el('span', { text: '% +' }),
    numberInput(`filers.${idx}.federalWithholdingExtra`),
  ]);
  body2.appendChild(row3('Federal withholding', numberInput(`filers.${idx}.federalWithholdingYTD`), fedWhRemaining, rollup.federalWithholding.annual));

  body2.appendChild(row3('SS withholding', numberInput(`filers.${idx}.ssWithholdingYTD`),
    el('div', {}, [numberInput(`filers.${idx}.ssWithholdingRate`, { percent: true }), el('span', { text: '%' })]), rollup.ssWithholding.annual));

  body2.appendChild(rowComputed('Medicare withholding', rollup.medicareWithholding.ytd, rollup.medicareWithholding.annual));

  const stateWhRemaining = el('div', { className: 'rate-plus-extra' }, [
    numberInput(`filers.${idx}.stateWithholdingRate`, { percent: true }), el('span', { text: '% +' }),
    numberInput(`filers.${idx}.stateWithholdingExtra`),
  ]);
  body2.appendChild(row3('State withholding', numberInput(`filers.${idx}.stateWithholdingYTD`), stateWhRemaining, rollup.stateWithholding.annual));

  body2.appendChild(rowComputed('Net pay', rollup.netPay.ytd, rollup.netPay.annual));
  if (rollup.excessSSWithholding > 0) {
    body2.appendChild(el('tr', { className: 'note-row' }, [el('td', { colspan: 4, text: `Excess SS withholding credit: ${fmt(rollup.excessSSWithholding)}` })]));
  }
  table2.appendChild(body2);
  card.appendChild(table2);

  return card;
}

function renderFilers() {
  const panel = document.getElementById('filersPanel');
  panel.innerHTML = '';
  HOUSEHOLD.filers.forEach((filer, idx) => panel.appendChild(renderFilerCard(filer, idx, DERIVED.filerRollups[idx])));

  const addBtn = el('button', { className: 'btn btn-secondary', text: '+ Add filer' });
  addBtn.addEventListener('click', () => {
    HOUSEHOLD.filers.push(defaultFiler(`Filer ${HOUSEHOLD.filers.length + 1}`, HOUSEHOLD.taxYear));
    onHouseholdChange();
  });
  panel.appendChild(addBtn);
}

/* ---------- Federal tax panel ---------- */
function renderFederal() {
  const panel = document.getElementById('federalPanel');
  panel.innerHTML = '';
  panel.appendChild(el('h2', { text: 'Federal taxes' }));
  const f = DERIVED.federal;

  const table = el('table', { className: 'tax-table' });
  const body = el('tbody');

  body.appendChild(el('tr', {}, [el('th', { text: 'Annual federal-taxable pay' }), el('td', { className: 'computed', text: fmt(f.wagesAnnual) })]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Additional taxable income' }), el('td', {}, [numberInput('federal.additionalTaxableIncome')])]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Adjustments' }), el('td', {}, [numberInput('federal.adjustments')])]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Adjusted gross income (AGI)' }), el('td', { className: 'computed', text: fmt(f.agi) })]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Standard deduction' }), el('td', { className: 'computed', text: fmt(f.standardDeduction) })]));
  body.appendChild(el('tr', {}, [
    el('th', { text: 'Use itemized deduction instead' }),
    el('td', {}, [checkboxInput('federal.useItemized'), numberInput('federal.itemizedDeduction')]),
  ]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Taxable income' }), el('td', { className: 'computed', text: fmt(f.taxableIncome) })]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Tax (from bracket table)' }), el('td', { className: 'computed', text: fmt(f.bracketTax) })]));
  body.appendChild(el('tr', {}, [el('th', { text: `Child tax credit (${HOUSEHOLD.dependents.qualifyingChildren} children)` }), el('td', { className: 'computed', text: fmt(f.childTaxCredit) })]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Other credits' }), el('td', {}, [numberInput('federal.otherCredits')])]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Other taxes' }), el('td', {}, [numberInput('federal.otherTaxes')])]));
  body.appendChild(el('tr', { className: 'total-row' }, [el('th', { text: 'Total tax' }), el('td', { className: 'computed', text: fmt(f.totalTax) })]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Withholding (W-2)' }), el('td', { className: 'computed', text: fmt(f.withholding) })]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Withholding (1099)' }), el('td', {}, [numberInput('federal.withholdingFrom1099')])]));
  if (f.excessSSWithholding > 0) {
    body.appendChild(el('tr', {}, [el('th', { text: 'Excess SS withholding credit' }), el('td', { className: 'computed', text: fmt(f.excessSSWithholding) })]));
  }
  body.appendChild(el('tr', { className: 'total-row' }, [el('th', { text: 'Total payments' }), el('td', { className: 'computed', text: fmt(f.payments) })]));
  body.appendChild(el('tr', { className: 'owed-row' }, [el('th', { text: 'Amount you owe' }), el('td', { className: 'computed owed', text: fmt(f.amountOwed) })]));
  body.appendChild(el('tr', { className: 'refund-row' }, [el('th', { text: 'Amount to be refunded' }), el('td', { className: 'computed refund', text: fmt(f.amountRefunded) })]));

  table.appendChild(body);
  panel.appendChild(table);
}

/* ---------- State tax panel ---------- */
function renderState() {
  const panel = document.getElementById('statePanel');
  panel.innerHTML = '';
  const stateLabel = STATES[HOUSEHOLD.state].label;
  panel.appendChild(el('h2', { text: `${stateLabel} taxes` }));
  const s = DERIVED.state;

  const table = el('table', { className: 'tax-table' });
  const body = el('tbody');
  body.appendChild(el('tr', {}, [el('th', { text: 'Adjustments' }), el('td', {}, [numberInput('stateReturn.adjustments')])]));
  body.appendChild(el('tr', {}, [el('th', { text: `${stateLabel} AGI` }), el('td', { className: 'computed', text: fmt(s.stateAGI) })]));
  body.appendChild(el('tr', {}, [
    el('th', { text: 'Use itemized deduction instead' }),
    el('td', {}, [checkboxInput('stateReturn.useItemized'), numberInput('stateReturn.itemizedDeduction')]),
  ]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Deduction used' }), el('td', { className: 'computed', text: fmt(s.deduction) })]));
  if (s.dependentExemption != null) {
    body.appendChild(el('tr', {}, [el('th', { text: 'Dependent exemption' }), el('td', { className: 'computed', text: fmt(s.dependentExemption) })]));
  }
  body.appendChild(el('tr', {}, [el('th', { text: `${stateLabel} taxable income` }), el('td', { className: 'computed', text: fmt(s.taxableIncome) })]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Tax' }), el('td', { className: 'computed', text: fmt(s.tax) })]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Itemizer tax credit' }), el('td', {}, [numberInput('stateReturn.itemizerCredit')])]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Other credits' }), el('td', {}, [numberInput('stateReturn.otherCredits')])]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Other taxes' }), el('td', {}, [numberInput('stateReturn.otherTaxes')])]));
  body.appendChild(el('tr', { className: 'total-row' }, [el('th', { text: 'Total tax' }), el('td', { className: 'computed', text: fmt(s.totalTax) })]));
  body.appendChild(el('tr', {}, [el('th', { text: 'State withholding' }), el('td', { className: 'computed', text: fmt(s.payments - (HOUSEHOLD.stateReturn.withholdingFrom1099 || 0)) })]));
  body.appendChild(el('tr', {}, [el('th', { text: 'Withholding (1099)' }), el('td', {}, [numberInput('stateReturn.withholdingFrom1099')])]));
  body.appendChild(el('tr', { className: 'total-row' }, [el('th', { text: 'Total payments' }), el('td', { className: 'computed', text: fmt(s.payments) })]));
  body.appendChild(el('tr', { className: 'owed-row' }, [el('th', { text: 'Amount you owe' }), el('td', { className: 'computed owed', text: fmt(s.amountOwed) })]));
  body.appendChild(el('tr', { className: 'refund-row' }, [el('th', { text: 'Amount to be refunded' }), el('td', { className: 'computed refund', text: fmt(s.amountRefunded) })]));

  table.appendChild(body);
  panel.appendChild(table);
}

/* ---------- Totals panel ---------- */
function renderTotals() {
  const panel = document.getElementById('totalsPanel');
  panel.innerHTML = '';
  panel.appendChild(el('h2', { text: 'Totals' }));
  const t = DERIVED.totals;

  const table = el('table', { className: 'tax-table' });
  table.appendChild(el('thead', {}, [el('tr', {}, [el('th', { text: '' }), el('th', { text: 'YTD' }), el('th', { text: 'Remaining' }), el('th', { text: 'Annual' })])]));
  const body = el('tbody');
  const ytdRemAnnual = (label, obj) => el('tr', {}, [
    el('th', { text: label }),
    el('td', { className: 'computed', text: fmt(obj.ytd) }),
    el('td', { className: 'computed', text: fmt(obj.remaining) }),
    el('td', { className: 'computed', text: fmt(obj.annual) }),
  ]);
  body.appendChild(ytdRemAnnual('Gross pay', t.grossPay));
  body.appendChild(ytdRemAnnual('Net pay', t.netPay));
  body.appendChild(el('tr', { className: 'owed-row' }, [el('th', { text: 'Amount you owe' }), el('td', {}, []), el('td', {}, []), el('td', { className: 'computed owed', text: fmt(t.amountOwed) })]));
  body.appendChild(el('tr', { className: 'refund-row' }, [el('th', { text: 'Amount to be refunded' }), el('td', {}, []), el('td', {}, []), el('td', { className: 'computed refund', text: fmt(t.amountRefunded) })]));
  table.appendChild(body);
  panel.appendChild(table);
}

function renderAll() {
  renderSettings();
  renderFilers();
  renderFederal();
  renderState();
  renderTotals();
}
