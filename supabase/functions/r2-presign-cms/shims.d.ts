// Ambient declarations to satisfy IDE/TypeScript when editing Supabase Edge Functions locally.
// These functions run in Deno at deploy/runtime, so Node/Vite cannot resolve `npm:` specifiers
// or the global `Deno` symbol. These shims are for editor type checking only.

// Deno global (runtime provides a richer API; `any` here is sufficient to silence editor errors)
declare const Deno: any;

// Deno-style npm specifiers resolved at edge runtime; lightweight explicit exports for editors
declare module 'npm:@supabase/supabase-js@2.39.3' {
  export const createClient: any;
  const _default: any;
  export default _default;
}

declare module 'npm:@aws-sdk/client-s3' {
  export const S3Client: any;
  export const PutObjectCommand: any;
}

declare module 'npm:@aws-sdk/s3-request-presigner' {
  export const getSignedUrl: any;
}
