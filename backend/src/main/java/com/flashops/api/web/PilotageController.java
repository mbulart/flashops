package com.flashops.api.web;

import com.flashops.api.admin.PermissionGuard;
import com.flashops.api.pilotage.PilotageAgenceFilterScope;
import com.flashops.api.pilotage.PilotageAnalyticsService;
import com.flashops.api.pilotage.PilotageBundleParams;
import com.flashops.api.pilotage.PilotageBundleQuery;
import com.flashops.api.pilotage.PilotageDomainScope;
import com.flashops.api.pilotage.PilotageFiltresService;
import com.flashops.api.pilotage.PilotageMetaService;
import com.flashops.api.pilotage.PilotageProductAccess;
import com.flashops.api.pilotage.PilotageProductAccessService;
import com.flashops.api.scope.UserDataScope;
import com.flashops.api.scope.UserDataScopeService;
import com.flashops.api.web.dto.GeoDtos;
import com.flashops.api.web.dto.PilotageDtos;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pilotage")
public class PilotageController {

  private final PilotageMetaService metaService;
  private final PilotageFiltresService filtresService;
  private final PilotageAnalyticsService analyticsService;
  private final PermissionGuard permissions;
  private final UserDataScopeService dataScope;
  private final PilotageDomainScope domainScope;
  private final PilotageProductAccessService productAccess;

  public PilotageController(
      PilotageMetaService metaService,
      PilotageFiltresService filtresService,
      PilotageAnalyticsService analyticsService,
      PermissionGuard permissions,
      UserDataScopeService dataScope,
      PilotageDomainScope domainScope,
      PilotageProductAccessService productAccess) {
    this.metaService = metaService;
    this.filtresService = filtresService;
    this.analyticsService = analyticsService;
    this.permissions = permissions;
    this.dataScope = dataScope;
    this.domainScope = domainScope;
    this.productAccess = productAccess;
  }

  @GetMapping("/meta")
  public Map<String, PilotageDtos.MetaResponse> meta() {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "dashboard.voir");
    return Map.of("data", metaService.meta(productAccess.resolve(userId).domains()));
  }

  @GetMapping("/bundle")
  public Map<String, PilotageDtos.BundleResponse> bundle(
      @RequestParam("domaine") java.util.List<String> domaine,
      @RequestParam("devise") String devise,
      @RequestParam("from") String from,
      @RequestParam("to") String to,
      @RequestParam(value = "produit_id", required = false) List<Integer> produitIds,
      @RequestParam(value = "ecran", required = false) String ecran,
      @RequestParam(value = "statut_uniforme", required = false) List<String> statutUniformes,
      @RequestParam(value = "categorie", required = false) List<String> categories,
      @RequestParam(value = "agence_id", required = false) List<Integer> agenceIds,
      @RequestParam(value = "agent_id", required = false) List<Integer> agentIds,
      @RequestParam(value = "type_operation_id", required = false) List<Integer> typeOperationIds,
      @RequestParam(value = "jour_filtre", required = false) String jourFiltre,
      @RequestParam(value = "couloir", required = false) List<String> couloirCodes,
      @RequestParam(value = "reseau_region", required = false) List<String> reseauRegion,
      @RequestParam(value = "zone_id", required = false) List<Integer> zoneId,
      @RequestParam(value = "pays_id", required = false) Integer paysId,
      @RequestParam(value = "province_id", required = false) Integer provinceId,
      @RequestParam(value = "ville_id", required = false) List<Integer> villeId,
      @RequestParam(value = "territoire_id", required = false) Integer territoireId,
      @RequestParam(value = "commune_id", required = false) List<Integer> communeId) {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    var query =
        scopedQuery(
            domaine,
            devise,
            from,
            to,
            produitIds,
            ecran,
            statutUniformes,
            categories,
            agenceIds,
            agentIds,
            typeOperationIds,
            jourFiltre,
            couloirCodes,
            reseauRegion,
            zoneId,
            paysId,
            provinceId,
            villeId,
            territoireId,
            communeId);
    return Map.of("data", analyticsService.bundle(query));
  }

  @GetMapping("/agences/classement")
  public Map<String, PilotageDtos.AgenceClassementPage> classementAgences(
      @RequestParam("domaine") java.util.List<String> domaine,
      @RequestParam("devise") String devise,
      @RequestParam("from") String from,
      @RequestParam("to") String to,
      @RequestParam(value = "produit_id", required = false) List<Integer> produitIds,
      @RequestParam(value = "ecran", required = false) String ecran,
      @RequestParam(value = "statut_uniforme", required = false) List<String> statutUniformes,
      @RequestParam(value = "categorie", required = false) List<String> categories,
      @RequestParam(value = "agence_id", required = false) List<Integer> agenceIds,
      @RequestParam(value = "agent_id", required = false) List<Integer> agentIds,
      @RequestParam(value = "type_operation_id", required = false) List<Integer> typeOperationIds,
      @RequestParam(value = "jour_filtre", required = false) String jourFiltre,
      @RequestParam(value = "couloir", required = false) List<String> couloirCodes,
      @RequestParam(value = "reseau_region", required = false) List<String> reseauRegion,
      @RequestParam(value = "zone_id", required = false) List<Integer> zoneId,
      @RequestParam(value = "pays_id", required = false) Integer paysId,
      @RequestParam(value = "province_id", required = false) Integer provinceId,
      @RequestParam(value = "ville_id", required = false) List<Integer> villeId,
      @RequestParam(value = "territoire_id", required = false) Integer territoireId,
      @RequestParam(value = "commune_id", required = false) List<Integer> communeId,
      @RequestParam(value = "ordre", defaultValue = "top") String ordre,
      @RequestParam(value = "tri", defaultValue = "montant") String tri,
      @RequestParam(value = "page", defaultValue = "1") int page,
      @RequestParam(value = "size", defaultValue = "10") int size) {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    var query =
        scopedQuery(
            domaine,
            devise,
            from,
            to,
            produitIds,
            ecran,
            statutUniformes,
            categories,
            agenceIds,
            agentIds,
            typeOperationIds,
            jourFiltre,
            couloirCodes,
            reseauRegion,
            zoneId,
            paysId,
            provinceId,
            villeId,
            territoireId,
            communeId);
    boolean byVolume = "volume".equalsIgnoreCase(tri);
    return Map.of(
        "data",
        analyticsService.classementAgences(
            query, "pire".equalsIgnoreCase(ordre), page, size, byVolume));
  }

  @GetMapping("/couloirs/classement")
  public Map<String, PilotageDtos.CouloirClassementPage> classementCouloirs(
      @RequestParam("domaine") java.util.List<String> domaine,
      @RequestParam("devise") String devise,
      @RequestParam("from") String from,
      @RequestParam("to") String to,
      @RequestParam(value = "produit_id", required = false) List<Integer> produitIds,
      @RequestParam(value = "ecran", required = false) String ecran,
      @RequestParam(value = "statut_uniforme", required = false) List<String> statutUniformes,
      @RequestParam(value = "categorie", required = false) List<String> categories,
      @RequestParam(value = "agence_id", required = false) List<Integer> agenceIds,
      @RequestParam(value = "agent_id", required = false) List<Integer> agentIds,
      @RequestParam(value = "type_operation_id", required = false) List<Integer> typeOperationIds,
      @RequestParam(value = "jour_filtre", required = false) String jourFiltre,
      @RequestParam(value = "couloir", required = false) List<String> couloirCodes,
      @RequestParam(value = "reseau_region", required = false) List<String> reseauRegion,
      @RequestParam(value = "zone_id", required = false) List<Integer> zoneId,
      @RequestParam(value = "pays_id", required = false) Integer paysId,
      @RequestParam(value = "province_id", required = false) Integer provinceId,
      @RequestParam(value = "ville_id", required = false) List<Integer> villeId,
      @RequestParam(value = "territoire_id", required = false) Integer territoireId,
      @RequestParam(value = "commune_id", required = false) List<Integer> communeId,
      @RequestParam(value = "ordre", defaultValue = "top") String ordre,
      @RequestParam(value = "page", defaultValue = "1") int page,
      @RequestParam(value = "size", defaultValue = "10") int size) {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    var query =
        scopedQuery(
            domaine,
            devise,
            from,
            to,
            produitIds,
            ecran,
            statutUniformes,
            categories,
            agenceIds,
            agentIds,
            typeOperationIds,
            jourFiltre,
            couloirCodes,
            reseauRegion,
            zoneId,
            paysId,
            provinceId,
            villeId,
            territoireId,
            communeId);
    return Map.of(
        "data",
        analyticsService.classementCouloirs(query, "pire".equalsIgnoreCase(ordre), page, size));
  }

  @GetMapping("/export")
  public Map<String, PilotageDtos.ExportResponse> export(
      @RequestParam("domaine") java.util.List<String> domaine,
      @RequestParam("devise") String devise,
      @RequestParam("from") String from,
      @RequestParam("to") String to,
      @RequestParam(value = "produit_id", required = false) List<Integer> produitIds,
      @RequestParam(value = "ecran", required = false) String ecran,
      @RequestParam(value = "statut_uniforme", required = false) List<String> statutUniformes,
      @RequestParam(value = "categorie", required = false) List<String> categories,
      @RequestParam(value = "agence_id", required = false) List<Integer> agenceIds,
      @RequestParam(value = "agent_id", required = false) List<Integer> agentIds,
      @RequestParam(value = "type_operation_id", required = false) List<Integer> typeOperationIds,
      @RequestParam(value = "jour_filtre", required = false) String jourFiltre,
      @RequestParam(value = "couloir", required = false) List<String> couloirCodes,
      @RequestParam(value = "reseau_region", required = false) List<String> reseauRegion,
      @RequestParam(value = "zone_id", required = false) List<Integer> zoneId,
      @RequestParam(value = "pays_id", required = false) Integer paysId,
      @RequestParam(value = "province_id", required = false) Integer provinceId,
      @RequestParam(value = "ville_id", required = false) List<Integer> villeId,
      @RequestParam(value = "territoire_id", required = false) Integer territoireId,
      @RequestParam(value = "commune_id", required = false) List<Integer> communeId) {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    var query =
        scopedQuery(
            domaine,
            devise,
            from,
            to,
            produitIds,
            ecran,
            statutUniformes,
            categories,
            agenceIds,
            agentIds,
            typeOperationIds,
            jourFiltre,
            couloirCodes,
            reseauRegion,
            zoneId,
            paysId,
            provinceId,
            villeId,
            territoireId,
            communeId);
    return Map.of("data", analyticsService.export(query));
  }

  @GetMapping("/export/produits-mensuel")
  public Map<String, PilotageDtos.ProduitsMensuelExport> exportProduitsMensuel(
      @RequestParam("domaine") java.util.List<String> domaine,
      @RequestParam("devise") String devise,
      @RequestParam("from") String from,
      @RequestParam("to") String to,
      @RequestParam(value = "produit_id", required = false) List<Integer> produitIds,
      @RequestParam(value = "ecran", required = false) String ecran,
      @RequestParam(value = "statut_uniforme", required = false) List<String> statutUniformes,
      @RequestParam(value = "categorie", required = false) List<String> categories,
      @RequestParam(value = "agence_id", required = false) List<Integer> agenceIds,
      @RequestParam(value = "agent_id", required = false) List<Integer> agentIds,
      @RequestParam(value = "type_operation_id", required = false) List<Integer> typeOperationIds,
      @RequestParam(value = "jour_filtre", required = false) String jourFiltre,
      @RequestParam(value = "couloir", required = false) List<String> couloirCodes,
      @RequestParam(value = "reseau_region", required = false) List<String> reseauRegion,
      @RequestParam(value = "zone_id", required = false) List<Integer> zoneId,
      @RequestParam(value = "pays_id", required = false) Integer paysId,
      @RequestParam(value = "province_id", required = false) Integer provinceId,
      @RequestParam(value = "ville_id", required = false) List<Integer> villeId,
      @RequestParam(value = "territoire_id", required = false) Integer territoireId,
      @RequestParam(value = "commune_id", required = false) List<Integer> communeId) {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    var query =
        scopedQuery(
            domaine,
            devise,
            from,
            to,
            produitIds,
            ecran,
            statutUniformes,
            categories,
            agenceIds,
            agentIds,
            typeOperationIds,
            jourFiltre,
            couloirCodes,
            reseauRegion,
            zoneId,
            paysId,
            provinceId,
            villeId,
            territoireId,
            communeId);
    return Map.of("data", analyticsService.exportProduitsMensuel(query));
  }

  @GetMapping("/filtres")
  public Map<String, PilotageDtos.FiltresResponse> filtres(@RequestParam("domaine") String domaine) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "dashboard.voir");
    PilotageProductAccess access = productAccess.resolve(userId);
    String resolved = productAccess.restrictDomains(userId, List.of(domaine)).get(0);
    return Map.of(
        "data",
        filtresService.filtres(
            resolved,
            access.transfertRestrictedToExtras() ? access.extraProductKeys() : List.of()));
  }

  @GetMapping("/agences/{agenceId:\\d+}")
  public Map<String, PilotageDtos.AgenceFiche> agenceFiche(@PathVariable("agenceId") int agenceId) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "dashboard.voir");
    dataScope.requireAgenceAccess(userId, agenceId);
    return Map.of("data", analyticsService.agenceFiche(agenceId));
  }

  @GetMapping("/agences/{agenceId:\\d+}/transactions")
  public Map<String, PilotageDtos.AgenceTransactionsPage> agenceTransactions(
      @PathVariable("agenceId") int agenceId,
      @RequestParam("domaine") java.util.List<String> domaine,
      @RequestParam("devise") String devise,
      @RequestParam("from") String from,
      @RequestParam("to") String to,
      @RequestParam(value = "produit_id", required = false) List<Integer> produitIds,
      @RequestParam(value = "ecran", required = false) String ecran,
      @RequestParam(value = "statut_uniforme", required = false) List<String> statutUniformes,
      @RequestParam(value = "categorie", required = false) List<String> categories,
      @RequestParam(value = "agence_id", required = false) List<Integer> agenceIds,
      @RequestParam(value = "agent_id", required = false) List<Integer> agentIds,
      @RequestParam(value = "type_operation_id", required = false) List<Integer> typeOperationIds,
      @RequestParam(value = "jour_filtre", required = false) String jourFiltre,
      @RequestParam(value = "couloir", required = false) List<String> couloirCodes,
      @RequestParam(value = "reseau_region", required = false) List<String> reseauRegion,
      @RequestParam(value = "zone_id", required = false) List<Integer> zoneId,
      @RequestParam(value = "pays_id", required = false) Integer paysId,
      @RequestParam(value = "province_id", required = false) Integer provinceId,
      @RequestParam(value = "ville_id", required = false) List<Integer> villeId,
      @RequestParam(value = "territoire_id", required = false) Integer territoireId,
      @RequestParam(value = "commune_id", required = false) List<Integer> communeId,
      @RequestParam(value = "partie", required = false) String partie,
      @RequestParam(value = "page", defaultValue = "1") int page,
      @RequestParam(value = "size", defaultValue = "10") int size,
      @RequestParam(value = "export", defaultValue = "false") boolean export) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "dashboard.voir");
    dataScope.requireAgenceAccess(userId, agenceId);
    var query =
        scopedQuery(
            domaine,
            devise,
            from,
            to,
            produitIds,
            ecran,
            statutUniformes,
            categories,
            agenceIds,
            agentIds,
            typeOperationIds,
            jourFiltre,
            couloirCodes,
            reseauRegion,
            zoneId,
            paysId,
            provinceId,
            villeId,
            territoireId,
            communeId);
    return Map.of(
        "data", analyticsService.agenceTransactions(query, agenceId, page, size, partie, export));
  }

  @GetMapping("/agences/geo-all")
  public Map<String, List<PilotageDtos.AgenceGeoPoint>> allLocatedAgences() {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "dashboard.voir");
    UserDataScope scope = dataScope.resolve(userId);
    return Map.of(
        "data",
        analyticsService.allLocatedAgences(scope.unrestricted() ? null : scope.allowedAgenceIds()));
  }

  @GetMapping("/agences/search")
  public Map<String, List<PilotageDtos.AgenceRow>> searchAgences(
      @RequestParam("q") String q,
      @RequestParam(value = "limit", defaultValue = "20") int limit,
      @RequestParam(value = "reseau_region", required = false) List<String> reseauRegion,
      @RequestParam(value = "zone_id", required = false) List<Integer> zoneId,
      @RequestParam(value = "pays_id", required = false) Integer paysId,
      @RequestParam(value = "province_id", required = false) Integer provinceId,
      @RequestParam(value = "ville_id", required = false) List<Integer> villeId,
      @RequestParam(value = "territoire_id", required = false) Integer territoireId,
      @RequestParam(value = "commune_id", required = false) List<Integer> communeId) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "dashboard.voir");
    PilotageAgenceFilterScope scope =
        scopedGeo(
            PilotageFiltresService.scopeFromParams(
                reseauRegion, zoneId, paysId, provinceId, villeId, territoireId, communeId),
            userId);
    UserDataScope userScope = dataScope.resolve(userId);
    var out = new LinkedHashMap<String, List<PilotageDtos.AgenceRow>>();
    out.put(
        "data",
        filtresService.searchAgences(
            q, limit, scope, userScope.unrestricted() ? null : userScope.allowedAgenceIds()));
    return out;
  }

  @GetMapping("/agents/search")
  public Map<String, List<PilotageDtos.AgentRow>> searchAgents(
      @RequestParam("q") String q,
      @RequestParam(value = "agence_id", required = false) Integer agenceId,
      @RequestParam(value = "limit", defaultValue = "20") int limit,
      @RequestParam(value = "reseau_region", required = false) List<String> reseauRegion,
      @RequestParam(value = "zone_id", required = false) List<Integer> zoneId,
      @RequestParam(value = "pays_id", required = false) Integer paysId,
      @RequestParam(value = "province_id", required = false) Integer provinceId,
      @RequestParam(value = "ville_id", required = false) List<Integer> villeId,
      @RequestParam(value = "territoire_id", required = false) Integer territoireId,
      @RequestParam(value = "commune_id", required = false) List<Integer> communeId) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "dashboard.voir");
    if (agenceId != null) {
      dataScope.requireAgenceAccess(userId, agenceId);
    }
    PilotageAgenceFilterScope scope =
        scopedGeo(
            PilotageFiltresService.scopeFromParams(
                reseauRegion, zoneId, paysId, provinceId, villeId, territoireId, communeId),
            userId);
    UserDataScope userScope = dataScope.resolve(userId);
    var out = new LinkedHashMap<String, List<PilotageDtos.AgentRow>>();
    out.put(
        "data",
        filtresService.searchAgents(
            q,
            agenceId,
            limit,
            scope,
            userScope.unrestricted() ? null : userScope.allowedAgenceIds()));
    return out;
  }

  @GetMapping("/geo/pays")
  public Map<String, List<GeoDtos.PaysRow>> geoPays() {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    return Map.of("data", filtresService.geoPays());
  }

  @GetMapping("/geo/provinces")
  public Map<String, List<GeoDtos.ProvinceRow>> geoProvinces(@RequestParam("pays_id") short paysId) {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    return Map.of("data", filtresService.geoProvinces(paysId));
  }

  @GetMapping("/geo/villes")
  public Map<String, List<GeoDtos.VilleRow>> geoVilles(
      @RequestParam(value = "province_id", required = false) Short provinceId,
      @RequestParam(value = "pays_id", required = false) Short paysId,
      @RequestParam(value = "reseau_region", required = false) List<String> reseauRegions) {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    if (paysId != null) {
      return Map.of("data", filtresService.geoVillesByPays(paysId, reseauRegions));
    }
    if (provinceId != null) {
      return Map.of("data", filtresService.geoVilles(provinceId));
    }
    return Map.of("data", List.of());
  }

  @GetMapping("/geo/territoires")
  public Map<String, List<GeoDtos.TerritoireRow>> geoTerritoires(
      @RequestParam("province_id") short provinceId) {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    return Map.of("data", filtresService.geoTerritoires(provinceId));
  }

  @GetMapping("/geo/communes")
  public Map<String, List<GeoDtos.CommuneRow>> geoCommunes(
      @RequestParam(value = "ville_id", required = false) Short villeId,
      @RequestParam(value = "territoire_id", required = false) Short territoireId,
      @RequestParam(value = "province_id", required = false) Short provinceId) {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    return Map.of("data", filtresService.geoCommunes(villeId, territoireId, provinceId));
  }

  @GetMapping("/couloirs")
  public Map<String, List<PilotageDtos.CouloirRow>> couloirs(@RequestParam("domaine") String domaine) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "dashboard.voir");
    String resolved = productAccess.restrictDomains(userId, List.of(domaine)).get(0);
    return Map.of("data", filtresService.listCouloirs(resolved));
  }

  @GetMapping("/reseau/regions")
  public Map<String, List<PilotageDtos.ReseauRefRow>> reseauRegions() {
    permissions.require(AuthSupport.currentUserId(), "dashboard.voir");
    return Map.of("data", filtresService.listRegions());
  }

  @GetMapping("/reseau/zones")
  public Map<String, List<PilotageDtos.ReseauRefRow>> reseauZones(
      @RequestParam(value = "reseau_region", required = false) List<String> reseauRegion) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "dashboard.voir");
    UserDataScope scope = dataScope.resolve(userId);
    List<PilotageDtos.ReseauRefRow> zones = filtresService.listZones(reseauRegion);
    if (!scope.unrestricted() && !scope.allowedZoneIds().isEmpty()) {
      var allowed = scope.allowedZoneIds();
      zones = zones.stream().filter(z -> allowed.contains(z.id())).toList();
    }
    return Map.of("data", zones);
  }

  private PilotageBundleQuery scopedQuery(
      List<String> domaines,
      String devise,
      String from,
      String to,
      List<Integer> produitIds,
      String ecran,
      List<String> statutUniformes,
      List<String> categories,
      List<Integer> agenceIds,
      List<Integer> agentIds,
      List<Integer> typeOperationIds,
      String jourFiltre,
      List<String> couloirCodes,
      List<String> reseauRegion,
      List<Integer> zoneId,
      Integer paysId,
      Integer provinceId,
      List<Integer> villeId,
      Integer territoireId,
      List<Integer> communeId) {
    int userId = AuthSupport.currentUserId();
    UserDataScope scope = dataScope.resolve(userId);
    PilotageProductAccess access = productAccess.resolve(userId);
    List<Integer> zones = scope.intersectZones(zoneId);
    var query =
        PilotageBundleParams.toQuery(
            productAccess.restrictDomains(userId, domaines),
            devise,
            from,
            to,
            produitIds,
            ecran,
            statutUniformes,
            categories,
            agenceIds,
            agentIds,
            typeOperationIds,
            jourFiltre,
            couloirCodes,
            reseauRegion,
            zones,
            paysId,
            provinceId,
            villeId,
            territoireId,
            communeId);
    return query
        .withAgenceIds(scope.intersectAgences(query.agenceIds()))
        .withProductAccess(access.extraProductKeys(), access.transfertRestrictedToExtras());
  }

  private PilotageAgenceFilterScope scopedGeo(PilotageAgenceFilterScope geo, int userId) {
    UserDataScope scope = dataScope.resolve(userId);
    if (scope.unrestricted()) {
      return geo;
    }
    List<Integer> zones = scope.intersectZones(geo.zoneIds());
    return new PilotageAgenceFilterScope(
        geo.reseauRegions(),
        zones,
        geo.paysId(),
        geo.provinceId(),
        geo.villeIds(),
        geo.territoireId(),
        geo.communeIds());
  }
}
