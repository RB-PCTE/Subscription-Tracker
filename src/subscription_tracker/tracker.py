"""Core logic for managing subscriptions."""

from __future__ import annotations

from .models import Subscription


class SubscriptionTracker:
    """Simple in-memory tracker for subscription records."""

    def __init__(self) -> None:
        self._subscriptions: dict[str, Subscription] = {}

    def add(self, subscription: Subscription) -> None:
        """Add or replace a subscription by name."""
        self._subscriptions[subscription.name] = subscription

    def remove(self, name: str) -> bool:
        """Remove a subscription by name and return whether it existed."""
        return self._subscriptions.pop(name, None) is not None

    def monthly_total(self) -> float:
        """Return the combined monthly cost of all subscriptions."""
        return sum(subscription.monthly_cost for subscription in self._subscriptions.values())

    def all(self) -> tuple[Subscription, ...]:
        """Return all subscriptions sorted by name for stable output."""
        return tuple(sorted(self._subscriptions.values(), key=lambda sub: sub.name.lower()))
