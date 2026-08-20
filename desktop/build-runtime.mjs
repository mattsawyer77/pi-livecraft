import { mkdir, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'

const bundles = [
  ['desktop/main.ts', 'dist-desktop/main.js'],
  ['desktop/preload.ts', 'dist-desktop/preload.js'],
  ['server/backend.ts', 'dist-runtime/backend.js'],
  ['server/manager-supervisor.ts', 'dist-runtime/manager-supervisor.js'],
  ['server/manager.ts', 'dist-runtime/manager.js'],
]

await Promise.all(
  bundles.map(([entryPoint, outfile]) =>
    build({
      bundle: true,
      entryPoints: [entryPoint],
      external: entryPoint.startsWith('desktop/') ? ['electron'] : [],
      format: 'esm',
      outfile,
      packages: entryPoint.startsWith('server/') ? 'external' : 'bundle',
      platform: 'node',
      sourcemap: false,
    })
  ),
)

await mkdir('dist-runtime', { recursive: true })
await writeFile(
  'dist-runtime/manager-runtime-files.json',
  `${JSON.stringify({ version: 1, files: ['dist-runtime/manager.js'] }, null, 2)}\n`,
)
