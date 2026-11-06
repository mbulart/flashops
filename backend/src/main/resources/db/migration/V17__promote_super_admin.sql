-- Compte console : admin@flash-ops.cloud en SUPER_ADMIN.

UPDATE utilisateurs
SET courriel = 'admin@flash-ops.cloud'
WHERE lower(courriel) = 'admin@flashops.local'
  AND NOT EXISTS (
    SELECT 1 FROM utilisateurs u2 WHERE lower(u2.courriel) = 'admin@flash-ops.cloud'
  );

UPDATE utilisateurs u
SET role_id = r.id
FROM roles r
WHERE r.code = 'SUPER_ADMIN'
  AND lower(u.courriel) IN ('admin@flash-ops.cloud', 'admin@flashops.local');
