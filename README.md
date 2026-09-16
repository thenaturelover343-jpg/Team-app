# Barlicious & Koelverhuur Team App

Beveiligde PWA voor teamplanning, opdrachten en tijdregistratie. De frontend gebruikt React en Firebase. Vertrouwde acties zoals uitnodigen, rollen wijzigen en in-/uitklokken lopen via Cloud Functions.

## Beveiligingsmodel

- Geen openbare registratie: een beheerder nodigt medewerkers uit.
- Rollen en accountstatus staan in Firebase Auth custom claims.
- In- en uitklokken gebruikt servertijd en een transactioneel `active_shifts`-slot.
- `time_events` en `audit_events` zijn onveranderbaar voor webclients.
- Productie-callables vereisen Firebase App Check.
- Firestore-regels worden in de Emulator Suite getest.

De Firebase-webconfiguratie bevat publieke projectidentificatie en hoort per omgeving in een lokaal `.env`-bestand. Privésleutels of service-accountbestanden mogen nooit in Git worden opgeslagen.

## Lokaal starten

Vereisten: Node.js 22 en Java 21.

1. Kopieer `.env.development.example` naar `.env.local` en vul de Firebase-webconfiguratie in.
2. Installeer beide projecten:

   ```bash
   npm ci
   npm ci --prefix functions
   ```

3. Start Firebase-emulators in een terminal:

   ```bash
   npx firebase emulators:start
   ```

4. Start de app in een tweede terminal:

   ```bash
   npm run dev
   ```

## Eerste beheerder instellen

Er staat bewust geen beheerderse-mailadres in de broncode. Maak eerst het Auth-account aan in de juiste Firebase-console. Gebruik daarna Application Default Credentials met toegang tot het betreffende project:

```bash
gcloud auth application-default login
npm --prefix functions run bootstrap-admin -- --email=beheerder@voorbeeld.be --project=jouw-firebase-project --database=jouw-database-id
```

Het script zet de beveiligde claims, maakt of actualiseert het profiel en schrijft een auditgebeurtenis. De beheerder moet na een claimwijziging opnieuw inloggen.

## Bestaande medewerkers migreren

Na het instellen van de eerste beheerder:

1. Open **Team**.
2. Nodig ieder bestaand e-mailadres opnieuw uit.
3. De backend hergebruikt het bestaande Auth-account, zet de veilige claims en activeert het profiel.
4. Deel de gegenereerde wachtwoord-/activatielink uitsluitend met de juiste medewerker.

Voer deze migratie uit vóór de nieuwe Firestore-regels in productie worden afgedwongen.

## App Check en omgevingen

Maak aparte Firebase-projecten en reCAPTCHA-sleutels voor ontwikkeling/staging en productie. Vul `VITE_RECAPTCHA_SITE_KEY` in. Cloud Functions schakelt App Check alleen in productie afgedwongen in; de Functions Emulator wordt hiervan uitgezonderd.

`APP_URL` is een Functions-parameter en bepaalt de toegestane terugkeer-URL van activatielinks. Firebase vraagt deze waarde bij de eerste deploy. Gebruik voor iedere Firebase-projectalias de juiste URL.

## Controleren

```bash
npm run lint
npm run test
npm run test:rules
npm run build
npm --prefix functions run build
```

GitHub Actions voert dezelfde controles uit bij pushes naar `main` en bij pull requests.

## Veilige uitrolvolgorde

1. Maak en configureer development/staging en productie.
2. Activeer e-mail/wachtwoord-authenticatie.
3. Registreer de webapp bij App Check en vul de omgevingsvariabelen in.
4. Maak het eerste Auth-account en voer `bootstrap-admin` uit.
5. Deploy Functions, rules en indexes eerst naar staging:

   ```bash
   npx firebase use development
   npx firebase deploy --only functions,firestore:rules,firestore:indexes
   ```

6. Migreer bestaande medewerkers en voer een praktijktest uit.
7. Herhaal pas daarna voor productie.

Maak vóór de productie-uitrol een Firestore-export. De repository kan niet aantonen welke regels of gegevens momenteel in het Firebase-project zijn gedeployed.
