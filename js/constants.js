/* ============================================================
   CONSTANTS — tax-year tables. These are inflation-adjusted every year by
   the IRS (and, for Georgia, by whatever rate-cut schedule is currently
   law), so this file is the one place to check/update each January.
   Figures below are for tax year 2026, sourced November 2026:
     - Federal brackets, standard deduction, CTC: IRS Rev. Proc. 2025-32.
     - SS wage base: SSA 2026 COLA announcement ($184,500, up from $176,100).
     - Medicare rate: unchanged, no wage base cap (Additional Medicare
       surtax above $200k/$250k is NOT modeled — see README simplifications).
   ============================================================ */

const TAX_YEARS = {
  2026: {
    federal: {
      // from/to are the taxable-income boundaries for each bracket; the top
      // bracket's `to` is Infinity.
      brackets: {
        single: [
          { rate: 0.10, from: 0, to: 12400 },
          { rate: 0.12, from: 12400, to: 50400 },
          { rate: 0.22, from: 50400, to: 105700 },
          { rate: 0.24, from: 105700, to: 201775 },
          { rate: 0.32, from: 201775, to: 256225 },
          { rate: 0.35, from: 256225, to: 640600 },
          { rate: 0.37, from: 640600, to: Infinity },
        ],
        MFJ: [
          { rate: 0.10, from: 0, to: 24800 },
          { rate: 0.12, from: 24800, to: 100800 },
          { rate: 0.22, from: 100800, to: 211400 },
          { rate: 0.24, from: 211400, to: 403550 },
          { rate: 0.32, from: 403550, to: 512450 },
          { rate: 0.35, from: 512450, to: 768700 },
          { rate: 0.37, from: 768700, to: Infinity },
        ],
        MFS: [
          { rate: 0.10, from: 0, to: 12400 },
          { rate: 0.12, from: 12400, to: 50400 },
          { rate: 0.22, from: 50400, to: 105700 },
          { rate: 0.24, from: 105700, to: 201775 },
          { rate: 0.32, from: 201775, to: 256225 },
          { rate: 0.35, from: 256225, to: 384350 },
          { rate: 0.37, from: 384350, to: Infinity },
        ],
        HOH: [
          { rate: 0.10, from: 0, to: 17700 },
          { rate: 0.12, from: 17700, to: 67450 },
          { rate: 0.22, from: 67450, to: 105700 },
          { rate: 0.24, from: 105700, to: 201750 },
          { rate: 0.32, from: 201750, to: 256200 },
          { rate: 0.35, from: 256200, to: 640600 },
          { rate: 0.37, from: 640600, to: Infinity },
        ],
      },
      // Qualifying Surviving Spouse uses the same brackets/standard
      // deduction as Married Filing Jointly.
      standardDeduction: { single: 16100, MFJ: 32200, MFS: 16100, HOH: 24150, QSS: 32200 },
      ctcPerChild: 2200,
    },
    fica: {
      ssRate: 0.062,
      ssWageBase: 184500,
      medicareRate: 0.0145,
    },
  },
};
TAX_YEARS[2026].federal.brackets.QSS = TAX_YEARS[2026].federal.brackets.MFJ;

// Registry of implemented states — each js/states/*.js file adds itself
// here. The state <select> in the UI only lists what's registered, so it
// never implies support for a state that doesn't have a module yet.
const STATES = {};

const FILING_STATUSES = [
  { value: 'single', label: 'Single' },
  { value: 'MFJ', label: 'Married Filing Jointly' },
  { value: 'MFS', label: 'Married Filing Separately' },
  { value: 'HOH', label: 'Head of Household' },
  { value: 'QSS', label: 'Qualifying Surviving Spouse' },
];

// Starting point for a new filer's pretax deductions. `reducesFicaTaxable:
// false` on the 401k template is what makes FICA-taxable pay come out
// higher than federal/state-taxable pay for the same filer — traditional
// 401k contributions are exempt from income tax withholding but still
// subject to Social Security/Medicare.
const DEDUCTION_TEMPLATES = [
  { label: '401k', type: 'percentOfGross', reducesFederalTaxable: true, reducesFicaTaxable: false, reducesStateTaxable: true },
  { label: 'HSA', type: 'flatPerPeriod', reducesFederalTaxable: true, reducesFicaTaxable: true, reducesStateTaxable: true },
  { label: 'Dental', type: 'flatPerPeriod', reducesFederalTaxable: true, reducesFicaTaxable: true, reducesStateTaxable: true },
  { label: 'Medical', type: 'flatPerPeriod', reducesFederalTaxable: true, reducesFicaTaxable: true, reducesStateTaxable: true },
  { label: 'Vision', type: 'flatPerPeriod', reducesFederalTaxable: true, reducesFicaTaxable: true, reducesStateTaxable: true },
  { label: 'Limited FSA', type: 'flatPerPeriod', reducesFederalTaxable: true, reducesFicaTaxable: true, reducesStateTaxable: true },
];
