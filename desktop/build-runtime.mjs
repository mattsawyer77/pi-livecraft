import { build } from 'esbuild'

const bundles = [
  ['desktop/main.ts', 'dist-desktop/main.js'],
  ['desktop/preload.ts', 'dist-desktop/preload.js'],
  ['server/backend.ts', 'dist-runtime/backend.js'],
  ['server/manager-supervisor.ts', 'dist-runtime/manager-supervisor.js'],
]

await Promise.all(
  bundles.map(([entryPoint, outfile]) =>
    build({
      bundle: true,
      entryPoints: [entryPoint],
      format: 'esm',
      outfile,
      packages: entryPoint.startsWith('server/') ? 'external' : 'bundle',
      platform: 'node',
      sourcemap: false,
    })
  ),
)
