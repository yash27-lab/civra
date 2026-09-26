# Owner-reviewed renewal reminders

Civra ranks tracked permit dates into four review states. The dashboard's next-step card follows the nearest saved reminder and updates when a reminder is added, removed, or changed in another open tab:

- **Overdue** — the date has passed.
- **Review now** — due within 30 days.
- **Plan review** — due within 90 days.
- **Planned** — more than 90 days away.

These states are prompts for an owner to review their permit, evidence, and city requirements. Civra does not renew a permit, send a form, pay a fee, or contact a city service.

The current demo stores up to 50 reminder names and dates in the browser's local storage. Changes appear in other open Civra tabs in the same browser. Each reminder can be removed on its own; the **Reset demo dates** button removes owner-added reminders and restores the sample dates. Reminder data is not sent to the Civra server, shared across devices, or used to trigger notifications.

## Calendar export

An owner can explicitly download an iCalendar (`.ics`) file containing all-day review events scheduled 30 days before each due date. If that review date has passed, the event is placed on the current day. Civra does not access a calendar account, import the file, or deliver a notification; the owner chooses whether and where to import it.

Production reminders need durable owner-approved storage, an explicit cross-device synchronization design, and opt-in before any email or notification delivery.
