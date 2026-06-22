# Move Terminal Action Sidebar Right

## Goal

Move the newly added terminal action sidebar from the left side of the terminal content area to the right side, while keeping all existing actions, drag ordering, visual style, and behavior unchanged.

## What I Already Know

- The existing action sidebar is rendered in `src/components/TerminalTabs.tsx`.
- The sidebar currently uses `ui-terminal-action-sidebar` styles in `src/App.css`.
- It contains actions for new terminal, command templates, command history, fullscreen, session history, Git changes, and live stats.
- Drag ordering is backed by `terminalToolbarOrder`.

## Requirements Decision

- User chose option 2: place the action sidebar at the far right of the whole terminal area.
- Layout should be: terminal content -> Git/live-stats side panel when open -> action sidebar.
- Existing popovers should open inward to the left so they remain usable.

## Requirements

- Move the terminal action sidebar to the right side.
- Place it after Git/live-stats side panels so it is the rightmost terminal-area element.
- Keep all action functions unchanged.
- Keep drag ordering unchanged.
- Keep the same terminal tab themed style.

## Acceptance Criteria

- [ ] The action sidebar renders as the rightmost element in the terminal area.
- [ ] The old left-side action sidebar no longer renders.
- [ ] New terminal, command templates, command history, fullscreen, session history, Git changes, and live stats still use the same handlers.
- [ ] Drag reorder still updates `terminalToolbarOrder`.
- [ ] Type check and production build pass.

## Definition of Done

- TypeScript type check passes.
- Production build passes.
- Manual UI verification items are listed for desktop runtime behavior.

## Out of Scope

- Changing action behavior.
- Changing settings schema.
- Redesigning Git/stats side panels.
- Adding new dependencies.

## Technical Notes

- Likely files: `src/components/TerminalTabs.tsx`, `src/App.css`, possibly command popover components if popover side needs adjustment.
