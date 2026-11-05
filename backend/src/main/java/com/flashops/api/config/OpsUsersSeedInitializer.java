package com.flashops.api.config;

import com.flashops.api.domain.Role;
import com.flashops.api.domain.Utilisateur;
import com.flashops.api.repository.RoleRepository;
import com.flashops.api.repository.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Comptes ops Flash : admin complet ou VAS (monnaie + service). */
@Component
@Order(26)
public class OpsUsersSeedInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(OpsUsersSeedInitializer.class);

  static final String DEFAULT_PASSWORD = DirectorSeedInitializer.DEFAULT_PASSWORD;

  private static final SeedUser[] USERS = {
    new SeedUser("f.mika@flash.one", "Francis Mika", "ADMIN"),
    new SeedUser("coordination.ops@flash.one", "Bob Kabeya", "ADMIN"),
    new SeedUser("bnzeko@flash.one", "Benie Nzeko", "VAS"),
    new SeedUser("b.kalambay@flash.one", "Béni Kalambay", "VAS"),
  };

  private final UtilisateurRepository utilisateurs;
  private final RoleRepository roles;
  private final PasswordEncoder passwordEncoder;

  public OpsUsersSeedInitializer(
      UtilisateurRepository utilisateurs, RoleRepository roles, PasswordEncoder passwordEncoder) {
    this.utilisateurs = utilisateurs;
    this.roles = roles;
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  public void run(ApplicationArguments args) {
    int created = 0;
    int updated = 0;
    for (SeedUser spec : USERS) {
      Role role =
          roles
              .findByCode(spec.roleCode())
              .orElseThrow(
                  () -> new IllegalStateException("Rôle " + spec.roleCode() + " manquant (Flyway)"));
      var existing = utilisateurs.findByCourrielIgnoreCase(spec.email());
      if (existing.isPresent()) {
        Utilisateur u = existing.get();
        boolean changed = false;
        if (u.getRole() == null || !spec.roleCode().equals(u.getRole().getCode())) {
          u.setRole(role);
          changed = true;
        }
        if (!spec.fullName().equals(u.getNomComplet())) {
          u.setNomComplet(spec.fullName());
          changed = true;
        }
        if (!u.isActif()) {
          u.setActif(true);
          changed = true;
        }
        if (u.getAgenceId() != null) {
          u.setAgenceId(null);
          changed = true;
        }
        if (u.getResponsableZoneId() != null) {
          u.setResponsableZoneId(null);
          changed = true;
        }
        if (changed) {
          utilisateurs.save(u);
          updated++;
        }
        continue;
      }
      Utilisateur u = new Utilisateur();
      u.setCourriel(spec.email());
      u.setNomComplet(spec.fullName());
      u.setRole(role);
      u.setActif(true);
      u.setAgenceId(null);
      u.setResponsableZoneId(null);
      u.setMotDePasseHash(passwordEncoder.encode(DEFAULT_PASSWORD));
      u.setVersionSession(0L);
      utilisateurs.save(u);
      created++;
      log.info("Compte ops créé : {} ({})", spec.email(), spec.roleCode());
    }
    if (created > 0 || updated > 0) {
      log.info("Seed ops terminé — créés={}, synchronisés={}", created, updated);
    }
  }

  private record SeedUser(String email, String fullName, String roleCode) {}
}
