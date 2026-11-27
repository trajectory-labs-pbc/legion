// happy-dom's DOM, global before any test file or library that reads it is evaluated.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "http://localhost/" });
