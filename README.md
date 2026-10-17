# Roommate Reach

Create a Full-Stack Housekeeping & Houseman Management Web Application with the following core structure:

1. User Roles & Authentication:

- Admin / Manager: Can create staff email accounts, assign specific room numbers to each houseman for the current day, and view all live reporting dashboards.

- Houseman: Can log in with their assigned email and view ONLY their assigned rooms for the day.

2. Houseman Room Interface:

- List of assigned rooms.

- For each room, two input fields: "Morning Guest Count" and "Evening Guest Count".

- Two action buttons with auto-timestamping:

  * "Check-in (Enter Room)": Automatically captures and records the current date & start time.

  * "Check-out (Exit Room)": Automatically captures and records the end time and calculates total duration spent.

3. Reporting & Dashboard:

- Real-time updates for Managers/Admins showing room status (Pending, In Progress, Completed), start/end times, calculated duration, and guest counts.

- Responsive mobile-friendly UI optimized for smartphones.

-

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://roommate-reach.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3e7e9a5d-4282-4959-9b5f-1d81a1aba214).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
