# Dalīl — Public-Readiness TODO

> Companion to [`../Tauri Apps - Public Readiness Plan.md`](../Tauri%20Apps%20-%20Public%20Readiness%20Plan.md).
> Every item below is transcribed from that report — see **Source coverage** at the bottom to confirm nothing was dropped.

| | |
|---|---|
| Path (git root) | `dalīl/` |
| Remote | `withoutfanfare/dal-l` |
| Visibility | **PUBLIC** |
| Bundle ID | `com.withoutfanfare.dalil` |
| Overall risk (report §10) | **Medium** |
| CSP | good, but `connect-src https:` broad |
| Updater | endpoint `github.com/withoutfanfare/dal-l/releases`; public minisign key only (safe) |

## How to use
`- [ ]` open · `- [x]` done · `- [~]` blocked / decision needed (note why). Phases mirror report §9. **P0 → P1 are gating.**

## §4 "Safely public" scorecard (transcribed from report §10)

| # | Criterion | Status | Note |
|---|---|---|---|
| 1 | No secrets / PII in git history | ✅ | `TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.* }}` correct, not a leak (§7) |
| 2 | No secrets / PII in working tree | ✅ | API keys masked via `mask_key()` (§7) |
| 3 | LICENSE present | ❌ | none (§6.1) |
| 4 | Builds from clean clone | ❌ | (§6.2 portfolio-wide) |
| 5 | CSP not null | ✅ | good, `connect-src https:` broad (§7) |
| 6 | Least-privilege capabilities | ❌ | permissive (§6.4) |
| 7 | No dangerous code paths | ✅ | `Command::new("git"\|"node")` discrete args; `innerHTML` hardcoded SVG (§7) |
| 8 | No undisclosed telemetry | ✅ | no telemetry (§1) |
| 9 | No confidential client data | ✅ | (§10) |
| 10 | README adequate | ⚠️ | needs work (§10) |
| 11 | Secret-scanning in CI | ❌ | none (§6.7) |

## P0 — Incident response
_None for Dalīl_ (history and working tree clean).

## P1 — Blockers before publicising (gating)
- [ ] **Add LICENSE** to repo root — decision §8.1 (default MIT). Set `license`/`author` in `package.json`. (report §6.1, §9 P1.1)
- [ ] **Finish env-var fallback in `dalil.config.ts`** — currently hardcodes `/Users/dannyharding/Herd/scooda-current/project/engineering-handbook/`; `process.env.DALIL_HANDBOOK_PATH` half-wired — complete it. **Functionally breaking.** (report §6.6, §7 dalil)
- [ ] **Solve `@stuntrocket/ui` distribution** — pending §8.2 (default publish to npm). (report §6.2, §9 P1.2)

## P2 — Security hardening
- [ ] **Tighten capabilities** — drop or scope `shell:allow-execute` / `shell:allow-spawn` / `shell:allow-open`, full `store:*` (8 perms), `process:allow-restart`/`exit`, and open regex `(/.+)$`. Re-implement the build-command feature via a scoped Tauri command that constructs argv in Rust (report Appendix H). (report §6.4, §9 P2.1)
- [ ] **Tighten CSP `connect-src`** — replace broad `https:` with explicit origins. (report §7 dalil, §9 P2.8)
- [ ] **Secret-scanning CI** — `gitleaks` pre-commit + GitHub Actions (report Appendix C). (report §6.7, §9 P2.4)
- [ ] **Standardise `.gitignore`** to report Appendix D. (report §6.7, §9 P2.6)
- [ ] **Wire `npm audit` / `cargo audit` into CI** (currently 0 high). (report §9 P2.7)

## P3 — Polish & privacy presentation
- [ ] **Bundle-ID decision** — `com.withoutfanfare.dalil` → unified scheme (default `co.stuntrocket.dalil`). ⚠️ decide **before** notarisation. (report §6.5, §8.3, §9 P3.1)
- [ ] **Scrub `/Users/dannyharding/...`** from docs. (report §6.6, §7 dalil)
- [ ] **Improve README** (currently ⚠️). (report §9 P3.4)
- [ ] **Add privacy statement** to README (report Appendix F). (report §9 P3.5)
- [ ] **Add `SECURITY.md`** (report Appendix G). (report §9 P3.6)
- [ ] **Review updater endpoint & signing-key handling** before wider distribution. (report §9 P3.7)

## Source coverage
Maps **every Dalīl mention in the main report** to a row above (all copied ✅).

| Report ref | What it says about Dalīl | Landed in | Copied |
|---|---|---|---|
| §2 table | path / remote `withoutfanfare/dal-l` / bundle id | header | ✅ |
| §6.1 | no LICENSE | P1 | ✅ |
| §6.2 | clean-clone blocker (portfolio-wide) | P1 | ✅ |
| §6.4 | permissive capabilities: shell execute/spawn/open, store:*, process, open regex `(/.+)$` | P2 | ✅ |
| §6.5 | bundle id `com.withoutfanfare.dalil` | P3 | ✅ |
| §6.6 | `dalil.config.ts` hardcoded `/Users/dannyharding/Herd/…` — **functionally breaking**; env fallback half-wired | P1 | ✅ |
| §6.7 | no secret-scanning CI | P2 | ✅ |
| §7 Dalil | history clean; signing key via GitHub Secret (safe); updater public minisign key; mask_key(); connect-src https: broad; discrete args; hardcoded SVG innerHTML; fixes list | scorecard + P1/P2 | ✅ |
| §8.1/§8.2/§8.3 | licence / UI / bundle-id decisions | P1/P3 | ✅ |
| §9 P2.1 | capabilities hardening (Appendix H) | P2 | ✅ |
| §9 P2.8 | dalil env fallback + tighten connect-src | P1/P2 | ✅ |
| §9 P3.1/P3.4/P3.5/P3.6/P3.7 | bundle id, README, privacy, SECURITY.md, updater review | P3 | ✅ |
| §10 row | full scorecard | scorecard | ✅ |
