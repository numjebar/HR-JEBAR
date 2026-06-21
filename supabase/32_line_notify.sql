-- Add LINE Notify token per branch
alter table branches add column if not exists line_notify_token text;
