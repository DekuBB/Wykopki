import { getRequiredSecret } from "./security";
export function siteUrl(): string {
  return (getRequiredSecret("URL") ?? "https://wykopk.netlify.app").replace(/\/$/, "");
}
