import { Hono } from "hono";
import backendApp from "@/backend/hono";

const app = new Hono().route("/api", backendApp);

export const GET = (request: Request) => app.fetch(request);
export const POST = (request: Request) => app.fetch(request);
export const PUT = (request: Request) => app.fetch(request);
export const PATCH = (request: Request) => app.fetch(request);
export const DELETE = (request: Request) => app.fetch(request);
