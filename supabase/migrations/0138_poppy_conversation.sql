-- ============================================================
-- JOIN CARE NOW — Migration 0138: Poppy conversation state (Slice B)
-- Poppy now runs a screening CONVERSATION: it analyses the application into
-- concerns + questions, asks the applicant those questions over their portal
-- thread (one nudge SMS to get them there), then writes the final report from
-- their answers. This migration adds the conversation lifecycle to poppy_reports
-- and a "from Poppy" marker on messages so the portal + reply loop can tell
-- Poppy's messages apart from a human's.
-- phase: 'analysed'   — concerns + questions ready, conversation not started
--        'conversing' — asking the applicant questions in the portal
--        'complete'   — answers in, final report written
--        'declined'   — applicant declined / didn't respond (owner flagged)
-- Run AFTER 0137_poppy_include_cv.sql.
-- ============================================================

alter table public.poppy_reports
  add column if not exists phase text not null default 'complete',
  add column if not exists consent text,                 -- null | 'asked' | 'yes' | 'no'
  add column if not exists current_q integer not null default 0,
  add column if not exists sms_sent_at timestamptz,
  add column if not exists last_applicant_reply_at timestamptz;

-- Mark messages Poppy posted (so the portal renders them as Poppy and the reply
-- loop knows a thread is mid-conversation). Default false = a human/system msg.
alter table public.messages
  add column if not exists from_poppy boolean not null default false;
