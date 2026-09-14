# Passport OCR pipeline

← Back to [[⚙️ Technical Stack]] · [[🔧 Features Roadmap]]

## Why this exists

Users upload whatever they have: a tight crop of the data page, a 10-page booklet scan, front and back on one sheet, a page rotated 90°, a Schengen visa in the same PDF, a phone photo on a wooden desk. The apply form pre-fills from this read, so a **wrong value is worse than a blank**.

The sample corpus in `/Passports` is the spec. Changes are measured with:

```bash
npx tsx lib/passport/__smoke__/mrz.smoke.ts
npx tsx scripts/passport-samples/accuracy.ts
npx tsx scripts/passport-samples/inspect.ts
```

## Layout matrix (corpus)

| Scenario | Example | What used to break |
| --- | --- | --- |
| Tight data-page crop | Anurag PNG | (baseline — this already worked) |
| 2-page PDF, front then back | Dilip, Amar, Revanth | Back-page `PIN:500039` parsed as MRZ `P<IN…` |
| Extra pages / full booklet | Muniraj 10-page | Rank-by-MRZ kept visa stamps, dropped **page 10** (particulars) |
| Back first, then data, then visa | Eswara | Visa MRZ (`VCAUT…`) overwrote the passport |
| Front + back on one sheet + notary | Govind | Extra dates (old passport, notary) stole DOB/issue |
| Landscape `/Rotate` 90/270 | Amar, Sunil, Revanth, Govind | pdf.js applies `/Rotate`; leftover content rotation still needs a search |
| Portrait A4 with a sideways passport | Eswara p1/p2 | 90° was never tried (only 0° and 180°) |
| Phone photo, hand + desk | Pradeep, Rekha | Crop/deskew on table grain; Tesseract English often returns empty |
| Compound surname `A<B<<GIVEN` | TS Lakshman | Single `<` in surname was treated as OCR junk |
| JBIG2 scan | Rajashekar | Needs `public/pdfjs/wasm` |

## How a file is read now

1. **Triage every PDF page cheaply.** Short files (≤4 pages) are all promoted. Long booklets keep the best MRZ pages, their neighbours, and the **first and last** pages (Indian particulars are on the last page).
2. **Crop documents out of the sheet**, with extra bottom padding so the MRZ strip is not cut off (CamScanner A4 scans).
3. **Guess orientation from MRZ geometry**, not from page aspect. Landscape phone photos stay at 0° even if floorboards look like an MRZ at 90°. Portrait A4 with sideways content still tries 90° first.
4. **Find the data page by reading a TD3 MRZ**, not by page index. Visa lines (`V…`) and postal PIN lines (`PIN:500039`) are rejected, not rewritten into `P<`.
5. **Visual fields come only from the data-page crop.** Mixing in visa/stamp/back text is how expiry dates used to jump.
6. **Back-page crops are ranked** so a last page beats a visa page. Parents are only taken from a page that looks like a particulars page. The child's surname alone is allowed as a father name (South Indian naming).
7. **MRZ names win**, except when the printed zone is a truncation completion (`…KR` → `…KRISHNA`).

## What is still weak

- Phone photos on busy backgrounds (Rekha): English OCR of the full frame is often empty; ocrb of a binarized MRZ is lighting-sensitive.
- Printed-zone places (Place of Birth / Issue) on bilingual Indian layouts.
- Skewed back pages (Gaurav ~20°) and low-resolution booklet spreads (Girish).
- Trailing OCR junk on names is filtered, not eliminated.

A blank field the user can correct is the intended failure mode. Filling `PIN:500039` as the passport number is not.

## Runbook

```bash
npx tsx scripts/passport-samples/inspect.ts
npx tsx scripts/passport-samples/debugCrops.ts "Dilip Passport.pdf"
npx tsx scripts/passport-samples/accuracy.ts [nameFilter]
```

**Last updated:** 2026-09-14
