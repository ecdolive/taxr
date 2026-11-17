/* ============================================================
   CALC — pure functions only, no DOM access. Given a Household (see
   model.js), these produce the numbers every panel renders. Keeping them
   pure makes it possible to sanity-check against the source spreadsheet
   by hand, one function at a time.
   ============================================================ */

function calcBracketTax(taxableIncome, brackets) {
  let tax = 0;
  for (const b of brackets) {
    if (taxableIncome <= b.from) break;
    tax += (Math.min(taxableIncome, b.to) - b.from) * b.rate;
  }
  return tax;
}

// One filer's YTD / remaining / annual rollup: gross pay, each deduction,
// the three differently-taxable-pay bases, withholdings, and net pay.
function computeFilerRollup(filer, taxYear) {
  const fica = TAX_YEARS[taxYear].fica;
  const periods = filer.payPeriodsRemaining;

  const grossPayRemaining = filer.grossPayPerPeriod * periods;
  const grossPayAnnual = filer.grossPayYTD + grossPayRemaining;
  const taxableBenefitsRemaining = filer.taxableBenefitsPerPeriod * periods;
  const taxableBenefitsAnnual = filer.taxableBenefitsYTD + taxableBenefitsRemaining;

  const deductions = filer.deductions.map(d => {
    const remainingPerPeriod = d.type === 'percentOfGross' ? d.remainingValue * filer.grossPayPerPeriod : d.remainingValue;
    const remainingAmount = remainingPerPeriod * periods;
    return Object.assign({}, d, { remainingPerPeriod, remainingAmount, annualAmount: d.ytdAmount + remainingAmount });
  });
  const basisTotal = (basisKey, amountKey) =>
    deductions.filter(d => d[basisKey]).reduce((s, d) => s + d[amountKey], 0);
  const basisPerPeriodTotal = basisKey =>
    deductions.filter(d => d[basisKey]).reduce((s, d) => s + d.remainingPerPeriod, 0);

  const grossPlusBenefitsYtd = filer.grossPayYTD + filer.taxableBenefitsYTD;
  const grossPlusBenefitsAnnual = grossPayAnnual + taxableBenefitsAnnual;
  const grossPlusBenefitsPerPeriod = filer.grossPayPerPeriod + filer.taxableBenefitsPerPeriod;

  const federalTaxablePay = {
    ytd: grossPlusBenefitsYtd - basisTotal('reducesFederalTaxable', 'ytdAmount'),
    annual: grossPlusBenefitsAnnual - basisTotal('reducesFederalTaxable', 'annualAmount'),
  };
  const ficaTaxablePay = {
    ytd: grossPlusBenefitsYtd - basisTotal('reducesFicaTaxable', 'ytdAmount'),
    annual: grossPlusBenefitsAnnual - basisTotal('reducesFicaTaxable', 'annualAmount'),
  };
  const stateTaxablePay = {
    ytd: grossPlusBenefitsYtd - basisTotal('reducesStateTaxable', 'ytdAmount'),
    annual: grossPlusBenefitsAnnual - basisTotal('reducesStateTaxable', 'annualAmount'),
  };

  // SS withholding is capped at the wage base rather than a flat rate ×
  // periods, so projections don't overshoot once a filer crosses it —
  // and if YTD alone already exceeds the cap (e.g. a job change
  // mid-year), that surfaces as an excess-withholding federal credit.
  const ssWithholdingAnnual = filer.ssWithholdingRate * Math.min(Math.max(ficaTaxablePay.annual, 0), fica.ssWageBase);
  const ssWithholding = {
    ytd: filer.ssWithholdingYTD,
    annual: Math.max(ssWithholdingAnnual, filer.ssWithholdingYTD),
  };
  ssWithholding.remaining = ssWithholding.annual - ssWithholding.ytd;
  const excessSSWithholding = Math.max(0, filer.ssWithholdingYTD - filer.ssWithholdingRate * fica.ssWageBase);

  // Medicare has no wage base and its rate isn't a W-4 election, so
  // (unlike federal/state withholding) there's nothing to configure for
  // the remaining periods — it's always the statutory rate.
  const medicareWithholdingRemaining = fica.medicareRate * Math.max(0, ficaTaxablePay.annual - ficaTaxablePay.ytd);
  const medicareWithholding = {
    ytd: filer.medicareWithholdingYTD,
    remaining: medicareWithholdingRemaining,
    annual: filer.medicareWithholdingYTD + medicareWithholdingRemaining,
  };

  // Withholding is a percentage of taxable pay, not gross pay — e.g. 401k
  // contributions reduce the wages federal/state income tax is withheld
  // from, same as they reduce the wages actually taxed at filing time.
  const federalTaxablePayPerPeriod = grossPlusBenefitsPerPeriod - basisPerPeriodTotal('reducesFederalTaxable');
  const stateTaxablePayPerPeriod = grossPlusBenefitsPerPeriod - basisPerPeriodTotal('reducesStateTaxable');

  const federalWithholdingRemaining = periods * (filer.federalWithholdingRate * federalTaxablePayPerPeriod + filer.federalWithholdingExtra);
  const federalWithholding = {
    ytd: filer.federalWithholdingYTD,
    remaining: federalWithholdingRemaining,
    annual: filer.federalWithholdingYTD + federalWithholdingRemaining,
  };

  const stateWithholdingRemaining = periods * (filer.stateWithholdingRate * stateTaxablePayPerPeriod + filer.stateWithholdingExtra);
  const stateWithholding = {
    ytd: filer.stateWithholdingYTD,
    remaining: stateWithholdingRemaining,
    annual: filer.stateWithholdingYTD + stateWithholdingRemaining,
  };

  const deductionsTotalYtd = deductions.reduce((s, d) => s + d.ytdAmount, 0);
  const deductionsTotalAnnual = deductions.reduce((s, d) => s + d.annualAmount, 0);

  const netPayYtd = grossPlusBenefitsYtd - deductionsTotalYtd
    - filer.federalWithholdingYTD - filer.ssWithholdingYTD - filer.medicareWithholdingYTD - filer.stateWithholdingYTD;
  const netPayAnnual = grossPlusBenefitsAnnual - deductionsTotalAnnual
    - federalWithholding.annual - ssWithholding.annual - medicareWithholding.annual - stateWithholding.annual;

  return {
    id: filer.id,
    name: filer.name,
    payPeriodsRemaining: periods,
    deductions,
    grossPay: { ytd: filer.grossPayYTD, remaining: grossPayRemaining, annual: grossPayAnnual },
    taxableBenefits: { ytd: filer.taxableBenefitsYTD, remaining: taxableBenefitsRemaining, annual: taxableBenefitsAnnual },
    federalTaxablePay, ficaTaxablePay, stateTaxablePay,
    federalWithholding, ssWithholding, medicareWithholding, stateWithholding,
    excessSSWithholding,
    netPay: { ytd: netPayYtd, remaining: netPayAnnual - netPayYtd, annual: netPayAnnual },
  };
}

function computeFederalTax(household, filerRollups) {
  const fed = TAX_YEARS[household.taxYear].federal;
  const f = household.federal;

  const wagesAnnual = filerRollups.reduce((s, fr) => s + fr.federalTaxablePay.annual, 0);
  const agi = wagesAnnual + (f.additionalTaxableIncome || 0) - (f.adjustments || 0);
  const standardDeduction = fed.standardDeduction[household.filingStatus];
  const deduction = Math.max(standardDeduction, f.useItemized ? (f.itemizedDeduction || 0) : 0);
  const taxableIncome = Math.max(0, agi - deduction);
  const bracketTax = calcBracketTax(taxableIncome, fed.brackets[household.filingStatus]);
  const childTaxCredit = household.dependents.qualifyingChildren * fed.ctcPerChild;
  const totalTax = Math.max(0, bracketTax - childTaxCredit - (f.otherCredits || 0) + (f.otherTaxes || 0));

  const withholding = filerRollups.reduce((s, fr) => s + fr.federalWithholding.annual, 0);
  const excessSSWithholding = filerRollups.reduce((s, fr) => s + fr.excessSSWithholding, 0);
  const payments = withholding + (f.withholdingFrom1099 || 0) + excessSSWithholding;

  return {
    wagesAnnual, agi, standardDeduction, deduction, taxableIncome, bracketTax, childTaxCredit,
    totalTax, withholding, excessSSWithholding, payments,
    amountOwed: Math.max(0, totalTax - payments),
    amountRefunded: Math.max(0, payments - totalTax),
  };
}

function computeStateTax(household, filerRollups, federalResult) {
  const mod = STATES[household.state];
  const filerAnnuals = filerRollups.map(fr => ({ stateWithholding: fr.stateWithholding.annual }));
  return mod.compute(household, filerAnnuals, federalResult);
}

function computeTotals(filerRollups, federalResult, stateResult) {
  const sum = (key, part) => filerRollups.reduce((s, fr) => s + fr[key][part], 0);
  const combinedOwed = federalResult.amountOwed + stateResult.amountOwed;
  const combinedRefunded = federalResult.amountRefunded + stateResult.amountRefunded;

  return {
    grossPay: { ytd: sum('grossPay', 'ytd'), remaining: sum('grossPay', 'remaining'), annual: sum('grossPay', 'annual') },
    netPay: { ytd: sum('netPay', 'ytd'), remaining: sum('netPay', 'remaining'), annual: sum('netPay', 'annual') },
    amountOwed: Math.max(0, combinedOwed - combinedRefunded),
    amountRefunded: Math.max(0, combinedRefunded - combinedOwed),
  };
}

function computeAll(household) {
  const filerRollups = household.filers.map(f => computeFilerRollup(f, household.taxYear));
  const federal = computeFederalTax(household, filerRollups);
  const state = computeStateTax(household, filerRollups, federal);
  const totals = computeTotals(filerRollups, federal, state);
  return { filerRollups, federal, state, totals };
}
