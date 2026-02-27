import unittest

from subscription_tracker.models import BillingCycle, Subscription
from subscription_tracker.tracker import SubscriptionTracker


class SubscriptionTrackerTests(unittest.TestCase):
    def test_monthly_total_normalizes_yearly_subscriptions(self) -> None:
        tracker = SubscriptionTracker()
        tracker.add(Subscription(name="Streaming", amount=15))
        tracker.add(Subscription(name="Domain", amount=120, cycle=BillingCycle.YEARLY))

        self.assertAlmostEqual(tracker.monthly_total(), 25)

    def test_remove_returns_false_when_missing(self) -> None:
        tracker = SubscriptionTracker()

        removed = tracker.remove("Missing")

        self.assertFalse(removed)


if __name__ == "__main__":
    unittest.main()
