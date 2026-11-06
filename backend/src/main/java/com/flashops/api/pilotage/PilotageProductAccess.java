package com.flashops.api.pilotage;

import java.util.List;

/** Accès domaines + produits additionnels (permissions `pilotage.produit.*`). */
public record PilotageProductAccess(
    List<String> domains,
    List<String> baseDomains,
    List<String> extraProductKeys) {

  public boolean transfertRestrictedToExtras() {
    return extraProductKeys != null
        && !extraProductKeys.isEmpty()
        && (baseDomains == null || !baseDomains.contains("transfert"))
        && domains != null
        && domains.contains("transfert");
  }

  public boolean hasExtraProducts() {
    return extraProductKeys != null && !extraProductKeys.isEmpty();
  }
}
