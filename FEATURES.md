# Feature checklist: v85 → new look (option A)

The new look **re-skins** v85; it does not rebuild it. `app.js` is unchanged, so every save, sync and calculation works exactly as before. Two files are added (`theme.css`, `nav.js`), and `index.html` and `sw.js` only gain the lines that load them.

## Where everything is now

| v85 | New look: phone | New look: desktop (≥ 900px wide) |
|---|---|---|
| Dogs → Profiles (Today's board, search, all dogs, register) | **Today** tab | Sidebar → Dogs → Today & dogs |
| Dogs → Calendar (month / week / hour, check dates) | **Calendar** tab | Sidebar → Calendar |
| Dogs → Bookings | **Bookings** tab | Sidebar → Bookings |
| Dogs → Activities | More → Activities | Sidebar → Activities |
| Feeding board (button on Today's board) | Still on the board, plus **+** → Feeding board, and More → Feeding board | Sidebar → Feeding board |
| Check dates (🔎 on Calendar) | Still on Calendar, plus **+** → Check dates, and More → Check dates | Sidebar → Check dates |
| Customers → To-Do | **To-do** tab, with the count badge | Sidebar → To-do, with the count badge |
| Customers → Templates / Quote / Rates | More → … | Sidebar → Customers → … |
| Business → Analysis / Costs / P&L / Training | More → … | Sidebar → Business → … |
| Settings (text size, Google Sheets, PIN, create sheet structure) | Settings button (top right), or More → Settings | Same |
| Sync | Sync button (top right), or More → Sync | Same |
| Section sub-tabs (Profiles / Calendar / Bookings / Activities …) | Still shown as a chip row under the header | Same |
| Dog profile, register / edit, all modals and pop-ups | Unchanged; reached the same way | Unchanged |
| Register new dog, new booking | Same buttons as before, plus **+** → Register a new dog / New booking | Same |

New in this version: a bottom tab bar (phone) and sidebar (desktop), a **+** button, **Appearance** (Light / Dark / Auto) and **I am** (Katie / Osbert) in Settings. "I am" is only remembered on the device for now; logs do not record it yet, because that needs a new `By` column in the sheet.

## How it was checked

Automated run in headless Chrome at 390px (phone) and 1280px (desktop), against a fake Google Sheet so no real data was touched:

- All 110 functions that buttons call (`onclick="…"`) still exist.
- Every destination in the tab bar, More sheet and sidebar opens the right v85 screen: board, calendar, bookings, activities, check dates, to-do, templates, quote, rates, analysis, costs, P&L, training.
- The **+** → New booking action opens the v85 booking form.
- Light and dark mode switch, and the setting is remembered.
- No JavaScript errors, no alerts, no sideways scrolling.

Not checked: saving to a real Google Sheet (unchanged code), real phones, and every pop-up in dark mode. Some old inline colours may still look off in dark mode; report any you see.
