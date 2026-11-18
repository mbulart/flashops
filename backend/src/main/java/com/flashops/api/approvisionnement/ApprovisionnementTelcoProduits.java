package com.flashops.api.approvisionnement;

/** Produits de la demande TELCO, distincts des portefeuilles Mobile Money. */
public final class ApprovisionnementTelcoProduits {

  private ApprovisionnementTelcoProduits() {}

  /**
   * TELCO · Recharges unités (opérateurs), TELCO · *DATA* · Mobile money et TELCO · *DATA* ·
   * Recharges mega. Les numéros bruts et le seau générique {@code TELCO} sont exclus.
   */
  public static boolean matches(String module, String produit, String ecran) {
    if (!"TELCO".equals(upper(module))) {
      return false;
    }
    String name = produit == null ? "" : produit.trim();
    if (name.isEmpty() || name.matches("\\d+") || "TELCO".equals(upper(name))) {
      return false;
    }
    String screen = ecran == null ? "" : ecran.trim();
    if ("RechargesUnites".equals(screen)) {
      return true;
    }
    if ("RechargesMega".equals(screen) || "MobileMoney".equals(screen)) {
      return compact(name).contains("DATA");
    }
    return false;
  }

  public static String ecranLabel(String ecran) {
    String screen = ecran == null ? "" : ecran.trim();
    return switch (screen) {
      case "RechargesUnites" -> "Recharges unités";
      case "RechargesMega" -> "Recharges mega";
      case "MobileMoney" -> "Mobile money";
      default -> screen;
    };
  }

  private static String upper(String raw) {
    return raw == null ? "" : raw.trim().toUpperCase();
  }

  private static String compact(String raw) {
    return upper(raw).replace(" ", "").replace("_", "").replace("-", "");
  }
}
