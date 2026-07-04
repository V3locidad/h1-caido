import { loadPrograms, loadScopes } from "./api";
import type { H1 } from "@h1caido/common";

export function init(sdk: H1.BackendSDK) {
  // Register API endpoints the frontend can call.
  sdk.api.register("loadPrograms", loadPrograms);
  sdk.api.register("loadScopes", loadScopes);
}
