# Owner-reviewed renewal reminders

Civra ranks tracked permit dates into four review states:

- **Overdue** — the date has passed.
- **Review now** — due within 30 days.
- **Plan review** — due within 90 days.
- **Planned** — more than 90 days away.

These states are prompts for an owner to review their permit, evidence, and city requirements. Civra does not renew a permit, send a form, pay a fee, or contact a city service.

The current demo persists added reminder names and dates in the same browser's local storage. They are not sent to the Civra server, shared across devices, or used to trigger any notification.

Production reminders need durable owner-approved storage, an explicit cross-device synchronization design, and opt-in before any email or notification delivery.
