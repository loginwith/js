import esbuild from 'esbuild'

function error(err) {
  console.log(err)
  process.exit(1)
}

let watch

if (process.env.NODE_ENV != 'production') {
  watch = {
    onRebuild(error, result) {
      if (error) console.error('watch build failed:', error)
      else console.log('watch build succeeded:', result)
    },
  }
}

esbuild
  .build({
    color: true,
    entryPoints: ["src/index.ts", "src/ui.jsx"],
    outdir: "dist/v1",
    bundle: true,
    define: {
      'global': 'window',
      //'process': '{"env": {"NODE_ENV": "production"}}',
    },
    inject: ['esbuild.inject.js'],
    sourcemap: true,
    minify: process.env.NODE_ENV == 'production',
    splitting: true,
    //format: "esm",
    format: "esm",
    //format: "iife",
    target: ["esnext"],
    //target: ["es6"],
    platform: 'browser',
    watch,
  })
  .catch(error)
