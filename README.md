# 3D Configurator Engine

Reusable 3D furniture configurator engine.

## Architecture

The engine is intentionally separated into independent layers:

- **scene** — renderer and scene composition
- **model** — GLB loading
- **camera** — product navigation
- **lighting** — studio lighting only
- **materials** — reusable global material library
- **animation** — optional product animations such as `Open`
- **rules** — compatibility logic expressed as data
- **state** — current configuration
- **ui** — presentation only

Client-specific data must not be hardcoded into the engine.

## First milestone

The first locked milestone is **Core 3D**:

1. stable responsive canvas
2. real product GLB
3. reliable camera
4. studio lighting
5. shadows and neutral background

Only after Core 3D is validated do we connect the real material library.

## Model contract

Preferred mesh/object names:

- `facade`
- `caisson`
- `interieur`
- `hardware` (optional)
- `accessories` (optional)

A product may optionally contain a GLB animation clip named `Open`. The same clip can later be played forward to open and backward to close.

## Material strategy

Materials are global and reusable across products. During V1, definitions live in `src/data/materials/materials.json`. The Material Engine is kept separate so this source can later be replaced by Supabase without rewriting the renderer.

Large assets (GLB, textures, normal maps, roughness maps, thumbnails, HDRI) will later move to Cloudflare R2.

## Development

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
```

## Roadmap

- v0.1 — project foundation
- v0.2 — real GLB + product framing
- v0.3 — stable studio lighting
- v0.4 — material library import
- v0.5 — configurator rules and UI
- v0.6 — optional Open animation
- v1.0 — stable configurator core
