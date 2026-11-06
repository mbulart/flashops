package com.flashops.api.pilotage;

import com.flashops.api.web.dto.GeoDtos;
import com.flashops.api.web.dto.PilotageDtos;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PilotageFiltresService {

  private static final Set<String> DOMAINES = Set.of("transfert", "monnaie", "service");

  private final PilotageFiltresRepository repository;

  public PilotageFiltresService(PilotageFiltresRepository repository) {
    this.repository = repository;
  }

  public PilotageDtos.FiltresResponse filtres(String domaine) {
    return filtres(domaine, List.of());
  }

  public PilotageDtos.FiltresResponse filtres(String domaine, List<String> restrictProductKeys) {
    if (domaine == null || !DOMAINES.contains(domaine)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "domaine invalide");
    }
    var snap =
        repository
            .load(domaine)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "pilotage indisponible"));
    var stream = snap.produits().stream();
    if (restrictProductKeys != null && !restrictProductKeys.isEmpty()) {
      stream =
          stream.filter(
              p -> productMatchesKeys(p.module(), p.produit(), restrictProductKeys));
    }
    var produits =
        stream
            .map(
                p ->
                    new PilotageDtos.ProduitRow(
                        p.produitId(), p.module(), p.produit(), p.ecran(), p.partenaire()))
            .toList();
    var types =
        snap.typesOperation().stream()
            .map(t -> new PilotageDtos.TypeOperationRow(t.typeOperationId(), t.libelle()))
            .toList();
    return new PilotageDtos.FiltresResponse(produits, snap.categories(), types);
  }

  private static boolean productMatchesKeys(String module, String produit, List<String> keys) {
    String m = normalizeKey(module);
    String p = normalizeKey(produit);
    for (String key : keys) {
      String k = normalizeKey(key);
      if (k.isEmpty()) {
        continue;
      }
      if (m.equals(k) || p.equals(k) || m.contains(k) || p.contains(k)) {
        return true;
      }
    }
    return false;
  }

  private static String normalizeKey(String raw) {
    if (raw == null) {
      return "";
    }
    return raw.trim().toUpperCase().replace(' ', '_').replace('-', '_');
  }

  public List<PilotageDtos.AgenceRow> searchAgences(
      String q, int limit, PilotageAgenceFilterScope scope, List<Integer> restrictAgenceIds) {
    int cap = Math.min(Math.max(limit, 1), 50);
    if (q == null || q.isBlank()) {
      return List.of();
    }
    var effective = scope != null ? scope : PilotageAgenceFilterScope.empty();
    return repository.searchAgences(q, cap, effective, restrictAgenceIds).stream()
        .map(
            a ->
                new PilotageDtos.AgenceRow(
                    a.agenceId(),
                    a.codeAgence(),
                    a.nom(),
                    a.categorie(),
                    a.posId(),
                    a.fpAgent()))
        .toList();
  }

  public List<PilotageDtos.AgentRow> searchAgents(
      String q,
      Integer agenceId,
      int limit,
      PilotageAgenceFilterScope scope,
      List<Integer> restrictAgenceIds) {
    int cap = Math.min(Math.max(limit, 1), 50);
    if (q == null || q.isBlank()) {
      return List.of();
    }
    var effective = scope != null ? scope : PilotageAgenceFilterScope.empty();
    return repository.searchAgents(q, agenceId, cap, effective, restrictAgenceIds).stream()
        .map(a -> new PilotageDtos.AgentRow(a.agentId(), a.nom()))
        .toList();
  }

  public List<PilotageDtos.CouloirRow> listCouloirs(String domaine) {
    if (domaine == null || !DOMAINES.contains(domaine)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "domaine invalide");
    }
    return repository.listCouloirs(domaine).stream()
        .map(c -> new PilotageDtos.CouloirRow(c.code(), c.label()))
        .toList();
  }

  public List<PilotageDtos.ReseauRefRow> listRegions() {
    return repository.listRegions().stream()
        .map(r -> new PilotageDtos.ReseauRefRow(r.id(), r.code(), r.libelle()))
        .toList();
  }

  public List<PilotageDtos.ReseauRefRow> listZones(List<String> reseauRegions) {
    return repository.listZones(reseauRegions).stream()
        .map(z -> new PilotageDtos.ReseauRefRow(z.id(), z.code(), z.libelle()))
        .toList();
  }

  public List<GeoDtos.PaysRow> geoPays() {
    return repository.listGeoPays().stream()
        .map(
            p ->
                new GeoDtos.PaysRow(
                    p.id(), p.codeIso(), p.libelle(), null, null, true))
        .toList();
  }

  public List<GeoDtos.ProvinceRow> geoProvinces(short paysId) {
    return repository.listGeoProvinces(paysId).stream()
        .map(
            p ->
                new GeoDtos.ProvinceRow(
                    p.id(), p.paysId(), "", p.libelle(), null, null, (short) 0, true))
        .toList();
  }

  public List<GeoDtos.VilleRow> geoVillesByPays(short paysId, List<String> reseauRegions) {
    return repository.listGeoVillesByPays(paysId, reseauRegions).stream()
        .map(v -> new GeoDtos.VilleRow(v.id(), v.provinceId(), "", v.libelle(), null, null, true))
        .toList();
  }

  public List<GeoDtos.VilleRow> geoVilles(short provinceId) {
    return repository.listGeoVilles(provinceId).stream()
        .map(
            v ->
                new GeoDtos.VilleRow(
                    v.id(), v.provinceId(), "", v.libelle(), null, null, true))
        .toList();
  }

  public List<GeoDtos.TerritoireRow> geoTerritoires(short provinceId) {
    return repository.listGeoTerritoires(provinceId).stream()
        .map(
            t ->
                new GeoDtos.TerritoireRow(
                    t.id(), t.provinceId(), "", t.libelle(), null, null, true))
        .toList();
  }

  public List<GeoDtos.CommuneRow> geoCommunes(Short villeId, Short territoireId, Short provinceId) {
    return repository.listGeoCommunes(villeId, territoireId).stream()
        .map(
            c ->
                new GeoDtos.CommuneRow(
                    c.id(), villeId, territoireId, provinceId, "", c.libelle(), null, null, true))
        .toList();
  }

  public static PilotageAgenceFilterScope scopeFromParams(
      List<String> reseauRegions,
      List<Integer> zoneIds,
      Integer paysId,
      Integer provinceId,
      List<Integer> villeIds,
      Integer territoireId,
      List<Integer> communeIds) {
    return new PilotageAgenceFilterScope(
        reseauRegions, zoneIds, paysId, provinceId, villeIds, territoireId, communeIds);
  }
}
