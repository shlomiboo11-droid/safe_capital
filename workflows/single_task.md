# Workflow: Single Task

## When to use
Any single concrete task: bug fix, new field, UI tweak, feature addition, content change.

---

## Step 1 — Understand
- What exactly is being asked?
- What does "done" look like?

## Step 2 — Scope
List the files that need to change. **Only those files.**

Rules:
- If it's 1-3 files → do it directly, no agent delegation
- If it's 4+ files or a new page/feature → delegate to ONE agent (frontend-developer or debugger)
- Never spawn more than one agent per task

## Step 3 — Execute
Make the changes. Follow these rules:

**Do NOT:**
- Change CSS, design, colors, layout, or styling unless explicitly asked
- Touch files outside the task scope
- "Improve" or "clean up" code you happen to read
- Add features the user didn't ask for

**Do:**
- Make the minimum changes needed
- Keep existing patterns and conventions
- Handle the obvious error case (e.g., duplicate key, empty input)

## Step 4 — Verify
After making changes:
- If a server is running, test the change (curl, preview, or browser)
- If the server needs a restart for code changes, restart it
- Confirm the change works before reporting done

## Step 5 — Report
Tell the user:
- What files changed
- What was done
- Any action needed on their side (refresh, restart, etc.)

That's it. No memory updates, no codebase audits, no multi-agent chains.
