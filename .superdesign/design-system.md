# Barlicious Team-app — Field Ops Design System

## Product context
Barlicious Operations is a Dutch/Belgian B2B field-ops PWA for catering/koelverhuur teams. Admins plan staffing, approve GPS timesheets, and control the day; employees clock in/out on site, confirm assignments, and report incidents. Primary language: Dutch (nl-BE). Secondary: French.

## Key surfaces
1. **Login** — invited accounts only; email/password + Google; password reset
2. **Admin shell / Controle** — topbar + horizontal tabs; Controle dashboard = KPIs, today's staffing, timesheet approval, payroll/invoice CSV, notifications
3. **Employee Vandaag** — mobile-first; bottom nav; clock in/out + planned shifts + today's assignments

## Visual direction (non-negotiable)
- Professional futuristic B2B field-ops — NOT a demo starter, NOT light grey SaaS
- Dark base: `#040a0f` / `#071017` backgrounds; raised surfaces `#0d1821`–`#172933`
- Cyan/teal accents: `#38bfd0` / `#5ad4df`; primary CTA = cyan gradient with near-black text `#021014`
- Restrained glass/neon: subtle backdrop blur, thin accent hairlines, soft cyan glow — no loud neon overload
- Typography: Outfit for display titles; Plus Jakarta Sans for UI body
- Radius: 10 / 14 / 18px; borders translucent blue-grey 16%
- Semantic chips: success `#49ce93`, warning `#efb65f`, danger `#f0717e`
- Mobile-first touch targets ≥44px; employee bottom nav accounts for safe-area
- Strong visual hierarchy: eyebrow → title → muted lead → dense actionable cards
- Dutch labels on all primary UI copy

## Motion
Short focus/hover transitions only (~120ms). No page-entry animation theater.

## Component patterns
- Cards: `.ops-card` gradient dark panels
- Panels: `.ops-panel` softer inset blocks
- Inputs: `.ops-input` deep inset fields with cyan focus ring
- Buttons: `.ops-btn-primary` / secondary / danger
- Nav: `.ops-nav` + `.ops-nav-btn` / `-active`
- Brand mark: rounded square with compass/route logo (`public/brand-logo.svg` = `public/team-app-logo.svg`) + cyan ring — never the plain B mark

## Logo
Use the compass/route mark (`public/brand-logo.svg` / `public/team-app-logo.svg`, identical md5). Never substitute the plain B logo, initials, emoji, or invented SVGs.


## Do not
- Invent pink/purple gradients, serif display fonts, or light marketing landing aesthetics
- Flatten hierarchy into equal-weight grey boxes
- Drop Dutch labels for English placeholder copy
