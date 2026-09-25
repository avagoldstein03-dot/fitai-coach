# 02: Account map & graveyard

## Account setup checklist
- [ ] Meta Business Manager `{{BM_ID}}`
- [ ] Ad account `{{AD_ACCOUNT_ID}}`, currency `{{CURRENCY}}`
- [ ] App registered in Events Manager (iOS + Android)
- [ ] Event tracking live (see 03, **blocker today**)
- [ ] Payment method + spend limit set to `{{BUDGET_CEILING}}`

## Planned launch structure (proposal, not yet live)
Keep it simple at low budget: fewer ad sets = faster learning.

| Campaign | Objective | Optimization event | Audience | Budget |
|----------|-----------|--------------------|----------|--------|
| AAI_Test_Creative | App promotion | Install → switch to purchase/trial once ≥50/wk | Broad, `{{COUNTRIES}}`, 18+ | `{{TEST_BUDGET}}` |
| AAI_Scale (later) | App promotion | Purchase | Broad | Only after 04's scale rule triggers |

No interest/segment targeting at launch: the **creative** picks the segment (a 45+ creator finds 45+ viewers). Segment is tracked per creative in 05.

**Naming convention:** `AAI_<campaign>_<segment>_<feature>_<hookType>_<YYMMDD>`, e.g. `AAI_Test_plus45_Readiness_Identity_261001`.

## Live
| Campaign / ad set / ad | Launched | Status | Notes |
|---|---|---|---|
| *(none yet)* | | | |

## Graveyard: tested and killed
Log everything killed, with *why*. Claude checks this before recommending anything.

| Date killed | What (creative / audience / offer) | Spend | Result vs. 01 target | Why it died | Would retry if… |
|---|---|---|---|---|---|
| *(none yet)* | | | | | |
