// Ambient declarations to make IDE happy when editing Supabase Edge Functions (Deno)
// These are only for local typechecking convenience and do not affect runtime in Deno.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const Deno: {
  env: { get(name: string): string | undefined }
  serve: (...args: any[]) => any
};

declare module 'npm:*' {
  const anyExport: any;
  export default anyExport;
}
