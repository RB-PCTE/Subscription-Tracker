"""Domain models for subscriptions."""

from dataclasses import dataclass
from enum import Enum


class BillingCycle(str, Enum):
    """Supported billing cycles for subscriptions."""

    MONTHLY = "monthly"
    YEARLY = "yearly"


@dataclass(frozen=True, slots=True)
class Subscription:
    """Represents a recurring subscription."""

    name: str
    amount: float
    cycle: BillingCycle = BillingCycle.MONTHLY

    @property
    def monthly_cost(self) -> float:
        """Normalize any subscription to an equivalent monthly cost."""
        if self.cycle == BillingCycle.YEARLY:
            return self.amount / 12
        return self.amount
