package com.flashops.api.web;

import com.flashops.api.admin.PermissionGuard;
import com.flashops.api.referentiel.zone.ZoneReferentielService;
import com.flashops.api.web.dto.ZoneReferentielDtos;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/referentiels")
public class AdminZoneReferentielController {

  private final ZoneReferentielService zones;
  private final PermissionGuard permissions;

  public AdminZoneReferentielController(ZoneReferentielService zones, PermissionGuard permissions) {
    this.zones = zones;
    this.permissions = permissions;
  }

  @PostMapping("/responsables-zone")
  public Map<String, ZoneReferentielDtos.ResponsableZoneRow> createResponsable(
      @Valid @RequestBody ZoneReferentielDtos.ResponsableZoneInput body) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.ecrire");
    return Map.of("data", zones.createResponsable(body));
  }

  @PutMapping("/responsables-zone/{id}")
  public Map<String, ZoneReferentielDtos.ResponsableZoneRow> updateResponsable(
      @PathVariable int id, @Valid @RequestBody ZoneReferentielDtos.ResponsableZoneInput body) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.ecrire");
    return Map.of("data", zones.updateResponsable(id, body));
  }

  @DeleteMapping("/responsables-zone/{id}")
  public Map<String, String> deleteResponsable(@PathVariable int id) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.ecrire");
    zones.deleteResponsable(id);
    return Map.of("status", "ok");
  }

  @PostMapping("/regions")
  public Map<String, ZoneReferentielDtos.RegionRow> createRegion(
      @Valid @RequestBody ZoneReferentielDtos.RegionInput body) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.ecrire");
    return Map.of("data", zones.createRegion(body));
  }

  @PutMapping("/regions/{id}")
  public Map<String, ZoneReferentielDtos.RegionRow> updateRegion(
      @PathVariable int id, @Valid @RequestBody ZoneReferentielDtos.RegionInput body) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.ecrire");
    return Map.of("data", zones.updateRegion(id, body));
  }

  @DeleteMapping("/regions/{id}")
  public Map<String, String> deleteRegion(@PathVariable int id) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.ecrire");
    zones.deleteRegion(id);
    return Map.of("status", "ok");
  }

  @PostMapping("/zones")
  public Map<String, ZoneReferentielDtos.ZoneRow> createZone(
      @Valid @RequestBody ZoneReferentielDtos.ZoneInput body) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.ecrire");
    return Map.of("data", zones.createZone(body));
  }

  @PutMapping("/zones/{id}")
  public Map<String, ZoneReferentielDtos.ZoneRow> updateZone(
      @PathVariable int id, @Valid @RequestBody ZoneReferentielDtos.ZoneInput body) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.ecrire");
    return Map.of("data", zones.updateZone(id, body));
  }

  @DeleteMapping("/zones/{id}")
  public Map<String, String> deleteZone(@PathVariable int id) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.zones.ecrire");
    zones.deleteZone(id);
    return Map.of("status", "ok");
  }
}
