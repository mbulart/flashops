package com.flashops.api.web;

import com.flashops.api.admin.PermissionGuard;
import com.flashops.api.agences.AgenceAdminQuery;
import com.flashops.api.agences.AgenceAdminService;
import com.flashops.api.scope.UserDataScope;
import com.flashops.api.scope.UserDataScopeService;
import com.flashops.api.web.dto.AgenceAdminDtos;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/agences")
public class AgenceAdminController {

  private final AgenceAdminService agences;
  private final PermissionGuard permissions;
  private final UserDataScopeService dataScope;

  public AgenceAdminController(
      AgenceAdminService agences, PermissionGuard permissions, UserDataScopeService dataScope) {
    this.agences = agences;
    this.permissions = permissions;
    this.dataScope = dataScope;
  }

  @GetMapping
  public Map<String, AgenceAdminDtos.AgenceAdminPage> list(
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String identifiant,
      @RequestParam(value = "region_id", required = false) Integer regionId,
      @RequestParam(value = "zone_id", required = false) Integer zoneId,
      @RequestParam(required = false) String ville,
      @RequestParam(required = false) String commune,
      @RequestParam(required = false) String province,
      @RequestParam(required = false) String pays,
      @RequestParam(required = false) String categorie,
      @RequestParam(value = "activity_days", required = false) Integer activityDays,
      @RequestParam(value = "statut_activite", required = false) List<String> statutActivites,
      @RequestParam(required = false) String from,
      @RequestParam(required = false) String to,
      @RequestParam(value = "parent_agence_id", required = false) Integer parentAgenceId,
      @RequestParam(value = "sans_coords", required = false) Boolean sansCoords,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "25") int size) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "agences.lire");
    return Map.of(
        "data",
        agences.list(
            buildQuery(
                userId,
                q,
                identifiant,
                regionId,
                zoneId,
                ville,
                commune,
                province,
                pays,
                categorie,
                activityDays,
                statutActivites,
                from,
                to,
                parentAgenceId,
                sansCoords,
                page,
                size)));
  }

  @GetMapping("/export")
  public Map<String, List<AgenceAdminDtos.AgenceAdminRow>> export(
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String identifiant,
      @RequestParam(value = "region_id", required = false) Integer regionId,
      @RequestParam(value = "zone_id", required = false) Integer zoneId,
      @RequestParam(required = false) String ville,
      @RequestParam(required = false) String commune,
      @RequestParam(required = false) String province,
      @RequestParam(required = false) String pays,
      @RequestParam(required = false) String categorie,
      @RequestParam(value = "activity_days", required = false) Integer activityDays,
      @RequestParam(value = "statut_activite", required = false) List<String> statutActivites,
      @RequestParam(required = false) String from,
      @RequestParam(required = false) String to,
      @RequestParam(value = "parent_agence_id", required = false) Integer parentAgenceId,
      @RequestParam(value = "sans_coords", required = false) Boolean sansCoords) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "agences.lire");
    return Map.of(
        "data",
        agences.export(
            buildQuery(
                userId,
                q,
                identifiant,
                regionId,
                zoneId,
                ville,
                commune,
                province,
                pays,
                categorie,
                activityDays,
                statutActivites,
                from,
                to,
                parentAgenceId,
                sansCoords,
                1,
                50_000)));
  }

  @GetMapping("/categories")
  public Map<String, List<String>> categories() {
    permissions.require(AuthSupport.currentUserId(), "agences.lire");
    return Map.of("data", agences.categories());
  }

  @GetMapping("/{agenceId}")
  public Map<String, AgenceAdminDtos.AgenceAdminRow> get(@PathVariable int agenceId) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "agences.lire");
    dataScope.requireAgenceAccess(userId, agenceId);
    return Map.of("data", agences.get(agenceId));
  }

  @PostMapping
  public Map<String, AgenceAdminDtos.AgenceAdminRow> create(
      @Valid @RequestBody AgenceAdminDtos.AgenceAdminInput body) {
    permissions.require(AuthSupport.currentUserId(), "agences.ecrire");
    return Map.of("data", agences.create(body));
  }

  @PutMapping("/{agenceId}")
  public Map<String, AgenceAdminDtos.AgenceAdminRow> update(
      @PathVariable int agenceId, @Valid @RequestBody AgenceAdminDtos.AgenceAdminInput body) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "agences.ecrire");
    dataScope.requireAgenceAccess(userId, agenceId);
    return Map.of("data", agences.update(agenceId, body));
  }

  private AgenceAdminQuery buildQuery(
      int userId,
      String q,
      String identifiant,
      Integer regionId,
      Integer zoneId,
      String ville,
      String commune,
      String province,
      String pays,
      String categorie,
      Integer activityDays,
      List<String> statutActivites,
      String from,
      String to,
      Integer parentAgenceId,
      Boolean sansCoords,
      int page,
      int size) {
    UserDataScope scope = dataScope.resolve(userId);
    List<Integer> restrict = scope.unrestricted() ? null : scope.allowedAgenceIds();
    return new AgenceAdminQuery(
        q,
        identifiant,
        regionId,
        zoneId,
        ville,
        commune,
        province,
        pays,
        categorie,
        activityDays,
        statutActivites,
        from,
        to,
        parentAgenceId,
        sansCoords,
        page,
        size,
        restrict);
  }
}
