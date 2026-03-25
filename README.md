# Pixeltopia

A web app to create pixel art.

## Monorepo scaffold

This repository is scaffolded using the architecture in `Dev Docs/Structure.md`, with:

- `apps/web` for the future editor UI.
- `apps/server` for the Node.js backend framework (Fastify).
- `packages/*` for modular editor/domain/engine/shared packages.

## Backend quick start

```bash
npm install
npm run dev:server
```

Health endpoint:

- `GET /health`
- `GET /api/v1/status`
