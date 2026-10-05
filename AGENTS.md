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
- Roles live in `user_roles` (checked via `has_role`); first signup becomes admin, later users default to houseman — avoids privilege escalation.
- Room check-in/out timestamps are set only by the `room_check_in`/`room_check_out` DB functions (server `now()`) — prevents client clock tampering.
- Staff accounts are created by managers via the `createStaff` server function using the admin client after a role check.
- Room status and duration are derived from timestamps, never stored.
