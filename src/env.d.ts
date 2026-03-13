/// <reference types="astro/client" />

interface ENV extends Cloudflare.Env {}

// Global type for Cloudflare env
declare module "cloudflare:workers" {
  const env: ENV;
}

declare namespace App {
  interface Locals {}
}
