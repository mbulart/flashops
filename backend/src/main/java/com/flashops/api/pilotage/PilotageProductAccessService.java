package com.flashops.api.pilotage;

import com.flashops.api.repository.PermissionRepository;
import com.flashops.api.repository.UtilisateurRepository;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PilotageProductAccessService {

  private static final String PREFIX = "pilotage.produit.";

  private final PilotageDomainScope domainScope;
  private final PermissionRepository permissions;
  private final UtilisateurRepository utilisateurs;

  public PilotageProductAccessService(
      PilotageDomainScope domainScope,
      PermissionRepository permissions,
      UtilisateurRepository utilisateurs) {
    this.domainScope = domainScope;
    this.permissions = permissions;
    this.utilisateurs = utilisateurs;
  }

  public PilotageProductAccess resolve(int userId) {
    List<String> base = domainScope.allowed(userId);
    List<String> extras = extraProductKeys(userId);
    Set<String> domains = new LinkedHashSet<>(base);
    if (!extras.isEmpty()) {
      // Produits hors domaine de base (ex. Flash Transfer) → ouvrir le domaine transfert.
      domains.add("transfert");
    }
    return new PilotageProductAccess(List.copyOf(domains), List.copyOf(base), extras);
  }

  public List<String> extraProductKeys(int userId) {
    var user = utilisateurs.findWithRoleById(userId).orElse(null);
    if (user == null || user.getRole() == null) {
      return List.of();
    }
    if ("SUPER_ADMIN".equals(user.getRole().getCode())) {
      return List.of();
    }
    Set<String> keys = new LinkedHashSet<>();
    for (String code : permissions.findCodesForUser(userId)) {
      if (code == null || !code.startsWith(PREFIX)) {
        continue;
      }
      String slug = code.substring(PREFIX.length()).trim();
      if (slug.isEmpty()) {
        continue;
      }
      keys.add(slug.replace('_', ' ').toUpperCase(Locale.ROOT).replace(' ', '_'));
      keys.add(slug.toUpperCase(Locale.ROOT));
    }
    // Alias lisibles
    if (keys.contains("FLASH_TRANSFER") || keys.contains("FLASHTRANSFER")) {
      keys.add("FLASH_TRANSFER");
      keys.add("FLASHTRANSFER");
    }
    return List.copyOf(keys);
  }

  public List<String> permissionCodesForUser(int userId) {
    return permissions.findCodesForUser(userId);
  }

  /** Filtre une liste de modules/produits autorisés pour le domaine transfert restreint. */
  public boolean matchesExtraProduct(String module, String produit, List<String> keys) {
    if (keys == null || keys.isEmpty()) {
      return true;
    }
    String m = normalize(module);
    String p = normalize(produit);
    for (String key : keys) {
      String k = normalize(key);
      if (k.isEmpty()) {
        continue;
      }
      if (m.equals(k) || p.equals(k) || m.contains(k) || p.contains(k)) {
        return true;
      }
    }
    return false;
  }

  private static String normalize(String raw) {
    if (raw == null) {
      return "";
    }
    return raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
  }

  public List<String> restrictDomains(int userId, List<String> requested) {
    PilotageProductAccess access = resolve(userId);
    Set<String> allowed = new LinkedHashSet<>(access.domains());
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
}
