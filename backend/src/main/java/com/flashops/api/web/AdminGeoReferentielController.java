package com.flashops.api.web;

import com.flashops.api.admin.PermissionGuard;
import com.flashops.api.referentiel.geo.GeoReferentielService;
import com.flashops.api.web.dto.GeoDtos;
import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/referentiels/geo/sync")
public class AdminGeoReferentielController {

  private final GeoReferentielService geo;
  private final PermissionGuard permissions;

  public AdminGeoReferentielController(GeoReferentielService geo, PermissionGuard permissions) {
    this.geo = geo;
    this.permissions = permissions;
  }

  @PostMapping("/pays")
  public Map<String, GeoDtos.SyncResult> syncPays() {
    int actorId = AuthSupport.currentUserId();
    permissions.require(actorId, "referentiels.geo.synchroniser");
    return Map.of("data", geo.syncPaysList(actorId));
  }

  @PostMapping("/pays/{codeIso}")
  public Map<String, GeoDtos.SyncResult> syncPaysHierarchy(@PathVariable String codeIso) {
    int actorId = AuthSupport.currentUserId();
    permissions.require(actorId, "referentiels.geo.synchroniser");
    return Map.of("data", geo.syncPaysHierarchy(actorId, codeIso));
  }
}
