# Archived one-off scripts

These were temporary repair / local migration helpers used while migrating to
`traveler_profiles` + vault ownership. They are **not** part of the product
runtime or required deploy steps.

| Script | Why it existed |
|---|---|
| `repair-user-traveler-vault.ts` | Fix mixed vault ownership for a specific local user |
| `repair-vault-application-separation.ts` | Unlink vault bleed from application paths |
| `cleanup-blank-traveler-profiles.ts` | Remove incomplete `id:` / blank profiles |
| `apply-0040-local.ts` / `apply-0041-local.ts` | Apply hand-written SQL locally outside drizzle migrate |
| `backfill-passenger-profiles.ts` | One-time backfill into `traveler_profiles` |

Do not wire these into CI. Prefer correct-by-design flows in apply/submit/vault.
