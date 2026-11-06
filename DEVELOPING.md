# Developing Developer Farm

```bash
npm install
npm run dev                 # rebuild on change + Vite hot reload (use the "Run Extension (Vite HMR)" launch config)
npm test                    # unit tests
npm run typecheck
npm run build               # art + extension + webview
npm run test:integration    # runs the real extension inside the installed VS Code
npm run package             # builds the .vsix
npm run assets              # regenerates the pixel art
npm run dev:webview         # the same page in a browser tab: http://localhost:5174
```

Start with `GAME_DESIGN.md` for the architecture and data formats, and `DEVELOPMENT_ROADMAP.md` for what is done and what is
next. (Neither this file nor those two is part of the packaged extension.)
