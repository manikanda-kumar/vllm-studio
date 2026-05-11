// Ambient declaration for global CSS side-effect imports (e.g. `import "./globals.css"`).
// Next.js generates this in `.next/types` during dev/build, but `tsc --noEmit` run
// standalone (CI typecheck, `npm run verify`) needs it without a prior build.
declare module "*.css";
