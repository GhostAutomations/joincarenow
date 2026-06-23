-- Accept / Decline buttons in the proposal email. Each proposal gets a token
-- the prospect uses to respond (no login); we record their answer + timestamp.
alter table prospect_companies add column if not exists proposal_token uuid;
alter table prospect_companies add column if not exists proposal_response text;       -- 'accepted' | 'declined'
alter table prospect_companies add column if not exists proposal_responded_at timestamptz;

create index if not exists idx_prospect_companies_proposal_token
  on prospect_companies (proposal_token);
