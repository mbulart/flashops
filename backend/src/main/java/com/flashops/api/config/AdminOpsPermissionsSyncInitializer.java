package com.flashops.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * ADMIN = tout sauf paramétrages et suppressions. Réaccorde les nouvelles permissions ops au
 * démarrage (ex. nouveaux modules) sans toucher au menu Paramétrages.
 */
@Component
@Order(28)
public class AdminOpsPermissionsSyncInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(AdminOpsPermissionsSyncInitializer.class);

  private final JdbcTemplate jdbc;

  public AdminOpsPermissionsSyncInitializer(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void run(ApplicationArguments args) {
    int granted =
        jdbc.update(
            """
            INSERT INTO roles_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.code = 'ADMIN'
              AND p.code NOT IN (
                'auth.utilisateurs.lire',
                'auth.utilisateurs.ecrire',
                'auth.roles.lire',
                'auth.roles.ecrire',
                'auth.permissions.lire',
                'auth.parametres.lire',
                'auth.parametres.ecrire',
                'audit.actions.lire',
                'referentiels.geo.synchroniser',
                'referentiels.zones.ecrire',
                'onboarding.admin',
                'workflow.admin'
              )
              AND p.code NOT ILIKE '%%.supprimer'
              AND p.code NOT ILIKE '%%.delete'
            ON CONFLICT DO NOTHING
            """);
    if (granted > 0) {
      log.info("Sync permissions ADMIN ops — accordées={}", granted);
    }
  }
}
