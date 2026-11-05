package com.flashops.api.pilotage;

import com.flashops.api.repository.UtilisateurRepository;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PilotageDomainScope {

  static final List<String> ALL = List.of("transfert", "monnaie", "service");
  static final List<String> VAS = List.of("monnaie", "service");

  private final UtilisateurRepository utilisateurs;

  public PilotageDomainScope(UtilisateurRepository utilisateurs) {
    this.utilisateurs = utilisateurs;
  }

  public List<String> allowed(int userId) {
    var user = utilisateurs.findWithRoleById(userId).orElse(null);
    if (user != null && user.getRole() != null && "VAS".equals(user.getRole().getCode())) {
      return VAS;
    }
    return ALL;
  }

  public List<String> restrict(int userId, List<String> requested) {
    Set<String> allowed = new LinkedHashSet<>(allowed(userId));
    if (requested == null || requested.isEmpty()) {
      return List.copyOf(allowed);
    }
    List<String> filtered = new ArrayList<>();
    for (String raw : requested) {
      if (raw == null || raw.isBlank()) {
        continue;
      }
      String value = raw.trim();
      if (allowed.contains(value) && !filtered.contains(value)) {
        filtered.add(value);
      }
    }
    if (filtered.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "domaine non autorisé");
    }
    return filtered;
  }

  public String require(int userId, String domaine) {
    return restrict(userId, domaine == null ? List.of() : List.of(domaine)).get(0);
  }
}
