# Grace Banquet — Frontend

Static site. No backend, no database. The booking/CRM system stays offline
on the admin machine; this site only collects enquiries and hands them to WhatsApp.

## Stack
- Plain HTML / CSS / vanilla JS — no build step, no dependencies
- Fonts: Outfit (display) + Inter (body), Noto Nastaliq Urdu (Urdu CTA) — all Google Fonts
- Palette: navy #1B2A4A + gold #C9A227 + cream #FAF7F1

## Files
```
index.html         Home
venue.html         The Venue — specs, amenities, stages, slots
services.html      Weddings / Private / Corporate / Custom
gallery.html       Filterable gallery + lightbox
about.html         1994 story, stats, testimonials
book-a-tour.html   Enquiry form + Urdu CTA + contact + map
contact.html       Same form, contact-first framing
css/style.css      All styles (tokenised at the top)
js/main.js         Nav, reveal, gallery, testimonials, form
images/            REPLACE ALL — currently placeholders
```

## Deploy to Spaceship
1. Zip the folder contents (not the folder itself)
2. cPanel → File Manager → `public_html` → upload → extract
3. Point gracebanquet.pk at the hosting account
4. Issue the free SSL after DNS resolves

No PHP, no database, no document-root change needed.

## Before launch — required
- [ ] **Replace every image in `images/`** — all are placeholders
- [ ] Replace 3 placeholder testimonials in `index.html` + `about.html`
- [ ] Confirm Google Maps embed points at the right pin
- [ ] Add real `og.jpg` (1200x630) for link previews
- [ ] Decide: Grace Lawnz → Grace Banquet on Facebook/Instagram
- [ ] Replace `images/logo.png` with a high-res mark (current is a 50px favicon)

## Config
WhatsApp number is set in **one place** — `js/main.js`, line ~11:
```js
var WA_NUMBER = '923042511451';
```
Hardcoded `wa.me` links also appear in each page's footer and float button.

## Image specs
| Slot | Size | Notes |
|---|---|---|
| `hero-*.jpg` | 1920×1080 | Dark-ish; navy gradient overlays at 45–72% |
| `service-*.jpg` | 1200×900 | 3:2 crop safe |
| `stage-1..4.jpg` | 1200×900 | One per decorated stage |
| `gallery/g1..12.jpg` | 1000×750+ | Categories: stages, setups, seating, night |
| `og.jpg` | 1200×630 | Social preview |

Gallery categories are set per-tile via `data-cat` in `gallery.html`.
