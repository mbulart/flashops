package com.flashops.api.pilotage;

import java.text.Normalizer;
import java.util.Map;
import java.util.Set;

/**
 * Libellés saisis sur l’agence ({@code province}, et {@code ville} seulement pour un ancien
 * découpage) vers le nom GeoJSON des 26 provinces.
 */
public final class ProvinceGeoNames {

  private static final Map<String, String> DIRECT =
      Map.ofEntries(
          Map.entry("kinshasa", "Kinshasa"),
          Map.entry("nordkivu", "North Kivu"),
          Map.entry("northkivu", "North Kivu"),
          Map.entry("sudkivu", "South Kivu"),
          Map.entry("southkivu", "South Kivu"),
          Map.entry("ituri", "Ituri"),
          Map.entry("maniema", "Maniema"),
          Map.entry("hautkatanga", "Haut-Katanga"),
          Map.entry("hautlomami", "Haut-Lomami"),
          Map.entry("lualaba", "Lualaba"),
          Map.entry("tanganyika", "Tanganyika"),
          Map.entry("kongocentral", "Kongo-Central"),
          Map.entry("kasai", "Kasai"),
          Map.entry("kasaioriental", "Kasai-Oriental"),
          Map.entry("kasaicentral", "Central Kasai"),
          Map.entry("centralkasai", "Central Kasai"),
          Map.entry("equateur", "Équateur"),
          Map.entry("tshopo", "Tshopo"),
          Map.entry("upperuele", "Upper Uele"),
          Map.entry("hautuele", "Upper Uele"),
          Map.entry("loweruele", "Lower Uele"),
          Map.entry("basuele", "Lower Uele"),
          Map.entry("mongala", "Mongala"),
          Map.entry("nordubangi", "Nord-Ubangi"),
          Map.entry("sudubangi", "Sud-Ubangi"),
          Map.entry("tshuapa", "Tshuapa"),
          Map.entry("maindombe", "Mai-Ndombe"),
          Map.entry("kwango", "Kwango"),
          Map.entry("kwilu", "Kwilu"),
          Map.entry("lomami", "Lomami"),
          Map.entry("sankuru", "Sankuru"));

  /** Ville, ou province saisie avec le nom d’une ville. */
  private static final Map<String, String> CITY =
      Map.ofEntries(
          Map.entry("lubumbashi", "Haut-Katanga"),
          Map.entry("likasi", "Haut-Katanga"),
          Map.entry("kipushi", "Haut-Katanga"),
          Map.entry("kasumbalesa", "Haut-Katanga"),
          Map.entry("kolwezi", "Lualaba"),
          Map.entry("dilala", "Lualaba"),
          Map.entry("kalemie", "Tanganyika"),
          Map.entry("kongolo", "Tanganyika"),
          Map.entry("kamina", "Haut-Lomami"),
          Map.entry("matadi", "Kongo-Central"),
          Map.entry("boma", "Kongo-Central"),
          Map.entry("muanda", "Kongo-Central"),
          Map.entry("moanda", "Kongo-Central"),
          Map.entry("bangu", "Kongo-Central"),
          Map.entry("lufu", "Kongo-Central"),
          Map.entry("mbanzangungu", "Kongo-Central"),
          Map.entry("kindu", "Maniema"),
          Map.entry("kisangani", "Tshopo"),
          Map.entry("goma", "North Kivu"),
          Map.entry("beni", "North Kivu"),
          Map.entry("butembo", "North Kivu"),
          Map.entry("bukavu", "South Kivu"),
          Map.entry("uvira", "South Kivu"),
          Map.entry("bunia", "Ituri"),
          Map.entry("kananga", "Central Kasai"),
          Map.entry("tshikapa", "Kasai"),
          Map.entry("mbujimayi", "Kasai-Oriental"),
          Map.entry("mbandaka", "Équateur"));

  private static final Set<String> KATANGA =
      Set.of("Haut-Katanga", "Lualaba", "Tanganyika", "Haut-Lomami");

  private static final Set<String> EST =
      Set.of("North Kivu", "South Kivu", "Ituri", "Maniema", "Tshopo");

  private ProvinceGeoNames() {}

  /** Nom GeoJSON, ou null si le libellé ne désigne aucune province. */
  public static String resolve(String province, String ville) {
    String p = fold(province);
    if (p.isEmpty() || p.equals("0")) {
      return null;
    }
    String direct = DIRECT.get(p);
    if (direct != null) {
      return direct;
    }
    String asCity = CITY.get(p);
    if (asCity != null) {
      return asCity;
    }
    String v = fold(ville);
    return switch (p) {
      case "katanga" -> {
        String placed = CITY.get(v);
        yield placed != null && KATANGA.contains(placed) ? placed : "Haut-Katanga";
      }
      case "est" -> {
        String placed = CITY.get(v);
        yield placed != null && EST.contains(placed) ? placed : null;
      }
      case "bascongo" -> "Kongo-Central";
      case "orientale", "provinceorientale" -> "Tshopo";
      case "kasaioccidental" -> {
        String placed = CITY.get(v);
        yield "Kasai".equals(placed) || "Central Kasai".equals(placed) ? placed : "Central Kasai";
      }
      default -> null;
    };
  }

  static String fold(String value) {
    if (value == null) {
      return "";
    }
    String stripped = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    StringBuilder out = new StringBuilder(stripped.length());
    for (int i = 0; i < stripped.length(); i++) {
      char c = Character.toLowerCase(stripped.charAt(i));
      if (c >= 'a' && c <= 'z' || c >= '0' && c <= '9') {
        out.append(c);
      }
    }
    return out.toString();
  }
}
