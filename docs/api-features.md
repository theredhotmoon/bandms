# BandMS — Full API Feature Documentation

> Used for: frontend E2E test writing · Claude Design brief (public section)

---

## PUBLIC FEATURES (no auth required)

### Band Profile

| Endpoint | Purpose |
|---|---|
| `GET /api/band-profile` | Full band profile with members & social links |
| `GET /api/band-profile/epk` | EPK snapshot (published or live-built) |
| `GET /api/band-profile/calendar/availability` | Booking availability calendar |
| `GET /api/band-profile/members` | All band members (current first, ordered by sort_order) |
| `GET /api/band-profile/social-links` | Band's social media links |

**Band profile fields:**
```
id, name,
bio_short (max 280), bio_medium, bio_long, bio_full,
formation_year, hometown, genres, comparable_artists, artistic_statement,
booking_email, press_email, tech_contact_phone, tech_contact_email, tech_rider_notes,
career_level (1–4),
stat_spotify_monthly, stat_instagram_followers, stat_tiktok_followers,
stat_youtube_subscribers, stat_facebook_followers, facebook_likes, facebook_likes_synced_at,
tech_rider_url (PDF), stage_plot_url (image),
epk_release_id, epk_album_id,
members[], social_links[]
```

**Band member fields:**
```
id, first_name, last_name, nickname, bio, photo (URL), role,
is_current (bool), joined_at, quit_at, sort_order, calendar_url,
can_login (bool),
instruments[]: { id, name, category }
social_links[]: { id, platform, url }
default_gear (JSON)
```

**Social link platforms:** `spotify | instagram | facebook | youtube | tiktok | bandcamp | soundcloud | twitter | website`

---

### Concerts

| Endpoint | Purpose |
|---|---|
| `GET /api/concerts` | All concerts ordered by date then start_time |
| `GET /api/concerts/{id}` | Single concert with full relations |
| `GET /api/concerts/{id}/setlist` | Setlist for a concert |

**Concert fields:**
```
id, date (Y-m-d), doors_open (H:i), sound_check_time (H:i), start_time (H:i),
own_sort_order, description (max 2000), poster_url,
venue: { id, name },
bands[]: { id, name, website, sort_order, play_time },
tags[]: { id, name, slug },
links[]: { id, label, url },
created_at, updated_at
```

---

### Posts (Blog / News)

| Endpoint | Params |
|---|---|
| `GET /api/posts` | `?search=query&tag_id=5` (pagination optional) |
| `GET /api/posts/{id}` | Full post with all relations |

**Post fields:**
```
id, title, slug, intro, content, image (base64),
published_at, event_date,
tags[], links[]: { id, type (youtube|instagram|facebook|normal), url, label },
concerts[], albums[], releases[], tours[], music_videos[], press_releases[]
```

---

### Releases (Discography)

| Endpoint | Purpose |
|---|---|
| `GET /api/releases` | Summary list ordered by release_date desc |
| `GET /api/releases/{id}` | Full release with tracks, links, photos |

**Release fields:**
```
id, title, type (LP|EP|single|compilation),
release_date (Y-m-d), description, cover_image (path),
is_upcoming (bool), presave_url,
links[]: { platform (spotify|apple_music|bandcamp|youtube|instagram), url },
tracks[]: {
  id, title, duration, lyrics, sort_order,
  bpm, musical_key, mood_tags, isrc, explicit (bool), stems_available (bool),
  sync_placements, links[]
},
photos[]: { id, image_url, sort_order, caption }
```

---

### Albums (Photo Galleries)

| Endpoint | Purpose |
|---|---|
| `GET /api/albums` | List ordered by taken_at desc |
| `GET /api/albums/{id}` | Full album with all photos |

**Album fields:**
```
id, title, slug, description,
taken_at, published_at,
venue: { id, name }, concert: { id, date, description },
tags[],
photos[]: { id, image_url, sort_order, caption, epk_featured },
photo_count, cover_url
```

---

### Photos

| Endpoint | Purpose |
|---|---|
| `GET /api/photos` | All photos ordered by sort_order |
| `GET /api/photos/{id}` | Single photo with album |

**Photo fields:** `id, image_url, sort_order, caption, epk_featured (bool), album: { id, title }`

---

### Music Videos

| Endpoint | Purpose |
|---|---|
| `GET /api/music-videos` | List ordered by sort_order |

**Video fields:**
```
id, title, video_url,
published_at, sort_order,
og_title, og_image (thumbnail), og_site_name (provider), channel_name,
view_count, views_synced_at
```

---

### Tours

| Endpoint | Purpose |
|---|---|
| `GET /api/tours` | Tour list ordered by start_date desc |
| `GET /api/tours/{id}` | Full tour with images, links, concerts |

**Tour fields:**
```
id, name, description, start_date, end_date, poster (URL),
images[]: { id, url, caption, sort_order },
links[]: { id, label, url },
concerts[]: { id, date, venue_name }
```

---

### Press Releases

| Endpoint | Purpose |
|---|---|
| `GET /api/press-releases` | List ordered by published_at desc |
| `GET /api/press-releases/{id}` | Full press release with relations |

**Press release fields:**
```
id, url (external link),
og_title, og_description, og_image, og_site_name,
published_at, featured (bool),
concerts_count, posts_count, albums_count, releases_count, tours_count, authors_count,
concerts[], posts[], albums[], releases[], tours[], tags[]
```

---

### Tags & Instruments & Authors

```
GET /api/tags           → [{ id, name, slug }]
GET /api/tags/{id}      → single tag
GET /api/instruments    → [{ id, name, category }] — ordered by category, name
GET /api/authors        → [{ id, name, email, facebook, instagram, ... }]
GET /api/authors/{id}   → single author
```

---

### Tech Rider (Active — public)

```
GET /api/tech-riders/active → {
  id, name, is_active,
  gig_lineup (JSON),
  stage_plot_data (JSON),
  inputs[], monitors[], backline[], pa_foh, power, rf_wireless[]
}
```

---

### Auth & Newsletter

```
POST /api/auth/login        → { token, user }     (rate-limited: 10/min)
POST /api/auth/logout       → { message }          (requires auth)
POST /api/newsletter/subscribe → success/409        (rate-limited: 5/min)
  Body: { email*, name, source }
GET  /api/health            → { status, checks }
```

---

## MEMBER FEATURES (auth + member role)

Members can read/write **their own** band member record and setups.

```
GET    /api/band-profile/members/{member}/setups
POST   /api/band-profile/members/{member}/setups
GET    /api/band-profile/members/{member}/setups/{setup}
PUT    /api/band-profile/members/{member}/setups/{setup}
DELETE /api/band-profile/members/{member}/setups/{setup}
PUT    /api/band-profile/members/{member}   (own record only)
```

**Member setup fields:**
```
id, band_member_id, instrument_id, name,
signal_chain_type, inputs[], monitor, backline, power, wireless[], foh_notes
```

---

## ADMIN FEATURES (auth + admin role)

### Band Profile Management

```
PUT    /api/band-profile                          (update all fields)
POST   /api/band-profile/tech-rider               (upload PDF, max 10 MB)
DELETE /api/band-profile/tech-rider
POST   /api/band-profile/stage-plot               (upload image, max 4 MB)
DELETE /api/band-profile/stage-plot
POST   /api/band-profile/sync-facebook-likes      (sync FB page likes)
GET    /api/band-profile/calendar/events          (all calendar events)
PUT    /api/band-profile/members/reorder          (body: { ids: [] })
POST   /api/band-profile/members                  (create member)
POST   /api/band-profile/members/{member}/photo   (upload photo)
DELETE /api/band-profile/members/{member}
PUT    /api/band-profile/social-links             
POST   /api/band-profile/social-links             (body: { platform, url })
PUT    /api/band-profile/social-links/{link}
DELETE /api/band-profile/social-links/{link}
GET    /api/band-profile/member-setups            (all setups for all members)
```

### Content CRUD

```
POST/PUT/DELETE /api/concerts/{id}
POST/DELETE     /api/concerts/{id}/poster

POST/PUT/DELETE /api/posts/{id}

POST/PUT/DELETE /api/releases/{id}
POST/DELETE     /api/releases/{id}/cover
POST            /api/releases/{id}/photos
DELETE          /api/releases/{id}/photos/{photo}
PUT             /api/releases/{id}/photos/reorder  (body: { order: [id,...] })

POST/PUT/DELETE /api/albums/{album}
POST            /api/albums/batch                  (creates album + uploads photos)
POST            /api/albums/{album}/photos         (add photos to album)
DELETE          /api/albums/{album}/photos/{photo}
PUT             /api/albums/{album}/photos/reorder (body: { order: [id,...] })

POST/PUT/DELETE /api/photos/{photo}

POST/PUT/DELETE /api/tours/{tour}

POST/DELETE     /api/press-releases/fetch-meta     (scrape OG tags from URL)
POST/PUT/DELETE /api/press-releases/{id}

POST/PUT/DELETE /api/music-videos/{id}
POST            /api/music-videos/{id}/fetch-preview (fetch OEmbed data)
POST            /api/music-videos/sync-views          (sync YouTube view counts)

POST/PUT/DELETE /api/tags/{tag}
POST/PUT/DELETE /api/venues/{venue}
POST/PUT/DELETE /api/bands/{band}
POST/PUT/DELETE /api/instruments/{instrument}
POST/PUT/DELETE /api/authors/{author}
```

### Songs & Setlists

```
GET/POST/PUT/DELETE /api/songs/{song}

GET/POST            /api/setlists
GET/PUT/DELETE      /api/setlists/{setlist}
POST                /api/setlists/{setlist}/items       (body: { song_id })
PUT                 /api/setlists/{setlist}/items/reorder
PUT                 /api/setlists/{setlist}/items/{item}
DELETE              /api/setlists/{setlist}/items/{item}
POST                /api/setlists/import-setlistfm

GET                 /api/setlists/setlistfm/search?q=artist
GET                 /api/setlists/setlistfm/{mbid}/setlists
```

### Tech Riders

```
GET    /api/tech-riders
POST   /api/tech-riders        (body: { name, is_active, gig_lineup, stage_plot_data, inputs, ... })
GET    /api/tech-riders/{id}
PUT    /api/tech-riders/{id}
POST   /api/tech-riders/{id}/activate
DELETE /api/tech-riders/{id}
```

### EPK Versions

```
GET    /api/epk-versions
POST   /api/epk-versions                    (creates snapshot of current profile)
POST   /api/epk-versions/{version}/publish  (only pending → published, archives previous)
DELETE /api/epk-versions/{version}          (only pending can be deleted)
```

### Users & Newsletter

```
GET/POST/PUT/DELETE /api/users/{user}
GET/DELETE          /api/newsletter-subscribers/{id}
```

---

## PUBLIC SITE — PAGE INVENTORY

| Page | Data source | Key content |
|---|---|---|
| **Home** | band-profile, concerts, releases | Hero, bio_short, next 3 shows, featured release, social links |
| **About** | band-profile, members | bio_long/full, formation_year, hometown, genres, comparable_artists, member grid |
| **Concerts** | concerts | List/calendar, venue, times, poster, bands, ticket links |
| **Concert Detail** | concerts/{id}, setlist | Full info + setlist |
| **Music / Releases** | releases | Discography by type, streaming links, presave |
| **Release Detail** | releases/{id} | Cover, tracks, photos |
| **Music Videos** | music-videos | Embedded players, channel, view count |
| **Gallery** | albums, photos | Album grid, lightbox, captions |
| **Tours** | tours | Name, dates, concerts, images |
| **News / Blog** | posts | Search, tag filter, pagination |
| **Post Detail** | posts/{id} | Full content, related concerts/releases/videos |
| **Press** | press-releases | OG image cards linking to external articles |
| **Band Members** | members | Current (featured) + former, instruments, social links |
| **EPK** | band-profile/epk | Combined press kit page, downloadable |
| **Booking/Tech** | band-profile, tech-riders/active | Contact, tech rider download, stage plot, inputs summary |

---

## DESIGN BRIEF (Public Section)

### Audiences
1. **Fans** — recent news, upcoming shows, photos, social following
2. **Venue bookers** — tech specs, available dates, booking contact, rider PDF
3. **Press / industry** — EPK, bio variants, streaming stats, press releases, member bios
4. **Music professionals** — discography detail (ISRC, BPM, keys, stems, sync placements)

### Key Sections

**Hero**: Band name, visual identity, genre, one CTA (Upcoming Shows / Listen / Watch)

**Quick links bar**: next concert, latest release, newsletter signup

**About / Bio**: Switchable bio length (short → full), genre badges, social stats chips, formation year + hometown, comparable artists

**Members grid**: Photo, name, role, instruments — current members prominent, former expandable

**Discography**: Cover grid, type filter (LP/EP/Single), release_date, streaming links, presave CTA for upcoming

**Concerts / Events**: List/calendar toggle, venue + time, poster, bands on bill, ticket link, past/upcoming toggle

**Gallery**: Album grid (cover = first photo), click to open lightbox, EPK-tagged photos have badge

**Music Videos**: Responsive embed grid, channel name, view count, sortable

**Press**: OG image cards → external link, site name, publication date, featured highlighted

**Tours**: Timeline with date range, tour image carousel, concerts in tour list

**News / Blog**: Search bar, tag filter chips, paginated cards (title, excerpt, image, date)

**Booking / Tech**: Contact emails, PDF download buttons (tech rider, stage plot), key specs summary

**EPK page**: Standalone presskit — bio, featured album, EPK photos, press quotes, stats, download

### Component Library (reusable)

- `PostCard` — image, title, intro, date, tags
- `ConcertCard` — date, venue, time, poster, buttons
- `ReleaseCard` — cover, title, type, year, streaming links
- `MemberCard` — photo, name, role, instruments, social icons
- `VideoEmbed` — responsive iframe, title, channel, views
- `PressCard` — og_image, og_title, og_site_name, published_at, external link
- `AlbumGrid` — cover, title, caption, click to open
- `TourCard` — name, date range, poster, concert count

### Data → UI mapping for E2E tests

```
# Critical field presence checks:
band-profile.name               → page title / hero heading
band-profile.bio_short          → meta description / hero subtitle
band-profile.social_links[]     → social icon links in header/footer
concerts[].date                 → show date display
concerts[].venue.name           → show venue label
concerts[].poster_url           → concert poster image src
posts[].title                   → news card heading
posts[].published_at            → news card date
releases[].cover_image          → album cover img src
releases[].type                 → badge label (LP / EP / Single)
releases[].links[].platform     → streaming button labels
music-videos[].video_url        → embedded iframe src
albums[].photos[].image_url     → gallery img src
members[].photo                 → member card img src
members[].is_current            → separates current from former list
press-releases[].og_image       → press card thumbnail
press-releases[].url            → press card external link href
tours[].start_date/end_date     → tour date range display
```

---

## VALIDATION RULES (for E2E form tests)

| Field | Rule |
|---|---|
| `email` | required, valid email format |
| `band-profile.name` | required, max 255, no empty string |
| `band-profile.bio_short` | nullable, max 280 |
| `band-profile.career_level` | nullable, integer 1–4 |
| `concert.venue_id` | required, must exist in venues |
| `concert.date` | required, Y-m-d format |
| `concert.start_time` | nullable, H:i format |
| `release.type` | required, in: LP, EP, single, compilation |
| `release.links.*.platform` | in: spotify, apple_music, bandcamp, youtube, instagram |
| `post.title` | required, string |
| `newsletter.email` | required, valid email |
| `song.bpm` | nullable, integer 20–400 |
| `song.duration_sec` | nullable, integer 1–7200 |
| `auth.password` | required, string |
| `file uploads (PDF)` | mimes:pdf, max 10 MB |
| `file uploads (image)` | image, max 4 MB |

---

*Generated 2026-06-03 — covers 92 API routes across 31 controllers*
