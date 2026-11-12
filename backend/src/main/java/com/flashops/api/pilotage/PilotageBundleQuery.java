package com.flashops.api.pilotage;

import java.math.BigDecimal;
import java.util.List;

/** Paramètres du bundle pilotage — alignés sur les critères front. */
public record PilotageBundleQuery(
    String domaine,
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
    PilotageAgenceFilterScope geoScope,
    List<String> domaines,
    List<String> extraProductKeys,
    boolean transfertRestrictedToExtras,
    List<String> devises,
    BigDecimal tauxUsdCdf) {

  public PilotageBundleQuery {
    devises = devises == null ? List.of() : List.copyOf(devises);
    tauxUsdCdf = tauxUsdCdf == null ? BigDecimal.ZERO : tauxUsdCdf;
  }

  public PilotageBundleQuery(
      String domaine,
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
      PilotageAgenceFilterScope geoScope,
      List<String> domaines) {
    this(
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
        geoScope,
        domaines,
        List.of(),
        false,
        PilotageMoneySql.ensureNonEmpty(List.of(), devise),
        BigDecimal.ZERO);
  }

  public List<String> resolvedDomaines() {
    List<String> list = PilotageProductRules.cleanDomaines(domaines);
    if (!list.isEmpty()) {
      return list;
    }
    if (domaine == null || domaine.isBlank()) {
      return List.of();
    }
    return List.of(domaine.trim());
  }

  public List<String> resolvedDevises() {
    return PilotageMoneySql.ensureNonEmpty(devises, devise);
  }

  public boolean convertsToUsd() {
    return PilotageMoneySql.convertsToUsd(resolvedDevises(), tauxUsdCdf);
  }

  public boolean usesAgenceGrain() {
    if (agenceIds != null && !agenceIds.isEmpty()) {
      return true;
    }
    if (categories != null && !categories.isEmpty()) {
      return true;
    }
    return geoScope != null && geoScope.isActive();
  }

  public boolean usesAgentGrain() {
    return agentIds != null && !agentIds.isEmpty();
  }

  public boolean hasCouloir() {
    return couloirCodes != null && !couloirCodes.isEmpty();
  }

  /** Couloir seul (ou avec agence / géo / produit / statut) : {@code agg_couloir_jour} est exact. */
  public boolean couloirOnAggregate() {
    return hasCouloir() && !usesAgentGrain() && (typeOperationIds == null || typeOperationIds.isEmpty());
  }

  /**
   * Agent ou type d’opération n’est pas dans le grain couloir : il faut {@code fait_operation}
   * pour ne pas élargir un seau d’agrégat.
   */
  public boolean couloirOnFact() {
    return hasCouloir() && !couloirOnAggregate();
  }

  public PilotageBundleQuery withPeriod(String from, String to) {
    return copy(from, to, agenceIds, geoScope, extraProductKeys, transfertRestrictedToExtras, devises, tauxUsdCdf, devise);
  }

  public PilotageBundleQuery withAgenceIds(List<Integer> nextAgenceIds) {
    return copy(
        from,
        to,
        nextAgenceIds == null ? List.of() : List.copyOf(nextAgenceIds),
        geoScope,
        extraProductKeys,
        transfertRestrictedToExtras,
        devises,
        tauxUsdCdf,
        devise);
  }

  public PilotageBundleQuery withGeoScope(PilotageAgenceFilterScope nextGeoScope) {
    return copy(from, to, agenceIds, nextGeoScope, extraProductKeys, transfertRestrictedToExtras, devises, tauxUsdCdf, devise);
  }

  public PilotageBundleQuery withProductAccess(List<String> keys, boolean restrictTransfert) {
    return copy(
        from,
        to,
        agenceIds,
        geoScope,
        keys == null ? List.of() : List.copyOf(keys),
        restrictTransfert,
        devises,
        tauxUsdCdf,
        devise);
  }

  public PilotageBundleQuery withDevisesAndTaux(List<String> nextDevises, BigDecimal nextTaux) {
    List<String> clean = PilotageMoneySql.cleanDevises(nextDevises);
    BigDecimal taux = nextTaux == null ? BigDecimal.ZERO : nextTaux;
    String display = PilotageMoneySql.displayDevise(clean, taux);
    if (display.isBlank() && !clean.isEmpty()) {
      display = clean.get(0);
    }
    return copy(from, to, agenceIds, geoScope, extraProductKeys, transfertRestrictedToExtras, clean, taux, display);
  }

  private PilotageBundleQuery copy(
      String nextFrom,
      String nextTo,
      List<Integer> nextAgenceIds,
      PilotageAgenceFilterScope nextGeo,
      List<String> nextExtras,
      boolean nextRestrict,
      List<String> nextDevises,
      BigDecimal nextTaux,
      String nextDevise) {
    return new PilotageBundleQuery(
        domaine,
        nextDevise,
        nextFrom,
        nextTo,
        produitIds,
        ecran,
        statutUniformes,
        categories,
        nextAgenceIds,
        agentIds,
        typeOperationIds,
        jourFiltre,
        couloirCodes,
        nextGeo,
        domaines,
        nextExtras,
        nextRestrict,
        nextDevises,
        nextTaux);
  }
}
