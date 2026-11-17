/* ============================================================
   GEORGIA — state tax module. Registers itself on the shared STATES
   registry (declared in constants.js, which loads first). This is the
   template for adding another state later: one file like this one, one
   <script> tag in index.html, one entry in STATES — nothing in calc.js
   or render.js needs to change.

   Figures below are for tax year 2026 per Georgia HB 463 (signed 2026,
   retroactive to Jan 1 2026): flat rate cut to 4.99%, standard deduction
   raised to $15,000 (single) / $30,000 (MFJ). Two figures are uncertain
   and worth double-checking on dor.georgia.gov before relying on them:
     - The dependent exemption: sources split between $4,000 (the older,
       more consistently-cited figure, and what the source spreadsheet
       used) and $5,000 (a newer HB 463 figure some sources cite). Using
       $4,000 here — update GA_DEPENDENT_EXEMPTION if $5,000 is confirmed.
     - The Head of Household / Married Filing Separately standard
       deduction isn't clearly documented post-HB 463; this uses the
       single-filer amount as a placeholder.
   ============================================================ */

const GA_FLAT_RATE = 0.0499;
const GA_STANDARD_DEDUCTION = { single: 15000, MFJ: 30000, MFS: 15000, HOH: 15000, QSS: 30000 };
const GA_DEPENDENT_EXEMPTION = 4000;

STATES.GA = {
  label: 'Georgia',

  defaultReturn() {
    return {
      adjustments: 0,       // e.g. retirement income exclusion, muni bond add-back
      useItemized: false,
      itemizedDeduction: 0,
      itemizerCredit: 0,    // manual $ entry — see README for why this isn't computed
      otherCredits: 0,
      otherTaxes: 0,
      withholdingFrom1099: 0,
    };
  },

  compute(household, filerAnnuals, federalResult) {
    const sr = household.stateReturn;
    const filingStatus = household.filingStatus;

    const stateAGI = federalResult.agi + (sr.adjustments || 0);
    const standardDeduction = GA_STANDARD_DEDUCTION[filingStatus] || GA_STANDARD_DEDUCTION.single;
    const deduction = Math.max(standardDeduction, sr.useItemized ? (sr.itemizedDeduction || 0) : 0);
    const totalDependents = household.dependents.qualifyingChildren + household.dependents.otherDependents;
    const dependentExemption = totalDependents * GA_DEPENDENT_EXEMPTION;

    const taxableIncome = Math.max(0, stateAGI - deduction - dependentExemption);
    const tax = taxableIncome * GA_FLAT_RATE;
    const credits = (sr.itemizerCredit || 0) + (sr.otherCredits || 0);
    const totalTax = Math.max(0, tax - credits + (sr.otherTaxes || 0));

    const withholding = filerAnnuals.reduce((sum, f) => sum + f.stateWithholding, 0);
    const payments = withholding + (sr.withholdingFrom1099 || 0);

    return {
      stateAGI, deduction, dependentExemption, taxableIncome, tax, credits, totalTax,
      payments, amountOwed: Math.max(0, totalTax - payments), amountRefunded: Math.max(0, payments - totalTax),
    };
  },
};
