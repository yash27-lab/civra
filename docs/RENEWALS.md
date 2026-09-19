# Owner-reviewed renewal reminders

Civra ranks tracked permit dates into four review states:

- **Overdue** — the date has passed.
- **Review now** — due within 30 days.
- **Plan review** — due within 90 days.
- **Planned** — more than 90 days away.

These states are prompts for an owner to review their permit, evidence, and city requirements. Civra does not renew a permit, send a form, pay a fee, or contact a city service.

The current demo persists added reminder names and dates in the same browser's local storage. They are not sent to the Civra server, shared across devices, or used to trigger any notification.

## Calendar export

An owner can explicitly download an iCalendar (`.ics`) file containing all-day review events scheduled 30 days before each due date. If that review date has passed, the event is placed on the current day. Civra does not access a calendar account, import the file, or deliver a notification; the owner chooses whether and where to import it.

Production reminders need durable owner-approved storage, an explicit cross-device synchronization design, and opt-in before any email or notification delivery.
