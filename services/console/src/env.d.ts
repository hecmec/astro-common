/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** The signed-in admin's email (set by the middleware on every non-public page). */
    email?: string;
  }
}
