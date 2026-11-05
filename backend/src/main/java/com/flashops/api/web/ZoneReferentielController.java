package com.flashops.api.web;

import com.flashops.api.admin.PermissionGuard;
import com.flashops.api.referentiel.zone.ZoneReferentielService;
import com.flashops.api.web.dto.ZoneReferentielDtos;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/referentiels")
public class ZoneReferentielController {

  private final ZoneReferentielService zones;
  private final PermissionGuard permissions;

  public ZoneReferentielController(ZoneReferentielService zones, PermissionGuard permissions) {
    this.zones = zones;
    this.permissions = permissions;
  }

  @GetMapping("/responsables-zone")
  public Map<String, List<ZoneReferentielDtos.ResponsableZoneRow>> listResponsables() {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.lire");
    return Map.of("data", zones.listResponsables());
  }

  @GetMapping("/regions")
  public Map<String, List<ZoneReferentielDtos.RegionRow>> listRegions() {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.lire");
    return Map.of("data", zones.listRegions());
  }

  @GetMapping("/zones")
  public Map<String, List<ZoneReferentielDtos.ZoneRow>> listZones() {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.lire");
    return Map.of("data", zones.listZones());
  }
}
