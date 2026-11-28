import { createHandler } from "./handler.js";
Deno.serve(createHandler({ getEnv: (name) => Deno.env.get(name) }));
