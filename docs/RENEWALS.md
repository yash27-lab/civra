# Owner-reviewed renewal reminders

Civra ranks tracked permit dates into four review states. The dashboard's next-step card follows the nearest saved reminder and updates when a reminder is added, removed, or changed in another open tab:

- **Overdue** — the date has passed.
- **Review now** — due within 30 days.
- **Plan review** — due within 90 days.
- **Planned** — more than 90 days away.

These states are prompts for an owner to review their permit, evidence, and city requirements. Civra does not renew a permit, send a form, pay a fee, or contact a city service.

The current demo stores up to 50 reminder names and dates in the browser's local storage. Changes appear in other open Civra tabs in the same browser. Each reminder can be edited or removed on its own; the **Reset demo dates** button removes owner-added reminders and restores the sample dates. If a reminder changes in another open tab while its edit form is open, Civra asks the owner to reopen it rather than overwriting the newer value. Reminder data is not sent to the Civra server, shared across devices, or used to trigger notifications.

## Local backup

Owners can export a version 1 JSON file containing reminder names and due dates, then restore it in the same browser or another browser. Restore accepts up to 50 valid reminders from a file no larger than 128 KB, rejects duplicates and invalid dates, and validates the full file before replacing the current list. Civra asks before replacing existing reminders. The file is read in the browser and is never uploaded.

## Calendar export

An owner can explicitly download an iCalendar (`.ics`) file containing transparent all-day review events scheduled 30 days before each due date, so the reminders do not mark calendar time as busy. If that review date has passed, the event is placed on the current day. Event identifiers stay stable when the same reminders are exported in a different order. Civra does not access a calendar account, import the file, or deliver a notification; the owner chooses whether and where to import it.

Production reminders need durable owner-approved storage, an explicit cross-device synchronization design, and opt-in before any email or notification delivery.
