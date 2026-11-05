package com.flashops.api.config;

import com.flashops.api.domain.Role;
import com.flashops.api.domain.Utilisateur;
import com.flashops.api.referentiel.zone.domain.ResponsableZone;
import com.flashops.api.referentiel.zone.repository.ResponsableZoneRepository;
import com.flashops.api.repository.RoleRepository;
import com.flashops.api.repository.UtilisateurRepository;
import java.text.Normalizer;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Crée / synchronise un compte RZ pour chaque responsable de zone. */
@Component
@Order(20)
public class RzUsersSeedInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(RzUsersSeedInitializer.class);

  /** Mot de passe initial des comptes seed RZ (à changer à la première connexion). */
  public static final String DEFAULT_PASSWORD = "FlashOps@2026";

  private final UtilisateurRepository utilisateurs;
  private final RoleRepository roles;
  private final ResponsableZoneRepository responsables;
  private final PasswordEncoder passwordEncoder;

  public RzUsersSeedInitializer(
      UtilisateurRepository utilisateurs,
      RoleRepository roles,
      ResponsableZoneRepository responsables,
      PasswordEncoder passwordEncoder) {
    this.utilisateurs = utilisateurs;
    this.roles = roles;
    this.responsables = responsables;
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  public void run(ApplicationArguments args) {
    Role rzRole = roles.findByCode("RZ").orElse(null);
    if (rzRole == null) {
      log.warn("Rôle RZ absent — seed utilisateurs RZ ignoré");
      return;
    }
    int created = 0;
    int updated = 0;
    for (ResponsableZone rz : responsables.findAllByOrderByNomAsc()) {
      if (!rz.isActif()) {
        continue;
      }
      String email = emailFor(rz);
      var existing = utilisateurs.findByCourrielIgnoreCase(email);
      if (existing.isPresent()) {
        Utilisateur u = existing.get();
        boolean changed = false;
        if (u.getRole() == null || !"RZ".equals(u.getRole().getCode())) {
          u.setRole(rzRole);
          changed = true;
        }
        if (u.getResponsableZoneId() == null || !u.getResponsableZoneId().equals(rz.getId())) {
          u.setResponsableZoneId(rz.getId());
          changed = true;
        }
        if (u.getAgenceId() != null) {
          u.setAgenceId(null);
          changed = true;
        }
        if (!u.isActif()) {
          u.setActif(true);
          changed = true;
        }
        if (changed) {
          utilisateurs.save(u);
          updated++;
        }
        continue;
      }
      Utilisateur u = new Utilisateur();
      u.setCourriel(email);
      u.setNomComplet(rz.getNom());
      u.setRole(rzRole);
      u.setActif(true);
      u.setResponsableZoneId(rz.getId());
      u.setAgenceId(null);
      u.setMotDePasseHash(passwordEncoder.encode(DEFAULT_PASSWORD));
      u.setVersionSession(0L);
      utilisateurs.save(u);
      created++;
      log.info("Compte RZ créé : {} ({})", email, rz.getCode());
    }
    if (created > 0 || updated > 0) {
      log.info("Seed RZ terminé — créés={}, synchronisés={}", created, updated);
    }
  }

  /** Ex. « BIENFAIT S » → bienfait.s@flash-ops.cloud ; « RICHARD M (interim) » → richard.m.interim@… */
  static String emailFor(ResponsableZone rz) {
    String base = rz.getNom() == null || rz.getNom().isBlank() ? rz.getCode() : rz.getNom();
    String normalized =
        Normalizer.normalize(base, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", ".")
            .replaceAll("^\\.+|\\.+$", "")
            .replaceAll("\\.{2,}", ".");
    if (normalized.isBlank()) {
      normalized = "rz";
    }
    return normalized + "@flash-ops.cloud";
  }
}
