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
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(24)
public class AdminInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(AdminInitializer.class);
  private static final String LEGACY_EMAIL = "admin@flashops.local";

  private final UtilisateurRepository utilisateurs;
  private final RoleRepository roles;
  private final PasswordEncoder passwordEncoder;
  private final FlashOpsProperties props;

  public AdminInitializer(
      UtilisateurRepository utilisateurs,
      RoleRepository roles,
      PasswordEncoder passwordEncoder,
      FlashOpsProperties props) {
    this.utilisateurs = utilisateurs;
    this.roles = roles;
    this.passwordEncoder = passwordEncoder;
    this.props = props;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    String email = props.admin().email().trim().toLowerCase();
    if (email.isBlank() || LEGACY_EMAIL.equals(email)) {
      email = "admin@flash-ops.cloud";
    }
    Role superAdmin =
        roles
            .findByCode("SUPER_ADMIN")
            .orElseThrow(() -> new IllegalStateException("Rôle SUPER_ADMIN manquant (Flyway)"));

    Utilisateur u =
        utilisateurs
            .findByCourrielIgnoreCase(email)
            .or(() -> utilisateurs.findByCourrielIgnoreCase(LEGACY_EMAIL))
            .orElse(null);

    if (u != null) {
      boolean changed = false;
      if (!email.equalsIgnoreCase(u.getCourriel())) {
        if (utilisateurs.findByCourrielIgnoreCase(email).isEmpty()) {
          u.setCourriel(email);
          changed = true;
        }
      }
      if (u.getRole() == null || !"SUPER_ADMIN".equals(u.getRole().getCode())) {
        u.setRole(superAdmin);
        changed = true;
      }
      if (!u.isActif()) {
        u.setActif(true);
        changed = true;
      }
      if (changed) {
        utilisateurs.save(u);
        log.info("Compte super administrateur synchronisé : {}", u.getCourriel());
      }
      return;
    }

    Utilisateur created = new Utilisateur();
    created.setCourriel(email);
    created.setNomComplet(props.admin().fullName());
    created.setMotDePasseHash(passwordEncoder.encode(props.admin().password()));
    created.setRole(superAdmin);
    created.setActif(true);
    created.setVersionSession(0L);
    utilisateurs.save(created);
    log.info("Utilisateur super administrateur créé : {}", email);
  }
}
