# Barlicious Team-app

Veld-app voor Barlicious-operaties: inklokken met GPS, planning, klanten, uren, invites en push.

Live: https://barlicious-team-app.thenaturelover343.workers.dev  
Repo: https://github.com/thenaturelover343-jpg/Team-app

## Wat het doet

- Medewerker: vandaag-planning, inklokken/uitklokken, pauze, opdrachten, incidenten, profiel
- Beheerder: control center, weekplanner, jobs, uren, klanten, team, correcties
- Auth: e-mail/wachtwoord (Outlook/Gmail/Hotmail), invite-link `/?invite=TOKEN`, optioneel Google
- Eerste gebruiker of `BOOTSTRAP_ADMIN_EMAIL` wordt admin
- Medewerkers zien alleen toegewezen klanten
- PWA + update-banner via `public/app-version.txt`

## Stack

React 19 · Vite / Vinext · Cloudflare Worker · D1 · Firebase Auth · PWA

## Productie-pinnen (niet wijzigen zonder rollback-plan)

| Binding | Waarde |
|---|---|
| Worker | `barlicious-team-app` |
| D1 binding | `DB` |
| D1 name | `team-app` |
| D1 id | `73a03a39-22d7-4c60-b263-320b42a2f4dd` |
| Bootstrap admin | `thenaturelover343@gmail.com` (var `BOOTSTRAP_ADMIN_EMAIL`) |
| Firebase authorized domain | `barlicious-team-app.thenaturelover343.workers.dev` |
| authDomain (prod) | zelfde Worker-host (`/__/auth` proxy) |
| VAPID | Worker **secrets** (`VAPID_*`), niet in git |

Bron van waarheid: `.openai/hosting.json` → `vite.config.ts` → `dist/server/wrangler.json`.  
`npm run build` draait daarna `scripts/ensure-d1-binding.mjs`. **Nooit** deployen met `"d1_databases": []`.

## Lokaal

Node `>=22.13.0`.

```sh
pnpm install   # of npm run install:ci
npm run dev
npm test
```

## Deploy

Bump eerst `public/app-version.txt`, daarna:

```sh
npm run deploy:worker
```

Volgorde:

1. build
2. `ensure:d1` — pin D1 + bootstrap-mail + worker-naam
3. `wrangler deploy` vanuit `dist/server/wrangler.json`
4. live verify (`scripts/verify-live-employee-ui.mjs`)

Handmatig:

```sh
npm run verify:live-employee-ui
```

De verify faalt als oude copy terugkomt (`Mijn Beschikbaarheid` / `Weekoverzicht` zonder `Mijn Planning Vandaag` / `Vandaag`).

## Klanttijd als de app dicht is

De website en het beginscherm-icoon meten alleen zolang het scherm open is. iPhone laat een website geen locatie meten op de achtergrond. Daarvoor is de geïnstalleerde app (`be.barlicious.team`) één keer nodig, met locatie op **Altijd**.

Tijdens een gestarte werkdag zet die app een cirkel van 200 m rond elke opdracht met coördinaten. Twee minuten binnen = aankomst, vertrek = vertrek. Pauze en einde dag zetten het uit. Na zestien uur stopt het vanzelf. Twee klanten in dezelfde cirkel: de telefoon vraagt een keuze en gokt niet.

De cirkels staan in de telefoon-app. De site in die app komt van de worker. Eerst deze branch mergen en `npm run deploy:worker`, daarna de app op de telefoon zetten. Zonder die deploy laadt de geïnstalleerde app de oude site en zet ze nog geen cirkels.

`ios/` en `android/` zitten in de repo (`be.barlicious.team`). Op een Mac of pc met de SDK:

```sh
pnpm install
npm run native:sync
```

- iPhone: CocoaPods + Xcode + Apple Developer. Daarna TestFlight of een rechtstreekse install. Locatie op **Altijd**.
- Android: Android Studio. Locatie op “Altijd toestaan”. Play Console vraagt een verklaring voor achtergrondlocatie.

`npm run native:add` is alleen nodig als de mappen `ios/` of `android/` ontbreken. De plugin zelf staat in `native/visit-fence`.

## Tests

```sh
npm test
```

Dekking:

- `tests/security.test.ts` — geofence, transitions, admin-bootstrap, invites
- `tests/privacy.test.ts`
- `tests/invite-link.test.ts`
- `tests/clockin-snapshot.test.ts` — snapshot-auth header + clock-in regels (al actief, verkeerde dienst, geofence)

Clock-in regels staan in `server/clockInRules.ts` (zelfde pre-DB checks als `/api/team`).

## UI-structuur

- `src/EmployeeView.tsx` — shell + tabs
- `src/employee/` — dashboard, planning, reports, profiel, assignment card
- `src/AdminView.tsx` — shell + tabs
- `src/admin/` — jobs, uren, klanten, reports, assignment card
- `app/api/team/route.ts` — Worker API

## Firebase / iOS PWA

Productie gebruikt first-party `authDomain` + Worker-proxy `worker/firebase-auth-proxy.ts` (`/__/auth/*`).  
Zonder die proxy bounce’t Google-login in de geïnstalleerde iPhone-PWA terug zonder sessie.

## Niet doen

- D1-binding leeg deployen
- Live Worker updaten zonder `verify:live-employee-ui`
- Open feature-PRs mergen die nog op een oude `main` SHA staan zonder rebase
