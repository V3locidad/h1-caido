import { createApp } from "vue";

import { SDKPlugin } from "./plugins/sdk";
import App from "./views/App.vue";
import type { H1 } from "@h1caido/common";

import "./styles/index.css";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";

export const init = (sdk: H1.FrontendSDK) => {
  const app = createApp(App);
  app.use(SDKPlugin, sdk);

  const root = document.createElement("div");
  Object.assign(root.style, { height: "100%", width: "100%" });
  app.mount(root);

  sdk.navigation.addPage("/h1caido", { body: root });
  sdk.sidebar.registerItem("H1Caido", "/h1caido", { icon: "fas fa-bullseye" });
};
