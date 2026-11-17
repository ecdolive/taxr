# taxr

A personal, single-user tool for projecting household tax liability for the
year from year-to-date paystub actuals plus assumptions about remaining pay
periods. It's a more user-friendly in-browser replacement for a Numbers
spreadsheet that did the same thing by hand.

Like its sibling project, there's **no build step, no package manager, and
no backend** — plain HTML/CSS/JS:

- `index.html` — the DOM shell
- `js/constants.js` — federal tax-year tables (brackets, standard deduction,
  CTC, FICA rates/wage base)
- `js/states/*.js` — one file per supported state's tax rules (just Georgia
  for now); each registers itself on the `STATES` object, so adding a new
  state is one new file + one `<script>` tag + one `STATES.XX = {...}` —
  nothing else changes
- `js/model.js` — the `Household` data shape and factories for a fresh one
- `js/calc.js` — pure calculation functions (no DOM access), given a
  `Household`
- `js/render.js` — builds every panel's DOM from `HOUSEHOLD`/`DERIVED`
- `js/app.js` — global state, event wiring, load/save

## Running it

Open `index.html` directly in a browser — no server needed. There's no
test suite or build/watch command.

## Data model and persistence

Everything lives in memory (the `HOUSEHOLD` object) and is lost on reload
unless exported. Use **Save** to download a timestamped JSON snapshot, and
**Load** to read one back in. There's no CSV/paystub import yet — YTD
figures are entered by hand from your own paystub.

A household supports any filing status, any number of filers (earners),
and an arbitrary list of pretax deductions per filer (401k, HSA, FSA, etc.
— add, remove, or relabel freely). Each deduction is tagged with which of
the three taxable-pay bases it reduces (federal / FICA / state), since
that's what actually varies between deduction types — e.g. traditional
401k reduces federal and state taxable pay but not FICA-taxable pay.

## Known v1 simplifications

These are deliberate scope cuts, not bugs:

- No AGI phase-out on the Child Tax Credit.
- No Additional Medicare surtax (0.9% over the threshold) or Net Investment
  Income Tax.
- Itemized federal/state deductions are a single manual dollar figure, not
  broken into Schedule A line items.
- One state per household return — a filer's state withholding is treated
  as a credit against that one state's liability.
- Georgia's "itemizer tax credit" line is a manual entry, not computed —
  see the comment in `js/states/georgia.js`.

## Tax tables need an annual check

`js/constants.js` and `js/states/*.js` hold tax-year-specific figures
(bracket thresholds, standard deductions, credit amounts, flat rates) that
change every year. They're currently set for **tax year 2026**, sourced
November 2026. Re-verify against the IRS (and each state's Department of
Revenue) every January — `js/states/georgia.js` in particular flags two
figures (the dependent exemption amount, and the Head of
Household/Married Filing Separately standard deduction) that had
conflicting sources as of this writing and are worth double-checking
against dor.georgia.gov.
