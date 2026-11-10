import type { Config } from "@netlify/functions";
import handler from "../../artifacts/api-server/src/lib/netlifyAdapter";
export default handler;
export const config: Config = { path: "/api/*" };
