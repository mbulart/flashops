package com.flashops.api.pilotage;

import java.util.List;

public final class PilotageBundleParams {

  private PilotageBundleParams() {}

  public static PilotageBundleQuery toQuery(
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
      List<String> reseauRegions,
      List<Integer> zoneIds,
      Integer paysId,
      Integer provinceId,
      List<Integer> villeIds,
      Integer territoireId,
      List<Integer> communeIds) {
    var scope =
        PilotageFiltresService.scopeFromParams(
            reseauRegions, zoneIds, paysId, provinceId, villeIds, territoireId, communeIds);
    var clean = PilotageProductRules.cleanDomaines(domaines);
    String primary = clean.isEmpty() ? "" : String.join(",", clean);
    return new PilotageBundleQuery(
        primary,
        devise,
        from,
        to,
        nullToEmpty(produitIds),
        ecran,
        nullToEmpty(statutUniformes),
        nullToEmpty(categories),
        nullToEmpty(agenceIds),
        nullToEmpty(agentIds),
        nullToEmpty(typeOperationIds),
        jourFiltre,
        nullToEmpty(couloirCodes),
        scope,
        clean);
  }

  private static <T> List<T> nullToEmpty(List<T> list) {
    return list == null ? List.of() : list;
  }
}
