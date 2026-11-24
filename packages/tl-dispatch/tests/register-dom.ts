import { GlobalRegistrator } from "@happy-dom/global-registrator";

// A DOM before any module that reads one is evaluated; the key engine reads `navigator` at load.
GlobalRegistrator.register({ url: "http://dispatch.test/" });
