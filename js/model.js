/* ============================================================
   MODEL — the Household data shape, and factories for creating a fresh
   one. This is the only shape that gets saved/loaded as JSON (see
   app.js), so schemaVersion exists from day one even though there's only
   one version right now.
   ============================================================ */

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function defaultDeduction(template) {
  return {
    id: uid('ded'),
    label: template.label,
    type: template.type,                               // 'percentOfGross' | 'flatPerPeriod'
    reducesFederalTaxable: template.reducesFederalTaxable,
    reducesFicaTaxable: template.reducesFicaTaxable,
    reducesStateTaxable: template.reducesStateTaxable,
    ytdAmount: 0,
    remainingValue: 0,                                  // % (as decimal) if percentOfGross, else $/period
  };
}

function defaultFiler(name, taxYear) {
  const fica = TAX_YEARS[taxYear].fica;
  return {
    id: uid('filer'),
    name: name || 'New filer',
    grossPayYTD: 0,
    taxableBenefitsYTD: 0,
    deductions: DEDUCTION_TEMPLATES.map(defaultDeduction),
    federalWithholdingYTD: 0,
    ssWithholdingYTD: 0,
    medicareWithholdingYTD: 0,
    stateWithholdingYTD: 0,
    payPeriodsRemaining: 0,
    grossPayPerPeriod: 0,
    taxableBenefitsPerPeriod: 0,
    federalWithholdingRate: 0,
    federalWithholdingExtra: 0,
    ssWithholdingRate: fica.ssRate,
    stateWithholdingRate: 0,
    stateWithholdingExtra: 0,
  };
}

function defaultHousehold() {
  const taxYear = 2026;
  const state = 'GA';
  return {
    schemaVersion: 1,
    taxYear,
    filingStatus: 'MFJ',
    state,
    dependents: { qualifyingChildren: 0, otherDependents: 0 },
    federal: {
      additionalTaxableIncome: 0,
      adjustments: 0,
      useItemized: false,
      itemizedDeduction: 0,
      otherCredits: 0,
      otherTaxes: 0,
      withholdingFrom1099: 0,
    },
    stateReturn: STATES[state].defaultReturn(),
    filers: [defaultFiler('Filer 1', taxYear)],
  };
}

// There's only ever been schemaVersion 1 so far — this just guards against
// loading a file from some future, incompatible version of taxr rather
// than silently misinterpreting it.
function migrateHousehold(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('File does not contain a valid household.');
  if (obj.schemaVersion !== 1) throw new Error('Unsupported file version: ' + obj.schemaVersion);
  return obj;
}
