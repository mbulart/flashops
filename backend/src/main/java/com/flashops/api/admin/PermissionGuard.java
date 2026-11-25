package com.flashops.api.admin;

import com.flashops.api.domain.Utilisateur;
import com.flashops.api.repository.PermissionRepository;
import com.flashops.api.repository.UtilisateurRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class PermissionGuard {

  private final UtilisateurRepository utilisateurs;
  private final PermissionRepository permissions;

  public PermissionGuard(UtilisateurRepository utilisateurs, PermissionRepository permissions) {
    this.utilisateurs = utilisateurs;
    this.permissions = permissions;
  }

  public boolean isSuperAdmin(int userId) {
    Utilisateur u = utilisateurs.findWithRoleById(userId).orElse(null);
    return u != null && u.getRole() != null && "SUPER_ADMIN".equals(u.getRole().getCode());
  }

  public void require(int userId, String permissionCode) {
    requireAny(userId, permissionCode);
  }

  public void requireAny(int userId, String... permissionCodes) {
    Utilisateur u =
        utilisateurs
            .findWithRoleById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthorized"));
    if ("SUPER_ADMIN".equals(u.getRole().getCode())) {
      return;
    }
    if (permissionCodes == null || permissionCodes.length == 0) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "insufficient permissions");
    }
    var codes = permissions.findCodesForUser(userId);
    for (String needed : permissionCodes) {
      if (needed != null && codes.stream().anyMatch(needed::equals)) {
        return;
      }
    }
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "insufficient permissions");
  }
}
