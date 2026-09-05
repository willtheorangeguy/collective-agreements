/// <reference types="astro/client" />

declare global {
  interface Window {
    __API__: string;
  }
}

export {};
