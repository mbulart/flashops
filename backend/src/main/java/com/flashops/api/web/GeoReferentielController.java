package com.flashops.api.web;

import com.flashops.api.admin.PermissionGuard;
import com.flashops.api.referentiel.geo.GeoReferentielService;
import com.flashops.api.web.dto.GeoDtos;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/geo")
public class GeoReferentielController {

  private final GeoReferentielService geo;
  private final PermissionGuard permissions;

  public GeoReferentielController(GeoReferentielService geo, PermissionGuard permissions) {
    this.geo = geo;
    this.permissions = permissions;
  }

  @GetMapping("/pays")
  public Map<String, List<GeoDtos.PaysRow>> listPays() {
    permissions.require(AuthSupport.currentUserId(), "referentiels.geo.lire");
    return Map.of("data", geo.listPays());
  }

  @GetMapping("/provinces")
  public Map<String, List<GeoDtos.ProvinceRow>> listProvinces(@RequestParam("pays_id") Short paysId) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.geo.lire");
    return Map.of("data", geo.listProvinces(paysId));
  }

  @GetMapping("/villes")
  public Map<String, List<GeoDtos.VilleRow>> listVilles(@RequestParam("province_id") Short provinceId) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.geo.lire");
    return Map.of("data", geo.listVilles(provinceId));
  }

  @GetMapping("/territoires")
  public Map<String, List<GeoDtos.TerritoireRow>> listTerritoires(
      @RequestParam("province_id") Short provinceId) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.geo.lire");
    return Map.of("data", geo.listTerritoires(provinceId));
  }

  @GetMapping("/communes")
  public Map<String, List<GeoDtos.CommuneRow>> listCommunes(
      @RequestParam(value = "ville_id", required = false) Short villeId,
      @RequestParam(value = "territoire_id", required = false) Short territoireId,
      @RequestParam(value = "province_id", required = false) Short provinceId) {
    permissions.require(AuthSupport.currentUserId(), "referentiels.geo.lire");
    return Map.of("data", geo.listCommunes(villeId, territoireId, provinceId));
  }
}
