# hermitcrab-mobius

## Session startup
- Always `git pull origin main` before starting work to keep local main in sync with GitHub.

## Architecture
- **blocks/** is the source of truth for shell data. Individual JSON files, one per block.
- **shell.json** is a build artifact assembled from blocks/. Never edit it by hand.
- Run `node build-shell.js` to regenerate shell.json from blocks/.
- **kernel.js** loads shell.json at boot via `loadSeed()` and writes it to localStorage.

## Deployment
- Vercel auto-deploys from `main` branch on push.
- Live at idiothuman.com
- After merging a PR that touches blocks/, run `node build-shell.js` and commit the updated shell.json.
