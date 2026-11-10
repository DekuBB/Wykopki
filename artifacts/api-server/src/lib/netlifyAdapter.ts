import serverless from "serverless-http";
import app from "../app";

export default async function (request: Request) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers);
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : Buffer.from(await request.arrayBuffer());
  const handler = serverless(app);
  const result = await handler({
    httpMethod: request.method, path: url.pathname, rawUrl: request.url,
    headers, multiValueHeaders: {}, queryStringParameters: Object.fromEntries(url.searchParams),
    body: body?.toString("base64"), isBase64Encoded: !!body,
    requestContext: { identity: { sourceIp: headers["x-forwarded-for"] ?? "127.0.0.1" } },
  }, {}) as { statusCode: number; headers: Record<string, string>; multiValueHeaders?: Record<string, string[]>; body: string; isBase64Encoded?: boolean };
  const responseHeaders = new Headers(result.headers);
  for (const [key, values] of Object.entries(result.multiValueHeaders ?? {})) {
    responseHeaders.delete(key);
    for (const value of values) responseHeaders.append(key, value);
  }
  return new Response([204, 205, 304].includes(result.statusCode) ? null : result.isBase64Encoded ? Buffer.from(result.body, "base64") : result.body, { status: result.statusCode, headers: responseHeaders });
}
