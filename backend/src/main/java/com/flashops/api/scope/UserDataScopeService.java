package com.flashops.api.scope;

import com.flashops.api.domain.Utilisateur;
import com.flashops.api.repository.UtilisateurRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserDataScopeService {

  private final UtilisateurRepository utilisateurs;
  private final JdbcTemplate jdbc;

  public UserDataScopeService(UtilisateurRepository utilisateurs, JdbcTemplate jdbc) {
    this.utilisateurs = utilisateurs;
    this.jdbc = jdbc;
  }

  public UserDataScope resolve(int userId) {
    Utilisateur u =
        utilisateurs
            .findWithRoleById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found"));
    String code = u.getRole() == null ? "" : u.getRole().getCode();
    if ("AGENT".equals(code)) {
      Integer agenceId = u.getAgenceId();
      if (agenceId == null || agenceId <= 0) {
        return UserDataScope.none();
      }
      return UserDataScope.restricted(resolveAgentAgenceIds(agenceId), List.of());
    }
    if ("RZ".equals(code)) {
      Integer rzId = u.getResponsableZoneId();
      if (rzId == null || rzId <= 0) {
        return UserDataScope.none();
      }
      return UserDataScope.restricted(resolveRzAgenceIds(rzId), resolveRzZoneIds(rzId));
    }
    return UserDataScope.all();
  }

  public void requireAgenceAccess(int userId, int agenceId) {
    UserDataScope scope = resolve(userId);
    if (!scope.allowsAgence(agenceId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "agence hors périmètre");
    }
  }

  private List<Integer> resolveAgentAgenceIds(int agenceId) {
    Integer parent =
        jdbc.query(
            """
            SELECT parent_agence_id
            FROM pilotage.dim_agence
            WHERE agence_id = ?
            """,
            rs -> rs.next() ? (Integer) rs.getObject("parent_agence_id") : null,
            agenceId);
    if (parent == null) {
      // Agence mère (ou orpheline) : elle-même + filles
      return jdbc.query(
          """
          SELECT agence_id
          FROM pilotage.dim_agence
          WHERE agence_id = ? OR parent_agence_id = ?
          ORDER BY agence_id
          """,
          (rs, i) -> rs.getInt("agence_id"),
          agenceId,
          agenceId);
    }
    // Agence fille : uniquement elle-même
    return List.of(agenceId);
  }

  private List<Integer> resolveRzAgenceIds(int responsableZoneId) {
    return jdbc.query(
        """
        SELECT DISTINCT d.agence_id
        FROM pilotage.dim_agence AS d
        INNER JOIN pilotage.dim_zone AS zn ON zn.zone_id = d.zone_id
        INNER JOIN public.zones AS z
          ON lower(btrim(z.libelle)) = lower(btrim(zn.libelle))
          OR (zn.code IS NOT NULL AND lower(btrim(z.code)) = lower(btrim(zn.code)))
        WHERE z.responsable_zone_id = ?
          AND d.agence_id <> 0
        ORDER BY d.agence_id
        """,
        (rs, i) -> rs.getInt("agence_id"),
        responsableZoneId);
  }

  private List<Integer> resolveRzZoneIds(int responsableZoneId) {
    return jdbc.query(
        """
        SELECT id
        FROM public.zones
        WHERE responsable_zone_id = ?
          AND actif = TRUE
        ORDER BY id
        """,
        (rs, i) -> rs.getInt("id"),
        responsableZoneId);
  }
}
