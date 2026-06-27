# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## OPS guard checks

Before changing Employee OPS, Admin OPS Inbox, cake-stock flows, or Bangkok date/time logic, run:

```bash
npm run check:ops-guards
```

This aggregate guard runs:

- `check:bangkok-time` — verifies Bangkok day boundaries, UTC ranges, display times, minute-of-day values, and invalid-date fallbacks.
- `check:ops-inbox` — verifies Admin OPS Inbox Bangkok-day helper behavior and normalized inventory/cake alert keys.
- `check:emp-ops-production` — verifies the Employee OPS production form still includes dispatches, waste quantity, waste-rate UI, and matching draft/input detection.

For a full local sanity check, also run:

```bash
npm run build
```

`npm run lint` currently reports repo-wide lint debt that predates the OPS guard work; do not treat that as a new OPS regression unless the output points at newly touched lines.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
