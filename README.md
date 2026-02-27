# Subscription Tracker

A starter scaffold for building a customer subscription tracking app.

## Project layout

- `index.html`: static frontend shell with authentication UI.
- `styles.css`: styles for the static frontend.
- `app.js`: auth flow wiring for Supabase magic-link sign in/out.
- `supabaseClient.js`: Supabase browser client initialization.
- `src/subscription_tracker/models.py`: domain models for billing cycles and subscriptions.
- `src/subscription_tracker/tracker.py`: in-memory tracker with add/remove/summary behavior.
- `tests/test_tracker.py`: basic unit tests validating scaffold behavior.

## Supabase auth notes

- This frontend uses the Supabase **anon key** in browser code. That key is designed to be public in client apps.
- Data security is enforced by Supabase Row Level Security (RLS) policies, which can be added in a later step.
- For magic-link auth redirects, run the app from `http://localhost` (or deploy to GitHub Pages). Avoid using `file://` URLs for best results.

## Getting started

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
python -m unittest discover -s tests
```
