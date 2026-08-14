-- BankFeedMethod is introduced by the preceding Plaid migration. Keeping this
-- dependency in a later additive migration makes both fresh installs and
-- production databases that already applied Plaid migrate in the same order.
ALTER TABLE "BusinessOnboarding"
  ADD COLUMN IF NOT EXISTS "preferredBankFeedMethod" "BankFeedMethod";
