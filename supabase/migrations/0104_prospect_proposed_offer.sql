-- Optional "sweetener" offered with a proposal (e.g. "3 months free",
-- "+100 SMS/mo", "£45/mo"). Free text for now; the billing side will read this
-- when we wire concessions into the subscription.
alter table prospect_companies add column if not exists proposed_offer text;
