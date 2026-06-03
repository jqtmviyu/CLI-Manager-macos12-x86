# Commits

## 2026-05-23 — feat(terminal): add configurable newline shortcut for AI CLI

- **Branch**: feat/compact-mode-launcher
- **Context-Id**: 6ea303e0-c45f-4b69-88ab-4787e68fbd70
- **Files**:
  - src/stores/settingsStore.ts
  - src/components/XTermTerminal.tsx
  - src/components/settings/pages/ShortcutSettingsPage.tsx
- **Decisions**:
  - 默认 Shift+Enter，可切 Ctrl/Alt+Enter；通过 useSettingsStore.getState() 在按键时取最新值，避免重建 terminal 实例
  - 拦截放在 attachCustomKeyEventHandler 顶部，单按 Enter 不进入分支，行为不变
  - 设置放在 ShortcutSettingsPage 顶部独立 section，不混入现有「录制式」快捷键列表（语义为固定三选一）

## 2026-06-01 — fix(terminal): prevent pasted newlines from submitting

- **Branch**: feat/compact-mode-launcher
- **Context-Id**: ca128808-8fcb-4fab-a6f0-3679feb32ab7
- **Files**:
  - src/components/XTermTerminal.tsx
  - .trellis/tasks/06-01-fix-terminal-paste-newline-auto-send/check.jsonl
  - .trellis/tasks/06-01-fix-terminal-paste-newline-auto-send/implement.jsonl
  - .trellis/tasks/06-01-fix-terminal-paste-newline-auto-send/prd.md
  - .trellis/tasks/06-01-fix-terminal-paste-newline-auto-send/task.json
- **Decisions**:
  - Bypass xterm Terminal.paste for clipboard input because it normalizes LF to CR, which acts as submit in this terminal flow.
  - Normalize pasted CRLF/CR to LF so pasted trailing lines are preserved without triggering submit.
  - Intercept native paste in capture phase and route Ctrl+V through the same PTY write path.
- **Bugs**:
  - Symptom: pasting text with a trailing newline submitted the terminal input immediately.
  - Root cause: xterm paste preparation converted pasted newlines to carriage returns before onData forwarded them to the PTY.
  - Fix: write normalized pasted text directly to the PTY while keeping ordinary Enter behavior unchanged.
- **Tests**:
  - `npx tsc --noEmit`
  - `npm run build`
  - `git diff --check`

## 2026-06-03 — feat(ui): refine compact launcher experience

- **Branch**: feat/compact-mode-launcher
- **Context-Id**: 92383da6-a03a-4b41-a7be-6a5164810c3f
- **Files**:
  - .trellis/tasks/06-03-06-03-dev-port-collision-handling/check.jsonl
  - .trellis/tasks/06-03-06-03-dev-port-collision-handling/implement.jsonl
  - .trellis/tasks/06-03-06-03-dev-port-collision-handling/prd.md
  - .trellis/tasks/06-03-06-03-dev-port-collision-handling/task.json
  - .trellis/tasks/06-03-ai/check.jsonl
  - .trellis/tasks/06-03-ai/implement.jsonl
  - .trellis/tasks/06-03-ai/prd.md
  - .trellis/tasks/06-03-ai/task.json
  - .trellis/tasks/06-03-command-palette-group-headers/check.jsonl
  - .trellis/tasks/06-03-command-palette-group-headers/implement.jsonl
  - .trellis/tasks/06-03-command-palette-group-headers/prd.md
  - .trellis/tasks/06-03-command-palette-group-headers/task.json
  - .trellis/tasks/06-03-ctrl-p-ui/check.jsonl
  - .trellis/tasks/06-03-ctrl-p-ui/implement.jsonl
  - .trellis/tasks/06-03-ctrl-p-ui/prd.md
  - .trellis/tasks/06-03-ctrl-p-ui/task.json
  - .trellis/tasks/06-03-refine-project-tree-badges/check.jsonl
  - .trellis/tasks/06-03-refine-project-tree-badges/implement.jsonl
  - .trellis/tasks/06-03-refine-project-tree-badges/prd.md
  - .trellis/tasks/06-03-refine-project-tree-badges/task.json
  - package.json
  - scripts/dev-server.mjs
  - src/App.css
  - src/components/CommandPalette.tsx
- **Decisions**:
  - Use a dev server wrapper so npm run dev reuses an existing CLI-Manager Vite server on port 1420 or fails early on unrelated port occupants.
  - Move the command palette onto shared dialog/input/surface styles to reduce inline styling and match the compact UI system.
  - Render project tree CLI badges as muted chips with a small colored dot so tool identity stays visible without oversized colored pills.
- **Tests**:
  - `git diff --cached --check`
  - `npx tsc --noEmit`
