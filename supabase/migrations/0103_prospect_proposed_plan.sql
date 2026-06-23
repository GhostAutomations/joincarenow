-- Record which plan the founder proposed to a prospect (monthly | commit | annual).
-- Carries the founder's chosen billing terms from the proposal into the timeline
-- and (later) into provisioning.
alter table prospect_companies add column if not exists proposed_plan text;
