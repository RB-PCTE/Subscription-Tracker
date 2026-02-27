# Subscription Tracker

A starter scaffold for building a customer subscription tracking app.

## Project layout

- `src/subscription_tracker/models.py`: domain models for billing cycles and subscriptions.
- `src/subscription_tracker/tracker.py`: in-memory tracker with add/remove/summary behavior.
- `tests/test_tracker.py`: basic unit tests validating scaffold behavior.

## Getting started

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
python -m unittest discover -s tests
```
