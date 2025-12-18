/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STREAM_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
