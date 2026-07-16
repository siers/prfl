/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GDRIVE_API_KEY?: string
  readonly VITE_GDRIVE_FOLDER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __BUILD_HASH__: string
