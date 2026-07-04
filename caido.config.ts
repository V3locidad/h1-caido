import { defineConfig } from "@caido-community/dev";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "tailwindcss";
// @ts-expect-error no declared types at this time
import tailwindPrimeui from "tailwindcss-primeui";
import tailwindCaido from "@caido/tailwindcss";
import typography from "@tailwindcss/typography";
import path from "path";
import prefixwrap from "postcss-prefixwrap";

const id = "h1caido";
export default defineConfig({
  id,
  name: "H1Caido",
  description: "Interact with HackerOne's API to fetch your bug bounty programs and import their scope into Caido.",
  version: "1.0.0",
  author: {
    name: "julien",
    email: "noreply@h1caido.dev",
    url: "https://github.com/",
  },
  plugins: [
    {
      kind: "backend",
      id: "backend",
      root: "packages/backend",
    },
    {
      kind: "frontend",
      id: "frontend",
      root: "packages/frontend",
      backend: {
        id: "backend",
      },
      vite: {
        plugins: [vue()],
        build: {
          rollupOptions: {
            external: ["@caido/frontend-sdk"],
          },
        },
        resolve: {
          alias: [
            {
              find: "@",
              replacement: path.resolve(__dirname, "packages/frontend/src"),
            },
          ],
        },
        css: {
          postcss: {
            plugins: [
              // This plugin wraps the root element in a unique ID
              // to prevent styling conflicts between plugins
              prefixwrap(`#plugin--${id}`),

              tailwindcss({
                corePlugins: {
                  preflight: false,
                },
                content: ["./packages/frontend/src/**/*.{vue,ts}", "./node_modules/@caido/primevue/dist/primevue.mjs"],
                darkMode: ["selector", '[data-mode="dark"]'],
                plugins: [tailwindPrimeui, tailwindCaido, typography],
              }),
            ],
          },
        },
      },
    },
  ],
});
