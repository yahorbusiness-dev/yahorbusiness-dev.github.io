# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

UngEkonom: a Swedish personal-finance learning site for 16–25 year olds, served as a plain static site on GitHub Pages (`yahorbusiness-dev/yahorbusiness-dev.github.io`). All user-facing copy is in Swedish (`lang="sv"`).

There is no build step, package manager, linter or test suite. Edit the HTML/JS/CSS directly. To preview locally, serve the repo root, e.g. `python3 -m http.server 8000`, and open `http://localhost:8000/index.html` (opening files via `file://` breaks the Supabase auth flow).

## Architecture

The site has three groups of pages, each loading a different set of assets from `stitch-assets/`:

1. **Marketing pages** (`index.html`, `var-vision.html`, `for-*.html`, `engagera-dig.html`, `samarbete.html`, `kontakt.html`, `fragor-och-svar.html`): static, no backend. They load `site.css` (shared `lp-*` layout classes and design tokens such as `--ink` and `--blue`, scoped under `.lp`), `motion.css`/`motion.js` (scroll reveal through `data-reveal`, `data-reveal-stagger`, `data-count`, plus `.hover-lift`/`.press`) and `to-top.js`. Page-specific scripts (for example the compound-interest calculator on the landing page) are inline in the HTML.
2. **App pages (MVP)** (`auth.html`, `oversikt.html`, `kurser.html`, `lektion.html`): backed by Supabase, loaded from the jsDelivr UMD build of `@supabase/supabase-js`.
   - `auth.html` has its own inline login/register script (`?mode=register` opens the sign-up form).
   - `stitch-assets/app.js` is the shared client for every other app page. On `DOMContentLoaded` it redirects to `auth.html` if there is no session, then loads `profiles`, `lessons` and `user_lesson_progress` into a `ctx` object. It then picks the page initializer **by which root element exists** (`#dashboard-root`, `#lesson-root`, `#courses-root`, `#journey-root`, `#profile-root`, `#articles-root`, `#article-root`). A new app page needs one of these roots or a new branch in that dispatch.
   - Lesson content comes from the DB: `lessons.content` is JSON with `steps` and `quiz`. Progress is written to `user_lesson_progress`.
   - MVP gating constants sit at the top of `app.js`: `PAUSED_CATEGORIES` (krypto), `OPEN_LESSONS_PER_CATEGORY = 1`, `PASS_THRESHOLD = 90`, and `FEEDBACK_URL` for the prototype feedback button and welcome guide.
   - `widgets.js`/`widgets.css` (only on `lektion.html`) mount opt-in interactive tools such as the stock simulator `aktie-sim`. A widget is mounted where lesson content contains `<div data-widget="name">`, or through the `PLACEMENTS` map (lesson slug → step index), which needs no DB content change.
3. **Archived pre-MVP platform** (`index-stitch-preview.html`, `stitch-preview-*.html`, `index-legacy.html`, `landing-preview.html`): these run on `app-plattform-v1.js`, a frozen copy of the old app (also kept as git tag `plattform-v1` and branch `arkiv/plattform-v1`). Don't change these when working on the current app; edit `app.js`.

### Styling caveat

`stitch-assets/tailwind.css` is a **precompiled, minified Tailwind build** with custom design tokens (`bg-primary-container`, `text-text-primary`, `font-label-md`, `px-margin`, `gap-space-md`, …). There is no Tailwind config or JIT, so a utility class (including an arbitrary value like `mt-[37px]`) only works if it already exists in that file. Check with `grep` before using a new class. Otherwise put the style in `site.css` (marketing), `widgets.css` (widgets) or an inline style. Fonts (Plus Jakarta Sans, Material Symbols) are self-hosted through `fonts.css`.

## Conventions

- Commit subjects start with the page or area and a colon, then a short imperative summary, e.g. `Landing: …`, `Lektion: …`, `Footer: …`, `Om oss timeline: …`. Work happens on `claude/*` branches and is merged into `main` through PRs.
- The Supabase URL and publishable (anon) key in `app.js`/`auth.html` are meant to be public client keys. Access control lives in Supabase RLS, not in this repo.
- Respect `prefers-reduced-motion` (`motion.js` already turns itself off when it's set) and keep the existing accessibility patterns (`aria-live`, dialog roles, keyboard focus styles) when adding UI.
