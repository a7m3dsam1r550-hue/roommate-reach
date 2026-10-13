<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Roles and hotel membership live in `staff_roles` (one row per user; super_admin has no hotel); RLS isolates tenants via `my_role()`/`my_hotel()` — `user_roles` is deprecated. First signup becomes super_admin; others get roles only via `createStaff`.
- Room check-in/out timestamps are set only by the `room_check_in`/`room_check_out` DB functions (server `now()`) — prevents client clock tampering.
- Accounts are created via the `createStaff` server function (super_admin→hotel_admin, hotel_admin→manager, manager→supervisor/houseman) which enforces hotel quotas before using the admin client.
- Room status and duration are derived from timestamps, never stored.
