# GarminCoach — Projektstatus (Handoff für neue Session)

Stand: nach Phase 5 + Selbst-Review-Bugfixes. Alle ursprünglich geplanten Phasen (0–5) sind fertig.

## Was das Projekt ist

Persönliche Marathon-Trainings-Coach-Webapp (Vorbild: Garmin Coach) für **Hannes**, Ziel: **Berlin Marathon, September 2027**. Next.js/TypeScript auf Vercel, Supabase (Postgres + Auth + RLS), PWA fürs iPhone. Single-User-App (kein Signup, ein Account). Alle Kommunikation mit dem Nutzer läuft auf **Deutsch**.

Wichtigster Anspruch des Nutzers (steht so auch im ursprünglichen Plan): Trainingslogik muss als reine, framework-unabhängige TypeScript-Funktionen existieren, testbar und nachvollziehbar — insbesondere die **Reaktion auf ausgefallene Einheiten** (Phase 4) ist das wichtigste Feature und muss deterministisch + mit Begründungstext für den Nutzer nachvollziehbar sein.

## Repo / Branch

- Repo: `Hannes253/GarminCoach` (GitHub)
- Branch: `claude/friendly-carson-qmhhv1` — **alles läuft auf diesem Branch**, nicht auf `main`. Bei einer neuen Session: diesen Branch auschecken, nicht neu von `main` anfangen. (Achtung: `claude/marathon-coach-webapp-a9ptra` ist ein alter, verwaister Branch mit nur dem Phase-0-Stand — nicht verwenden.)
- Der ursprüngliche Architektur-/Phasenplan liegt (nur in dieser Sandbox-Umgebung, nicht im Repo) unter `/root/.claude/plans/prompt-f-r-claude-code-stateful-crab.md` — falls in einer neuen Session nicht vorhanden, ist diese Datei hier die relevantere Quelle.

## Architektur

pnpm-Workspace-Monorepo:

```
apps/web/                          Next.js App Router (TS)
  app/(auth)/login/                Magic-Link-Login
  app/(app)/{page,history,import,plan,settings,week/[weekId]}/
  app/api/{strava/*, export/workout/today}/
  app/offline/                     Service-Worker-Fallback-Seite
  app/manifest.ts, app/layout.tsx
  lib/supabase/{client,server,types.generated}.ts
  lib/mappers/{activity,plan}.ts   Supabase-Row <-> training-engine Domain-Typen
  lib/import/                      FIT/CSV-Import-Pipeline (Web Worker)
  lib/export/workoutFit.ts         FIT-Workout-Export (Garmin-Uhr)
  lib/data/{activities,plan}.ts    Server-seitige Ladefunktionen
  lib/actions/{manualFields,settings,plan}.ts   Server Actions
  lib/adaptation/runLazyAdaptation.ts           Orchestriert die Anpassungslogik + Persistierung
  components/                      UI-Komponenten (iOS/Apple-Design)
  public/sw.js                     Service Worker (Offline, read-only)
  proxy.ts                         Auth-Guard (Next.js 16 Middleware-Nachfolger)
packages/training-engine/src/
  types/                           Domain-Typen (Activity, TrainingPlan, PlannedWorkout, PlanAdjustment, ...)
  config/training-science.config.ts   ZENTRALE Config aller trainingswissenschaftlichen Annahmen
  analysis/                        Load (ATL/CTL/TSB), Volumen, Intensität, Effizienz, Long-Run, Warnungen
  planning/                        periodization.ts (generatePlan), workoutGenerator.ts
  adaptation/                      reconcile.ts, missedSession.ts, missedDays.ts, longBreak.ts,
                                    overtrainingGuard.ts, engine.ts (Orchestrator)
  *.test.ts                        Vitest, colocated
supabase/migrations/                nummerierte SQL-Migrationen (siehe unten)
.github/workflows/ci.yml            lint, typecheck, vitest, dependency-boundary-check, build
```

**Wichtige Regel** (CI-erzwungen via `dependency-cruiser`): `packages/training-engine/src` darf niemals `next`, `react` oder `@supabase/*` importieren. Reine Business-Logik, kein I/O.

## Datenbank-Migrationen — WICHTIG für den Nutzer

Migrationen werden **manuell** vom Nutzer im Supabase SQL-Editor ausgeführt (kein automatisches Deployment). Stand der Konversation:

| Migration | Inhalt | Vom Nutzer ausgeführt? |
|---|---|---|
| `0001_init.sql` | user_settings, activities, import_batches/items, activity_manual_fields, daily_log | ✅ ja (Phase 0/1) |
| `0002_strava_integration.sql` | strava_connection, source-Enum-Erweiterung | ✅ ja |
| `0003_planning.sql` | training_plans, plan_phases, plan_weeks, planned_workouts | ✅ ja (bestätigt) |
| `0004_adaptation.sql` | plan_adjustments (Anpassungs-Log) | ✅ ja (bestätigt) |
| `0005_one_active_plan.sql` | Partial-Unique-Index: max. 1 aktiver Plan pro Nutzer | ✅ ja (bestätigt) |

Alle 5 Migrationen sind ausgeführt. Phase 4 (Anpassungslogik) ist damit vollständig produktionsfähig.

## Bereits eingerichtete externe Dienste (vom Nutzer, mit Anleitung)

- **Supabase-Projekt**: Postgres + Auth (Magic Link, Public Signup deaktiviert) + RLS auf jeder Tabelle
- **Vercel-Deployment**: laut früherem Stand verbunden mit dem Branch `claude/marathon-coach-webapp-a9ptra`, Env-Vars gesetzt — ⚠️ **das ist der falsche/veraltete Branch (nur Phase-0-Stand)**. Der Nutzer sollte in den Vercel-Projekteinstellungen prüfen und ggf. auf `claude/friendly-carson-qmhhv1` umstellen, sonst wird nicht die fertige App deployed.
- **Strava API App**: OAuth + Webhook-Subscription aktiv, automatischer Import neuer Aktivitäten läuft produktiv

## Phasenstatus (alle abgeschlossen)

- **Phase 0** — Grundgerüst, Auth, Deployment, CI. ✅
- **Phase 1** — FIT-ZIP/CSV-Import (Web Worker, dedup), Aktivitätsliste. ✅
- **Strava-Auto-Sync** (vorgezogen) — OAuth + Webhook-Ingestion. ✅
- **Phase 2** — Analyse: Load/ATL-CTL-TSB, Wochenvolumen, Intensitätsverteilung (80/20), aerobe Effizienz, Long-Run-Progression, Warnungen (Ramp-Rate + ACWR/Overreach). RPE/Schlaf/Notiz-UI. ✅
- **Phase 3** — Planung: Rückwärts-Periodisierung (`generatePlan`), Wochengenerator, Einstellungsseite (Renndatum), Planseite (Makrozyklus + aktuelle Woche), Server Action zur Plan-Erstellung. ✅
- **FIT-Workout-Export** — Einzelne FIT-Datei pro Tag für die Garmin-Uhr, `/api/export/workout/today`, manueller Import in Garmin Connect. ✅
- **UI-Redesign** — Komplettes Apple/iOS-Design-System (Grouped Lists, große Titel, Pill-Buttons, Tab-Bar mit Icons, Light/Dark Mode). ✅
- **Phase 4 (Kernfeature)** — Anpassungslogik: `reconcile.ts` (Auto-Matching Aktivität↔geplante Einheit), 4 Regeln mit Prioritätsreihenfolge (langer Ausfall > verpasste Woche > einzelne verpasste Einheit > Overtraining-Guard als Querschnittscheck), `plan_adjustments`-Audit-Log mit Begründungstext auf der Planseite, lazy Neuberechnung beim Öffnen der Startseite, Wochenseite mit Status je Einheit + manuellem Override. 7 Vitest-Fixtures (alle 4 geforderten Szenarien). ✅
- **Phase 5** — PWA-Feinschliff: echte Icons mit "GC"-Wortmarke, Service Worker für Offline-Fallback (read-only, network-first mit Cache-Fallback), Standalone-Modus. ✅
- **Selbst-Review-Bugfixes** — Plan-Regeneration-Reihenfolge (Race Condition bei zwei gleichzeitig aktiven Plänen behoben + DB-Constraint), Service-Worker-Härtung (kein Caching von Fehlerantworten, keine unhandled rejections). ✅

## Trainingswissenschaftliche/Produkt-Annahmen — noch vom Nutzer zu prüfen

Alle mit `source: "TODO: cite"` markiert in `packages/training-engine/src/config/training-science.config.ts`:

- `zoneMethodology`, `hrZones` (5 Zonen, Grenzwerte)
- `loadModel` (Edwards-Score-Gewichtung, 28-Tage-CTL-Fenster statt der üblichen 42 Tage — war expliziter Nutzerwunsch)
- `intensityDistribution` (80/20-Ziel, Zonen-Mapping)
- `rampRate` (10 %-Regel)
- `deload` (3:1-Kadenz, 35 % Reduktion)
- `phaseLengths` (Base/Build/Specific/Taper-Verhältnisse)
- `planning`-Sektion: `defaultPeakWeeklyVolumeKm: 60`, `longRunPctOfWeeklyVolume: 0.32`, `longRunMaxKm: 32`, `taperRaceWeekVolumePct: 0.4`, die vier `weeklyTemplates` — **komplett geschätzt, nicht auf den Nutzer kalibriert**
- `adaptationThresholds`: `consecutiveMissedDaysForVolumeReduction: 3`, `overreachAcwrThreshold: 1.5`, `volumeReductionOnMissedWeekPct: 20`, `missedWeeksForPhaseRegression: 3`, `recoveryWeekVolumeReductionPct: 35`

**Bewusste Scope-Entscheidung (noch nicht umgesetzt):** Geplante Einheiten tragen nur `workoutType` + `targetDistanceKm`, keine berechneten Pace-/Puls-Zielbereiche (`targetPaceRange`/`targetHrZone` bleiben `null`). Bräuchte ein eigenes Zonen-Ableitungsmodul — bewusst für v1 zurückgestellt, sollte mit dem Nutzer besprochen werden, falls gewünscht.

## Zwei Produktentscheidungen (keine Trainingswissenschaft, aber wichtig fürs Verhalten)

1. **Automatische Aktivitäts-Verknüpfung**: `reconcile.ts` verknüpft geplante Einheiten nur anhand von Datum + Sportart "run", keine manuelle Auswahl-UI. Bei zwei Läufen am selben Tag wird der erste unverknüpfte genommen.
2. **Overtraining-Erholungswoche**: Da das Renndatum fix ist, wird bei Übertraining die *nächste ohnehin anstehende* Woche zur Erholungswoche umgewandelt (nicht buchstäblich eine Extra-Woche eingeschoben).

## Was fehlt / mögliche nächste Schritte

Der ursprüngliche Plan (Phasen 0–5) ist komplett durch. Mögliche Folgearbeiten, falls der Nutzer will:

- Trainingswissenschaftliche Annahmen oben gemeinsam durchgehen und kalibrieren
- Pace-/Puls-Zielbereiche pro Einheit (aktuell bewusst ausgelassen, siehe oben)
- Manuelle Aktivitäts-Zuordnung-UI (falls Auto-Matching in der Praxis nicht reicht)
- Echtes Testen der Phase-4-Anpassungslogik mit echten/simulierten verpassten Einheiten in Produktion
- Alles, was der Nutzer nach dem Durchklicken der App zurückmeldet

## Arbeitsweise in diesem Projekt (für die neue Session wichtig)

- Nach jeder inhaltlichen Änderung: `pnpm -r typecheck && pnpm -r lint && pnpm -r test`, bei App-Änderungen zusätzlich `pnpm --filter @garmincoach/training-engine boundary-check` und ein Produktions-`build` (mit Platzhalter-Env-Vars: `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`), bevor committet wird.
- Commits + Push direkt auf `claude/friendly-carson-qmhhv1`, kein PR-Workflow bisher.
- Jede trainingswissenschaftliche Annahme, die neu hinzukommt, braucht ein `source`-Feld in `training-science.config.ts` (auch als `"TODO: cite"` ok) und muss dem Nutzer explizit gemeldet werden — das hat er ausdrücklich so gewünscht.
- UI-Design: iOS/Apple-Look, Design-Tokens in `apps/web/app/globals.css` (Grouped Background, Card-Oberfläche, Akzentfarbe `#0f624a`, Separator/Fill/Status-Farben, Light+Dark Mode).
