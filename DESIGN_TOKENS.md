# Barlicious Operations UI tokens

- Background: `#071017`; deep background: `#040a0f`
- Surfaces: `#0d1821`, `#12212c`, `#172933`
- Text: `#edf7f9`; muted: `#adc4cd`; subtle: `#8aa3ae`
- Accent: `#38bfd0`; accent highlight: `#5ad4df`
- Semantic: success `#49ce93`, warning `#efb65f`, danger `#f0717e`
- Borders: translucent blue-grey at 24%; accent borders at 44%
- Radius scale: 10px / 14px / 18px
- Motion: short focus/hover transitions only; all page-entry motion removed

Outdoor readability: muted/subtle text, borders, and chip label colors are slightly raised versus the initial dark theme while keeping the futuristic B2B cyan look.

## Reusable interface classes

- Surfaces: `.ops-card`, `.ops-panel`
- Text helpers: `.ops-muted`, `.ops-subtle`
- Form controls: `.ops-input`
- Actions: `.ops-btn-primary`, `.ops-btn-secondary`, `.ops-btn-danger`
- Status: `.ops-chip-success`, `.ops-chip-warning`, `.ops-chip-danger`, `.ops-chip-info`
- Navigation: `.ops-nav`, `.ops-nav-btn`, `.ops-nav-btn-active` (admin uses `.admin-nav.ops-nav`)

Primary actions use a restrained cyan surface with near-black text for dependable outdoor contrast. Navigation and primary actions keep a minimum 44px touch target; the employee navigation also accounts for the device safe area. Admin nav scrolls horizontally and does not flex-shrink tab labels.
