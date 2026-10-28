# Composer audit — 2026-10-28

`composer audit --locked` against `api/composer.lock` (run in `composer:2`;
the host has no PHP):

```bash
cd api && MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/app" -w /app composer:2 audit --locked
```

**52 advisories across 14 packages.** Only `laravel/framework` is a direct
dependency; the other 13 are pulled in through it. Status: **not fixed —
deferred.**

## The blocker: Laravel 11 has no patched release

Every Laravel advisory is fixed only on 12.x / 13.x. `composer.json` pins
`^11.31` (installed v11.52.0), so no update within the constraint fixes them.

| Severity | Advisory | Affects bandms? |
|---|---|---|
| critical | CVE-2026-114509 — TokenGuard auth bypass via non-string API credentials | Not directly: `api` guard is `passport`, `web` is `session`; TokenGuard is unused |
| high | CRLF injection in the default `email` validation rule (CVE-2026-48019) | **Yes** — `'email'` validates login, booking/press emails, band-member logins, allowed emails |
| medium | Temporary signed URL path confusion | Unlikely — no `temporarySignedRoute` / `signed` middleware found |
| low | CVE-2026-102279 — XSS in debug page | Only with `APP_DEBUG` on |

**Composer now refuses to update anything.** A `composer update --dry-run`
fails to resolve: Composer 2.9+ blocks installing versions with known
advisories, and every 11.x release has them. So the transitive fixes below
cannot be picked up either without a `composer.json` change. `composer install`
from the existing lock still works (CI/Docker builds are not broken yet).

## Transitive packages

| Package | Installed | Worst | Fixed in | Relevance |
|---|---|---|---|---|
| league/commonmark | 2.8.2 | high (DoS, XSS) | ≥ 2.10.2 | Laravel dependency; no direct use in `app/` |
| symfony/mime, symfony/mailer | 7.4.9 / 7.4.8 | high (header / SMTP injection) | latest 7.4.x | Outgoing mail (newsletter, tickets) |
| symfony/http-foundation, http-kernel, routing, yaml | 7.4.x / 8.0.8 | high (ReDoS, HEAD bypass of `#[IsGranted]`) | latest patch | Every request |
| guzzlehttp/guzzle, guzzlehttp/psr7 | 7.10.0 / 2.9.0 | medium (cookie scope, CRLF, proxy) | 7.15.1 / 2.12.3 | Outbound HTTP (iCal feeds) |
| dompdf/dompdf | 3.1.5 | medium (local file read via SVG, DoS) | 3.1.6 | Ticket PDFs, `ConcertTicketController.php:307` — self-generated content |
| phpseclib/phpseclib | 3.0.52 | medium | > 3.0.53 | Low |
| league/flysystem | 3.34.0 | low | > 3.35.2 | Low |
| symfony/polyfill-intl-idn | 1.37.0 | low | 1.38.1 | Low |

## Plan

Upgrade to **Laravel 12** on a `fix/` branch — the smallest major step, and it
clears the Laravel advisories and unblocks a normal `composer update` for all
transitive ones. Passport 12 and Pest 3 already accept `^12`. Ignoring the
advisories via `policy.advisories.ignore` would unblock updates but leave the
Laravel ones open — not recommended. Re-run the audit afterwards.

## Raw output

<details><summary>Full <code>composer audit</code> output</summary>

```
Found 52 security vulnerability advisories affecting 14 packages:
+-------------------+----------------------------------------------------------------------------------+
| Package           | dompdf/dompdf                                                                    |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-cv56-2228-pzr6                                                              |
| CVE               | CVE-2026-59943                                                                   |
| Title             | Dompdf: Embedded SVG images can leak existence of files and directories within   |
|                   | the filesystem                                                                   |
| URL               | https://github.com/advisories/GHSA-j8qw-6jw8-r297                                |
| Affected versions | <3.1.6                                                                           |
| Reported at       | 2026-07-22T22:52:44+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | dompdf/dompdf                                                                    |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-6r8f-nxsb-67bq                                                              |
| CVE               | CVE-2026-59942                                                                   |
| Title             | Dompdf: Denial of Service (DoS) via Resource Exhaustion using Oversized Image    |
|                   | Bitmaps                                                                          |
| URL               | https://github.com/advisories/GHSA-f5gf-2cj8-52g2                                |
| Affected versions | <3.1.6                                                                           |
| Reported at       | 2026-07-22T22:51:40+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | dompdf/dompdf                                                                    |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-gh7h-hhy4-byg7                                                              |
| CVE               | CVE-2026-59941                                                                   |
| Title             | Dompdf: Uncontrolled resource consumption based on declared BMP dimensions       |
| URL               | https://github.com/advisories/GHSA-8hg6-c449-896m                                |
| Affected versions | <3.1.6                                                                           |
| Reported at       | 2026-07-22T22:50:34+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | dompdf/dompdf                                                                    |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-mwt3-h9tv-kx78                                                              |
| CVE               | CVE-2026-56722                                                                   |
| Title             | Dompdf: Local file read due to improper file path validation in SVG images       |
|                   | encoded as data-URI                                                              |
| URL               | https://github.com/advisories/GHSA-cx96-42px-69fm                                |
| Affected versions | <3.1.6                                                                           |
| Reported at       | 2026-07-22T21:30:01+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | dompdf/dompdf                                                                    |
| Severity          | low                                                                              |
| Advisory ID       | PKSA-hp6n-n4kz-21wk                                                              |
| CVE               | CVE-2026-55555                                                                   |
| Title             | Dompdf: File existence oracle via font-face stylesheet declaration               |
| URL               | https://github.com/advisories/GHSA-7x2p-4jvh-6384                                |
| Affected versions | <3.1.6                                                                           |
| Reported at       | 2026-07-22T21:07:07+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | dompdf/dompdf                                                                    |
| Severity          | low                                                                              |
| Advisory ID       | PKSA-mckv-s5hg-868k                                                              |
| CVE               | CVE-2026-55554                                                                   |
| Title             | Dompdf: Chroot Validation Bypass                                                 |
| URL               | https://github.com/advisories/GHSA-wvh6-f5jh-8gw4                                |
| Affected versions | <3.1.6                                                                           |
| Reported at       | 2026-07-22T21:06:48+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/guzzle                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-gcrk-3vtt-1r14                                                              |
| CVE               | CVE-2026-69246                                                                   |
| Title             | Guzzle: Noncanonical host can bypass host-based checks                           |
| URL               | https://github.com/advisories/GHSA-v5mv-p594-2x33                                |
| Affected versions | >=8.0.0,<8.0.1|<7.15.2                                                           |
| Reported at       | 2026-08-03T21:07:26+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/guzzle                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-cnw1-2ytm-cgr8                                                              |
| CVE               | CVE-2026-69245                                                                   |
| Title             | Guzzle: Noncanonical cookie domain keeps subdomain scope                         |
| URL               | https://github.com/advisories/GHSA-f7vp-7xgx-4w4r                                |
| Affected versions | >=8.0.0,<8.0.1|<7.15.2                                                           |
| Reported at       | 2026-08-03T21:05:26+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/guzzle                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-fy2t-3c5f-827y                                                              |
| CVE               | CVE-2026-67354                                                                   |
| Title             | Guzzle: URI fragments disclosed in redirect Referer headers                      |
| URL               | https://github.com/advisories/GHSA-h95v-h523-3mw8                                |
| Affected versions | <7.15.1                                                                          |
| Reported at       | 2026-07-20T23:28:36+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/guzzle                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-qxvb-2bpp-dnk6                                                              |
| CVE               | CVE-2026-67355                                                                   |
| Title             | Guzzle: Host-only cookie scope is not preserved                                  |
| URL               | https://github.com/advisories/GHSA-wm3w-8rrp-j577                                |
| Affected versions | <7.15.1                                                                          |
| Reported at       | 2026-07-20T23:27:49+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/guzzle                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-bbs6-q5q9-f3t4                                                              |
| CVE               | CVE-2026-67353                                                                   |
| Title             | Guzzle: Unbounded response cookies risk denial of service                        |
| URL               | https://github.com/advisories/GHSA-f283-ghqc-fg79                                |
| Affected versions | <7.15.1                                                                          |
| Reported at       | 2026-07-20T23:27:02+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/guzzle                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-bcdd-5xc7-gwfb                                                              |
| CVE               | CVE-2026-59883                                                                   |
| Title             | Guzzle: Cookie Disclosure and Injection via IP-Address Domains                   |
| URL               | https://github.com/advisories/GHSA-g446-98w2-8p5w                                |
| Affected versions | <7.12.3                                                                          |
| Reported at       | 2026-07-20T22:00:09+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/guzzle                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-pwsk-hy21-4gby                                                              |
| CVE               | CVE-2026-67339                                                                   |
| Title             | Guzzle: Proxy-Authorization headers can be sent to origin servers                |
| URL               | https://github.com/advisories/GHSA-94pj-82f3-465w                                |
| Affected versions | <7.14.2                                                                          |
| Reported at       | 2026-07-20T21:46:02+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/guzzle                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-93qv-9n9h-6k6p                                                              |
| CVE               | CVE-2026-55767                                                                   |
| Title             | Dot-only cookie domains match all hosts                                          |
| URL               | https://github.com/guzzle/guzzle/security/advisories/GHSA-cwxw-98qj-8qjx         |
| Affected versions | <7.12.1                                                                          |
| Reported at       | 2026-06-18T14:12:49+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/guzzle                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-k22t-f949-t9g6                                                              |
| CVE               | CVE-2026-55568                                                                   |
| Title             | Silent HTTPS proxy downgrade to cleartext                                        |
| URL               | https://github.com/guzzle/guzzle/security/advisories/GHSA-wpwq-4j6v-78m3         |
| Affected versions | <7.12.1                                                                          |
| Reported at       | 2026-06-18T14:12:49+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/psr7                                                                  |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-vznr-tgp9-fd7d                                                              |
| CVE               | CVE-2026-59882                                                                   |
| Title             | guzzlehttp/psr7: Host Confusion via Weak URI Host Validation                     |
| URL               | https://github.com/advisories/GHSA-c2w2-prh8-qm98                                |
| Affected versions | <2.12.3                                                                          |
| Reported at       | 2026-07-21T18:35:25+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/psr7                                                                  |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-7qs6-zvnz-h66r                                                              |
| CVE               | CVE-2026-55766                                                                   |
| Title             | CRLF injection in HTTP start-line serialization                                  |
| URL               | https://github.com/guzzle/psr7/security/advisories/GHSA-vm85-hxw5-5432           |
| Affected versions | <2.12.1                                                                          |
| Reported at       | 2026-06-18T09:49:37+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/psr7                                                                  |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-gm5x-j3mz-71n9                                                              |
| CVE               | CVE-2026-49214                                                                   |
| Title             | CRLF injection via URI host component                                            |
| URL               | https://github.com/guzzle/psr7/security/advisories/GHSA-hq7v-mx3g-29hw           |
| Affected versions | <2.10.2                                                                          |
| Reported at       | 2026-05-25T22:58:15+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | guzzlehttp/psr7                                                                  |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-jj5t-2zs1-dcfm                                                              |
| CVE               | CVE-2026-48998                                                                   |
| Title             | Host confusion via authority reinterpretation                                    |
| URL               | https://github.com/guzzle/psr7/security/advisories/GHSA-34xg-wgjx-8xph           |
| Affected versions | <2.10.2                                                                          |
| Reported at       | 2026-05-25T22:58:15+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | laravel/framework                                                                |
| Severity          | critical                                                                         |
| Advisory ID       | PKSA-b41t-wbzk-9q51                                                              |
| CVE               | CVE-2026-114509                                                                  |
| Title             | Laravel TokenGuard authentication bypass through non-string API credentials      |
| URL               | https://github.com/advisories/GHSA-f9x3-7vq9-cph6                                |
| Affected versions | <12.68.0|>=13.0.0,<13.29.0                                                       |
| Reported at       | 2026-10-23T21:50:27+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | laravel/framework                                                                |
| Severity          | low                                                                              |
| Advisory ID       | PKSA-d5tc-s1qs-h781                                                              |
| CVE               | CVE-2026-102279                                                                  |
| Title             | Laravel: XSS in Debug Page Information                                           |
| URL               | https://github.com/advisories/GHSA-jh5r-qr3c-85q8                                |
| Affected versions | >=13.0.0,<13.30.0|<12.69.0                                                       |
| Reported at       | 2026-09-29T18:24:25+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | laravel/framework                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-m5cs-t1y6-qpcs                                                              |
| CVE               | NO CVE                                                                           |
| Title             | Laravel Framework: Temporary Signed URL Path Confusion                           |
| URL               | https://github.com/advisories/GHSA-crmm-hgp2-wgrp                                |
| Affected versions | <12.61.1|>=13.0.0,<13.12.0                                                       |
| Reported at       | 2026-06-17T13:54:13+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | laravel/framework                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-3r5d-mb8f-1qw9                                                              |
| CVE               | NO CVE                                                                           |
| Title             | Laravel Framework: CRLF injection in default email rule                          |
| URL               | https://github.com/advisories/GHSA-5vg9-5847-vvmq                                |
| Affected versions | <12.60.0|>=13.0.0,<=13.9.0                                                       |
| Reported at       | 2026-06-17T13:53:44+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | laravel/framework                                                                |
| Severity          |                                                                                  |
| Advisory ID       | PKSA-mdq4-51ck-6kdq                                                              |
| CVE               | CVE-2026-48019                                                                   |
| Title             | Laravel CRLF injection in default email rule                                     |
| URL               | https://github.com/laravel/framework/security/advisories/GHSA-5vg9-5847-vvmq     |
| Affected versions | >=9.0.0,<10.0.0|>=10.0.0,<11.0.0|>=11.0.0,<12.0.0|>=12.0.0,<12.60.0|>=13.0.0,<13 |
|                   | .10.0                                                                            |
| Reported at       | 2026-05-19T18:13:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-m2dq-1fhr-29b1                                                              |
| CVE               | NO CVE                                                                           |
| Title             | league/commonmark: DisallowedRawHtml bypassed when a disallowed tag name ends    |
|                   | the raw-HTML literal                                                             |
| URL               | https://github.com/advisories/GHSA-97jj-33gv-5xf9                                |
| Affected versions | >=1.3.0,<=2.10.1                                                                 |
| Reported at       | 2026-09-30T15:36:33+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-m4t9-vsgq-8khn                                                              |
| CVE               | NO CVE                                                                           |
| Title             | league/commonmark: Quadratic-time denial of service in the GitHub Flavored       |
|                   | Markdown Table extension block-start scan                                        |
| URL               | https://github.com/advisories/GHSA-3q6v-r5mr-hxv8                                |
| Affected versions | >=2.0.0,<=2.10.1                                                                 |
| Reported at       | 2026-09-30T15:36:13+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-zyf5-hrxv-hrd7                                                              |
| CVE               | NO CVE                                                                           |
| Title             | league/commonmark: Denial of service via distinctly-named attributes in the      |
|                   | Attributes extension                                                             |
| URL               | https://github.com/advisories/GHSA-8rr7-cvq3-gmfh                                |
| Affected versions | >=1.5.0,<2.10.0                                                                  |
| Reported at       | 2026-09-01T20:28:40+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-nv44-1b4d-6gjg                                                              |
| CVE               | NO CVE                                                                           |
| Title             | league/commonmark: Denial of service in the SmartPunct and Attributes extensions |
| URL               | https://github.com/advisories/GHSA-jjv6-8j6v-6j52                                |
| Affected versions | >=1.5.0,<2.9.1                                                                   |
| Reported at       | 2026-09-01T20:21:45+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-kr3s-894t-g5w2                                                              |
| CVE               | NO CVE                                                                           |
| Title             | league/commonmark XSS: `on*` event-handler filter in `AttributesExtension`       |
|                   | bypassed with a U+000C form feed                                                 |
| URL               | https://github.com/advisories/GHSA-f8fg-pg57-v4j8                                |
| Affected versions | >=2.7.0,<2.9.1                                                                   |
| Reported at       | 2026-09-01T20:18:29+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-9q1p-3s19-bp1q                                                              |
| CVE               | NO CVE                                                                           |
| Title             | league/commonmark: Denial of service via crafted code fences, reference links,   |
|                   | and emphasis delimiters                                                          |
| URL               | https://github.com/advisories/GHSA-j8pm-gj4c-rq4x                                |
| Affected versions | >=0.6.0,<2.9.1                                                                   |
| Reported at       | 2026-09-01T20:17:59+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-5mzr-szzf-z6cn                                                              |
| CVE               | NO CVE                                                                           |
| Title             | league/commonmark: Denial of service via deeply nested XML output                |
| URL               | https://github.com/advisories/GHSA-mj63-m3rc-8ppr                                |
| Affected versions | >=2.0.0,<2.9.0                                                                   |
| Reported at       | 2026-08-06T20:42:54+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-cqd6-fg4n-nxpf                                                              |
| CVE               | NO CVE                                                                           |
| Title             | league/commonmark: Denial of service via colliding heading slugs                 |
| URL               | https://github.com/advisories/GHSA-mh25-x5hq-wrqp                                |
| Affected versions | >=2.0.0,<2.9.0                                                                   |
| Reported at       | 2026-08-06T20:41:45+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-1q6p-sqkj-8mmj                                                              |
| CVE               | NO CVE                                                                           |
| Title             | league/commonmark:  Denial of service via duplicate footnote definitions         |
| URL               | https://github.com/advisories/GHSA-jfm3-95jq-q3rf                                |
| Affected versions | >=1.5.0,<2.9.0                                                                   |
| Reported at       | 2026-08-06T20:40:53+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-mc58-w91n-f5gv                                                              |
| CVE               | NO CVE                                                                           |
| Title             | league/commonmark: Denial of service via adjacent inline attribute blocks        |
| URL               | https://github.com/advisories/GHSA-g2gp-3wwq-f4ph                                |
| Affected versions | >=1.5.0,<2.9.0                                                                   |
| Reported at       | 2026-08-06T20:39:52+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-t21r-vtr5-3mdz                                                              |
| CVE               | CVE-2026-71488                                                                   |
| Title             | league/commonmark: Quadratic-time denial of service when parsing crafted         |
|                   | Markdown                                                                         |
| URL               | https://github.com/advisories/GHSA-2q4p-g7hv-5rgv                                |
| Affected versions | >=0.6.0,<2.9.0                                                                   |
| Reported at       | 2026-08-06T20:37:20+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/commonmark                                                                |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-scnn-p8mm-jbft                                                              |
| CVE               | CVE-2026-71478                                                                   |
| Title             | league/commonmark: AttributesExtension href/src unsafe-link filter bypass via    |
|                   | embedded control bytes                                                           |
| URL               | https://github.com/advisories/GHSA-29pj-957v-52mc                                |
| Affected versions | >=1.5.0,<=2.8.3                                                                  |
| Reported at       | 2026-08-06T20:30:39+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | league/flysystem                                                                 |
| Severity          | low                                                                              |
| Advisory ID       | PKSA-w9tt-7782-78jx                                                              |
| CVE               | CVE-2026-102601                                                                  |
| Title             | Flysystem: WhitespacePathNormalizer's control-character (CorruptedPathDetected)  |
|                   | check is bypassed by malformed UTF-8 in the path, affecting every adapter        |
| URL               | https://github.com/advisories/GHSA-cxf4-7mrp-vvpr                                |
| Affected versions | <=3.35.2                                                                         |
| Reported at       | 2026-09-29T18:10:14+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | phpseclib/phpseclib                                                              |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-12sz-bcny-pk4m                                                              |
| CVE               | CVE-2026-84308                                                                   |
| Title             | phpseclib — non-constant-time X25519 scalar multiplication permits full          |
|                   | private-key recovery                                                             |
| URL               | https://github.com/advisories/GHSA-q97c-8qh3-fpc6                                |
| Affected versions | >=4.0.0,<4.0.1|<3.0.57                                                           |
| Reported at       | 2026-09-08T21:24:29+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | phpseclib/phpseclib                                                              |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-432p-hv1d-chf7                                                              |
| CVE               | CVE-2026-55599                                                                   |
| Title             | phpseclib: X.509 certificate validation sends attacker-controlled outbound       |
|                   | requests (server-side request forgery) via Authority Information Access          |
| URL               | https://github.com/advisories/GHSA-m557-wrgg-6rp4                                |
| Affected versions | >=3.0.0,<=3.0.53|>=2.0.0,<=2.0.54|>=0.1.1,<=1.0.29                               |
| Reported at       | 2026-06-16T15:03:58+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/http-foundation                                                          |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-xmwy-rmx5-m7h4                                                              |
| CVE               | CVE-2026-108082                                                                  |
| Title             | CVE-2026-108082: ReDoS in HeaderUtils::split() Reachable Through the             |
|                   | Cache-Control Request Header                                                     |
| URL               | https://symfony.com/cve-2026-108082                                              |
| Affected versions | >=5.4.1,<5.4.54|>=6.0.1,<6.1.0|>=6.1.0,<6.2.0|>=6.2.0,<6.3.0|>=6.3.0,<6.4.0|>=6. |
|                   | 4.0,<6.4.46|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3.0|>=7.3.0,<7.4.0|>=7.4.0, |
|                   | <7.4.19|>=8.0.0,<8.1.0|>=8.1.0,<8.1.7                                            |
| Reported at       | 2026-09-15T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/http-foundation                                                          |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-y6py-qpv1-h52p                                                              |
| CVE               | CVE-2026-48736                                                                   |
| Title             | CVE-2026-48736: IpUtils::PRIVATE_SUBNETS Omits IPv6 Transition Forms (6to4,      |
|                   | NAT64, Teredo, IPv4-compatible): SSRF Bypass in NoPrivateNetworkHttpClient       |
| URL               | https://symfony.com/cve-2026-48736                                               |
| Affected versions | >=6.4.0,<6.4.41|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3.0|>=7.3.0,<7.4.0|>=7. |
|                   | 4.0,<7.4.13|>=8.0.0,<8.0.13                                                      |
| Reported at       | 2026-05-26T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/http-kernel                                                              |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-dw7n-x7f5-zf63                                                              |
| CVE               | CVE-2026-45075                                                                   |
| Title             | CVE-2026-45075: HEAD Request Bypasses methods: ['GET'] Filter in #[IsGranted] /  |
|                   | #[IsSignatureValid] / #[IsCsrfTokenValid]                                        |
| URL               | https://symfony.com/cve-2026-45075                                               |
| Affected versions | >=7.4.0,<7.4.12|>=8.0.0,<8.0.12                                                  |
| Reported at       | 2026-05-20T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/mailer                                                                   |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-28rh-rzzn-djk4                                                              |
| CVE               | CVE-2026-45068                                                                   |
| Title             | CVE-2026-45068: Argument Injection in SendmailTransport via Dash-Prefixed        |
|                   | Recipient Address                                                                |
| URL               | https://symfony.com/cve-2026-45068                                               |
| Affected versions | >=2.0.0,<3.0.0|>=3.0.0,<4.0.0|>=4.0.0,<5.0.0|>=5.0.0,<5.1.0|>=5.1.0,<5.2.0|>=5.2 |
|                   | .0,<5.3.0|>=5.3.0,<5.4.0|>=5.4.0,<5.4.52|>=6.0.0,<6.1.0|>=6.1.0,<6.2.0|>=6.2.0,< |
|                   | 6.3.0|>=6.3.0,<6.4.0|>=6.4.0,<6.4.40|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3. |
|                   | 0|>=7.3.0,<7.4.0|>=7.4.0,<7.4.12|>=8.0.0,<8.0.12                                 |
| Reported at       | 2026-05-20T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/mime                                                                     |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-wtxr-p26d-nn42                                                              |
| CVE               | CVE-2026-45070                                                                   |
| Title             | CVE-2026-45070: Email Header Injection via Non-Token Characters in Mime          |
|                   | Parameter Names                                                                  |
| URL               | https://symfony.com/cve-2026-45070                                               |
| Affected versions | >=2.0.0,<3.0.0|>=3.0.0,<4.0.0|>=4.0.0,<5.0.0|>=5.0.0,<5.1.0|>=5.1.0,<5.2.0|>=5.2 |
|                   | .0,<5.3.0|>=5.3.0,<5.4.0|>=5.4.0,<5.4.52|>=6.0.0,<6.1.0|>=6.1.0,<6.2.0|>=6.2.0,< |
|                   | 6.3.0|>=6.3.0,<6.4.0|>=6.4.0,<6.4.40|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3. |
|                   | 0|>=7.3.0,<7.4.0|>=7.4.0,<7.4.12|>=8.0.0,<8.0.12                                 |
| Reported at       | 2026-05-20T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/mime                                                                     |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-2n2k-66v2-bwg3                                                              |
| CVE               | CVE-2026-45067                                                                   |
| Title             | CVE-2026-45067: Email Header / SMTP Command Injection via CRLF in                |
|                   | Symfony\Component\Mime\Address                                                   |
| URL               | https://symfony.com/cve-2026-45067                                               |
| Affected versions | >=2.0.0,<3.0.0|>=3.0.0,<4.0.0|>=4.0.0,<5.0.0|>=5.0.0,<5.1.0|>=5.1.0,<5.2.0|>=5.2 |
|                   | .0,<5.3.0|>=5.3.0,<5.4.0|>=5.4.0,<5.4.52|>=6.0.0,<6.1.0|>=6.1.0,<6.2.0|>=6.2.0,< |
|                   | 6.3.0|>=6.3.0,<6.4.0|>=6.4.0,<6.4.40|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3. |
|                   | 0|>=7.3.0,<7.4.0|>=7.4.0,<7.4.12|>=8.0.0,<8.0.12                                 |
| Reported at       | 2026-05-20T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/polyfill-intl-idn                                                        |
| Severity          | low                                                                              |
| Advisory ID       | PKSA-dwsq-ppd2-mb1x                                                              |
| CVE               | CVE-2026-46644                                                                   |
| Title             | CVE-2026-46644: symfony/polyfill-intl-idn accepts xn-- labels whose Punycode     |
|                   | payload decodes to ASCII-only: insecure equivalence                              |
| URL               | https://symfony.com/cve-2026-46644                                               |
| Affected versions | >=1.17.1,<1.38.1                                                                 |
| Reported at       | 2026-05-26T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/routing                                                                  |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-bf7t-jnpz-492k                                                              |
| CVE               | CVE-2026-48784                                                                   |
| Title             | CVE-2026-48784: UrlGenerator Dot-Segment Encoding Skips Every Other Chained      |
|                   | `../` or `./` → Generated URL Collapses Off-Route Under RFC 3986 Normalization   |
| URL               | https://symfony.com/cve-2026-48784                                               |
| Affected versions | >=2.0.0,<3.0.0|>=3.0.0,<4.0.0|>=4.0.0,<5.0.0|>=5.0.0,<5.1.0|>=5.1.0,<5.2.0|>=5.2 |
|                   | .0,<5.3.0|>=5.3.0,<5.4.0|>=5.4.0,<5.4.53|>=6.0.0,<6.1.0|>=6.1.0,<6.2.0|>=6.2.0,< |
|                   | 6.3.0|>=6.3.0,<6.4.0|>=6.4.0,<6.4.41|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3. |
|                   | 0|>=7.3.0,<7.4.0|>=7.4.0,<7.4.13|>=8.0.0,<8.0.13                                 |
| Reported at       | 2026-05-26T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/routing                                                                  |
| Severity          | medium                                                                           |
| Advisory ID       | PKSA-yc7t-91v9-99xs                                                              |
| CVE               | CVE-2026-45065                                                                   |
| Title             | CVE-2026-45065: UrlGenerator Route-Requirement Bypass via Unanchored Regex       |
|                   | Alternation → Off-Site //host URL Injection                                      |
| URL               | https://symfony.com/cve-2026-45065                                               |
| Affected versions | >=2.0.0,<3.0.0|>=3.0.0,<4.0.0|>=4.0.0,<5.0.0|>=5.0.0,<5.1.0|>=5.1.0,<5.2.0|>=5.2 |
|                   | .0,<5.3.0|>=5.3.0,<5.4.0|>=5.4.0,<5.4.52|>=6.0.0,<6.1.0|>=6.1.0,<6.2.0|>=6.2.0,< |
|                   | 6.3.0|>=6.3.0,<6.4.0|>=6.4.0,<6.4.40|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3. |
|                   | 0|>=7.3.0,<7.4.0|>=7.4.0,<7.4.12|>=8.0.0,<8.0.12                                 |
| Reported at       | 2026-05-20T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/yaml                                                                     |
| Severity          | high                                                                             |
| Advisory ID       | PKSA-xz3r-9gp4-4m1z                                                              |
| CVE               | CVE-2026-109413                                                                  |
| Title             | CVE-2026-109413: Unbounded Recursion in the YAML Inline Lexer Lets a Single      |
|                   | Document Crash the Process                                                       |
| URL               | https://symfony.com/cve-2026-109413                                              |
| Affected versions | >=2.0.0,<3.0.0|>=3.0.0,<4.0.0|>=4.0.0,<5.0.0|>=5.0.0,<5.1.0|>=5.1.0,<5.2.0|>=5.2 |
|                   | .0,<5.3.0|>=5.3.0,<5.4.0|>=5.4.0,<5.4.54|>=6.0.0,<6.1.0|>=6.1.0,<6.2.0|>=6.2.0,< |
|                   | 6.3.0|>=6.3.0,<6.4.0|>=6.4.0,<6.4.45|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3. |
|                   | 0|>=7.3.0,<7.4.0|>=7.4.0,<7.4.18|>=8.0.0,<8.1.0|>=8.1.0,<8.1.6                   |
| Reported at       | 2026-08-30T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/yaml                                                                     |
| Severity          | low                                                                              |
| Advisory ID       | PKSA-v5yj-8nmz-sk2q                                                              |
| CVE               | CVE-2026-45304                                                                   |
| Title             | CVE-2026-45304: YAML Parser Exponential Memory Allocation via Recursive          |
|                   | Collection-Alias Expansion ("Billion Laughs")                                    |
| URL               | https://symfony.com/cve-2026-45304                                               |
| Affected versions | >=2.0.0,<3.0.0|>=3.0.0,<4.0.0|>=4.0.0,<5.0.0|>=5.0.0,<5.1.0|>=5.1.0,<5.2.0|>=5.2 |
|                   | .0,<5.3.0|>=5.3.0,<5.4.0|>=5.4.0,<5.4.52|>=6.0.0,<6.1.0|>=6.1.0,<6.2.0|>=6.2.0,< |
|                   | 6.3.0|>=6.3.0,<6.4.0|>=6.4.0,<6.4.40|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3. |
|                   | 0|>=7.3.0,<7.4.0|>=7.4.0,<7.4.12|>=8.0.0,<8.0.12                                 |
| Reported at       | 2026-05-20T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/yaml                                                                     |
| Severity          | low                                                                              |
| Advisory ID       | PKSA-ft77-7h5f-p3r6                                                              |
| CVE               | CVE-2026-45305                                                                   |
| Title             | CVE-2026-45305: YAML Parser ReDoS via Catastrophic Backtracking in               |
|                   | Parser::cleanup() Regex                                                          |
| URL               | https://symfony.com/cve-2026-45305                                               |
| Affected versions | >=2.0.0,<3.0.0|>=3.0.0,<4.0.0|>=4.0.0,<5.0.0|>=5.0.0,<5.1.0|>=5.1.0,<5.2.0|>=5.2 |
|                   | .0,<5.3.0|>=5.3.0,<5.4.0|>=5.4.0,<5.4.52|>=6.0.0,<6.1.0|>=6.1.0,<6.2.0|>=6.2.0,< |
|                   | 6.3.0|>=6.3.0,<6.4.0|>=6.4.0,<6.4.40|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3. |
|                   | 0|>=7.3.0,<7.4.0|>=7.4.0,<7.4.12|>=8.0.0,<8.0.12                                 |
| Reported at       | 2026-05-20T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
+-------------------+----------------------------------------------------------------------------------+
| Package           | symfony/yaml                                                                     |
| Severity          | low                                                                              |
| Advisory ID       | PKSA-b14r-zh1d-vdrc                                                              |
| CVE               | CVE-2026-45133                                                                   |
| Title             | CVE-2026-45133: YAML Parser Stack Exhaustion via Unbounded Recursion in Nested   |
|                   | Blocks, Sequences, and Mappings                                                  |
| URL               | https://symfony.com/cve-2026-45133                                               |
| Affected versions | >=2.0.0,<3.0.0|>=3.0.0,<4.0.0|>=4.0.0,<5.0.0|>=5.0.0,<5.1.0|>=5.1.0,<5.2.0|>=5.2 |
|                   | .0,<5.3.0|>=5.3.0,<5.4.0|>=5.4.0,<5.4.52|>=6.0.0,<6.1.0|>=6.1.0,<6.2.0|>=6.2.0,< |
|                   | 6.3.0|>=6.3.0,<6.4.0|>=6.4.0,<6.4.40|>=7.0.0,<7.1.0|>=7.1.0,<7.2.0|>=7.2.0,<7.3. |
|                   | 0|>=7.3.0,<7.4.0|>=7.4.0,<7.4.12|>=8.0.0,<8.0.12                                 |
| Reported at       | 2026-05-20T08:00:00+00:00                                                        |
+-------------------+----------------------------------------------------------------------------------+
exit=1
```

</details>
