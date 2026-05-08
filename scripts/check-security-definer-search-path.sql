-- Fails CI if any SECURITY DEFINER functions in public schema lack a pinned search_path
WITH funcs AS (
  SELECT n.nspname AS schema,
         p.proname AS name,
         pg_get_function_identity_arguments(p.oid) AS identity_args,
         p.prosecdef,
         EXISTS (
           SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS c
           WHERE c LIKE 'search_path=%'
         ) AS has_pinned
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT schema || '.' || name || '(' || identity_args || ')' AS function_signature
FROM funcs
WHERE prosecdef AND NOT has_pinned
ORDER BY 1;
