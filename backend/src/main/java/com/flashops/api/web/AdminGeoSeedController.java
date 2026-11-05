package com.flashops.api.web;

import com.flashops.api.admin.PermissionGuard;
import com.flashops.api.referentiel.geo.GeoReferentielService;
import com.flashops.api.web.dto.GeoDtos;
import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/referentiels/geo/seed")
public class AdminGeoSeedController {

  private final GeoReferentielService geo;
  private final PermissionGuard permissions;

  public AdminGeoSeedController(GeoReferentielService geo, PermissionGuard permissions) {
    this.geo = geo;
    this.permissions = permissions;
  }

  @PostMapping("/local")
  public Map<String, GeoDtos.SyncResult> seedAllLocal() {
    int actorId = AuthSupport.currentUserId();
    permissions.require(actorId, "referentiels.geo.synchroniser");
    return Map.of("data", geo.seedLocalHierarchiesIfMissing());
  }

  @PostMapping("/local/{codeIso}")
  public Map<String, GeoDtos.SyncResult> seedLocalCountry(
      @PathVariable String codeIso,
      @RequestParam(name = "force", defaultValue = "false") boolean force) {
    int actorId = AuthSupport.currentUserId();
    permissions.require(actorId, "referentiels.geo.synchroniser");
    return Map.of("data", geo.seedLocalCountry(actorId, codeIso, force));
  }
}
