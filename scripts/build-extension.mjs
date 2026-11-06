// Bundles the extension host with esbuild.
//   --watch        rebuild on change
//   --production   minify, no sourcemaps
//   --dev-tools    keep the developer tools (dev-server probing, the test API) in a --production build.
//                  They are on in every other build and always compiled OUT of the packaged extension.
//   --tests        build the VS Code integration-test launcher and suite instead
import { build, context } from 'esbuild';

const flags = new Set(process.argv.slice(2));
const watch = flags.has('--watch');
const production = flags.has('--production');
const devTools = !production || flags.has('--dev-tools');
const withTests = flags.has('--tests');

/** Markers matched by the background problem matcher in .vscode/tasks.json. */
const watchMarkers = {
  name: 'watch-markers',
  setup(b) {
    b.onStart(() => console.log('[watch] build started'));
    b.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) console.error(`    ${location.file}:${location.line}:${location.column}`);
      }
      console.log('[watch] build finished');
    });
  },
};

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: !production,
  minify: production,
  // A compile-time constant: where it is false, esbuild deletes the code behind it (see devTools.d.ts).
  define: { __DEV_TOOLS__: String(devTools) },
  logLevel: 'info',
  plugins: watch ? [watchMarkers] : [],
};

/** @type {import('esbuild').BuildOptions} */
const options = withTests
  ? {
      ...shared,
      entryPoints: {
        'test/runTest': 'test/integration/runTest.ts',
        'test/suite/index': 'test/integration/suite/index.ts',
      },
      outdir: 'out',
      external: ['vscode', '@vscode/test-electron'],
    }
  : {
      ...shared,
      entryPoints: ['src/extension/extension.ts'],
      outfile: 'dist/extension.js',
      external: ['vscode'],
    };

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
