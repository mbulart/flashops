package com.flashops.api.referentiel.geo;

import com.flashops.api.referentiel.geo.GeoNamesClient.GeoPlace;

/** Correspondance featureCode GeoNames → niveau référentiel Flash OPS. */
public final class GeoFeatureMapper {

  private GeoFeatureMapper() {}

  public enum AdminLevel {
    PROVINCE,
    VILLE,
    TERRITOIRE,
    COMMUNE,
    SKIP
  }

  public static AdminLevel levelUnderCountry(GeoPlace place) {
    String fcode = normalizeFcode(place);
    if (fcode.startsWith("ADM1")) {
      return AdminLevel.PROVINCE;
    }
    return AdminLevel.SKIP;
  }

  public static AdminLevel levelUnderProvince(GeoPlace place, String countryIso) {
    String fcode = normalizeFcode(place);
    if ("CD".equalsIgnoreCase(countryIso)) {
      return levelUnderProvinceCd(place, fcode);
    }
    if (isVilleFcode(fcode)) {
      return AdminLevel.VILLE;
    }
    if (fcode.startsWith("ADM2")) {
      return AdminLevel.TERRITOIRE;
    }
    if (fcode.startsWith("ADM3") || fcode.startsWith("PPL")) {
      return AdminLevel.COMMUNE;
    }
    return AdminLevel.SKIP;
  }

  private static AdminLevel levelUnderProvinceCd(GeoPlace place, String fcode) {
    String label = place.displayName().toLowerCase();
    if (isVilleFcode(fcode) || label.contains("ville") || label.contains("city")) {
      return AdminLevel.VILLE;
    }
    if (fcode.startsWith("ADM2") || fcode.startsWith("ADM3")) {
      if (label.contains("territoire") || fcode.startsWith("ADM2")) {
        return AdminLevel.TERRITOIRE;
      }
    }
    if (fcode.startsWith("ADM2")) {
      return AdminLevel.TERRITOIRE;
    }
    if (isVilleFcode(fcode)) {
      return AdminLevel.VILLE;
    }
    return AdminLevel.SKIP;
  }

  public static AdminLevel levelUnderVilleOrTerritoire(GeoPlace place) {
    String fcode = normalizeFcode(place);
    if (fcode.startsWith("ADM3") || fcode.startsWith("ADM4") || fcode.startsWith("PPL")) {
      return AdminLevel.COMMUNE;
    }
    return AdminLevel.SKIP;
  }

  public static String buildCode(GeoPlace place) {
    if (place.adminCode2() != null && !place.adminCode2().isBlank()) {
      return sanitizeCode(place.adminCode2());
    }
    if (place.adminCode1() != null && !place.adminCode1().isBlank()) {
      return sanitizeCode(place.adminCode1());
    }
    if (place.geonameId() != null) {
      return "GN" + place.geonameId();
    }
    return sanitizeCode(place.displayName());
  }

  private static boolean isVilleFcode(String fcode) {
    return "PPLA".equals(fcode)
        || "PPLA2".equals(fcode)
        || "PPLA3".equals(fcode)
        || "PPLA4".equals(fcode)
        || "PPLC".equals(fcode);
  }

  private static String normalizeFcode(GeoPlace place) {
    return place.fcode() == null ? "" : place.fcode().trim().toUpperCase();
  }

  private static String sanitizeCode(String raw) {
    String s = raw.trim().toUpperCase().replaceAll("[^A-Z0-9._-]", "_");
    if (s.length() > 40) {
      return s.substring(0, 40);
    }
    return s.isEmpty() ? "X" : s;
  }
}
