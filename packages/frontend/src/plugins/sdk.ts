import { type InjectionKey, type Plugin, inject } from "vue";

import type { H1 } from "@h1caido/common";

const KEY: InjectionKey<H1.FrontendSDK> = Symbol("SDK");

// Provides the Caido frontend SDK to the Vue app. Use `useSDK()` inside a component.
export const SDKPlugin: Plugin = (app, sdk: H1.FrontendSDK) => {
  app.provide(KEY, sdk);
};

export const useSDK = () => {
  return inject(KEY) as H1.FrontendSDK;
};
