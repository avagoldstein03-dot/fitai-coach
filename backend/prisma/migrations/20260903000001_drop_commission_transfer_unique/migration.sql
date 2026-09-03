-- A single Stripe transfer commonly pays out several pending CommissionEntry
-- rows at once, so stripeTransferId is not actually unique per entry.
DROP INDEX "CommissionEntry_stripeTransferId_key";
