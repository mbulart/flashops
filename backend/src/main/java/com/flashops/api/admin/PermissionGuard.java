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
    Utilisateur u =
        utilisateurs
            .findWithRoleById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthorized"));
    if ("SUPER_ADMIN".equals(u.getRole().getCode())) {
      return;
    }
    boolean ok =
        permissions.findByRoleId(u.getRole().getId()).stream()
            .anyMatch(p -> permissionCode.equals(p.getCode()));
    if (!ok) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "insufficient permissions");
    }
  }
}
