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

/** Compte directeur (COO) — accès système complet, hors périmètre AGENT/RZ. */
@Component
@Order(25)
public class DirectorSeedInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DirectorSeedInitializer.class);

  static final String EMAIL = "coo@flash.one";
  static final String FULL_NAME = "Directeur";
  static final String DEFAULT_PASSWORD = "FlashOps@2026";

  private final UtilisateurRepository utilisateurs;
  private final RoleRepository roles;
  private final PasswordEncoder passwordEncoder;

  public DirectorSeedInitializer(
      UtilisateurRepository utilisateurs, RoleRepository roles, PasswordEncoder passwordEncoder) {
    this.utilisateurs = utilisateurs;
    this.roles = roles;
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  public void run(ApplicationArguments args) {
    Role admin =
        roles
            .findByCode("ADMIN")
            .orElseThrow(() -> new IllegalStateException("Rôle ADMIN manquant (Flyway)"));
    var existing = utilisateurs.findByCourrielIgnoreCase(EMAIL);
    if (existing.isPresent()) {
      Utilisateur u = existing.get();
      boolean changed = false;
      if (u.getRole() == null || !"ADMIN".equals(u.getRole().getCode())) {
        u.setRole(admin);
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
        log.info("Compte directeur synchronisé : {}", EMAIL);
      }
      return;
    }
    Utilisateur u = new Utilisateur();
    u.setCourriel(EMAIL);
    u.setNomComplet(FULL_NAME);
    u.setRole(admin);
    u.setActif(true);
    u.setAgenceId(null);
    u.setResponsableZoneId(null);
    u.setMotDePasseHash(passwordEncoder.encode(DEFAULT_PASSWORD));
    u.setVersionSession(0L);
    utilisateurs.save(u);
    log.info("Compte directeur créé : {}", EMAIL);
  }
}
