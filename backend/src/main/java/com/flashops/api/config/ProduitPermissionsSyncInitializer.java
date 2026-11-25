package com.flashops.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Crée les permissions {@code pilotage.produit.*} manquantes pour chaque module
 * présent dans {@code pilotage.dim_produit}, afin qu’un nouveau produit apparaisse
 * dans le système sans migration manuelle dédiée.
 */
@Component
@Order(27)
public class ProduitPermissionsSyncInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(ProduitPermissionsSyncInitializer.class);

  private final JdbcTemplate jdbc;

  public ProduitPermissionsSyncInitializer(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void run(ApplicationArguments args) {
    int created =
        jdbc.update(
            """
            INSERT INTO permissions (code, libelle, module)
            SELECT
              left('pilotage.produit.' || lower(regexp_replace(slug, '[^A-Za-z0-9]+', '_', 'g')), 80),
              left('Produit — ' || slug, 200),
              'pilotage'
            FROM (
              SELECT DISTINCT upper(btrim(module)) AS slug
              FROM pilotage.dim_produit
              WHERE produit_id <> 0
                AND btrim(coalesce(module, '')) <> ''
            ) AS s
            WHERE slug <> ''
            ON CONFLICT (code) DO NOTHING
            """);

    int granted =
        jdbc.update(
            """
            INSERT INTO roles_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
              AND p.code LIKE 'pilotage.produit.%'
            ON CONFLICT DO NOTHING
            """);

    if (created > 0 || granted > 0) {
      log.info(
          "Sync permissions produits — créées={}, SUPER_ADMIN/ADMIN accordées={}",
          created,
          granted);
    }
  }
}
