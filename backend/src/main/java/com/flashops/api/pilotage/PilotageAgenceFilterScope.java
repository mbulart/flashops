package com.flashops.api.pilotage;

import java.util.List;

/** Périmètre agence pour recherche (geo admin + réseau RZ), sans modifier les appels sans paramètres. */
public record PilotageAgenceFilterScope(
    List<String> reseauRegions,
    List<Integer> zoneIds,
    Integer paysId,
    Integer provinceId,
    List<Integer> villeIds,
    Integer territoireId,
    List<Integer> communeIds) {

  public PilotageAgenceFilterScope {
    reseauRegions = cleanText(reseauRegions);
    zoneIds = cleanIds(zoneIds);
    villeIds = cleanIds(villeIds);
    communeIds = cleanIds(communeIds);
  }

  public static PilotageAgenceFilterScope empty() {
    return new PilotageAgenceFilterScope(List.of(), List.of(), null, null, List.of(), null, List.of());
  }

  public boolean hasReseau() {
    return !reseauRegions.isEmpty() || !zoneIds.isEmpty();
  }

  public boolean hasGeo() {
    return isPositive(paysId)
        || isPositive(provinceId)
        || !villeIds.isEmpty()
        || isPositive(territoireId)
        || !communeIds.isEmpty();
  }

  public boolean isActive() {
    return hasReseau() || hasGeo();
  }

  private static boolean isPositive(Integer id) {
    return id != null && id > 0;
  }

  private static List<Integer> cleanIds(List<Integer> ids) {
    if (ids == null || ids.isEmpty()) {
      return List.of();
    }
    return ids.stream().filter(PilotageAgenceFilterScope::isPositive).distinct().toList();
  }

  private static List<String> cleanText(List<String> values) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }
    return values.stream()
        .filter(value -> value != null && !value.isBlank())
        .map(String::trim)
        .distinct()
        .toList();
  }
}
