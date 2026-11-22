/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" in builds of a branch made by hand (.github/workflows/build.yml): they don't update. */
  readonly VITE_TRIBUTARY_NO_UPDATES?: string;
}
