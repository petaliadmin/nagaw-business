-- Indexes of the platform dashboard and finances (ADR-041).
--
-- The finances rebuild each shop's offer and suspension month by month from
-- the history; the activity sums the sales of all shops over 30 days.

create index audit_logs_platform_events_idx
  on app.audit_logs (organization_id, id)
  where action in ('subscription.plan_changed', 'organization.suspended', 'organization.reactivated');

create index sales_occurred_idx
  on app.sales (occurred_at desc)
  where status = 'completed';
