import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = process.env.API_INTERNAL_URL ?? "http://localhost:8080";

async function proxy(request: NextRequest) {
  const upstreamUrl = new URL(`/api/${request.nextUrl.pathname.replace(/^\/api\//, "")}${request.nextUrl.search}`, API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");
  responseHeaders.delete("content-encoding");
  return new NextResponse(response.body, { status: response.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
