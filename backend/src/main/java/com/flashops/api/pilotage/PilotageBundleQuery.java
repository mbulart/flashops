package com.flashops.api.pilotage;

import java.math.BigDecimal;
import java.util.List;

/** Paramètres du bundle pilotage — alignés sur les critères front. */
public record PilotageBundleQuery(
    String domaine,
    String devise,
    List<String> devises,
    BigDecimal tauxUsdCdf,
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
    boolean transfertRestrictedToExtras) {

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
        List.of(),
        null,
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
        false);
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

  public PilotageBundleQuery withMoney(List<String> nextDevises, String displayDevise, BigDecimal taux) {
    return new PilotageBundleQuery(
        domaine,
        displayDevise,
        nextDevises == null ? List.of() : List.copyOf(nextDevises),
        taux,
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
        extraProductKeys,
        transfertRestrictedToExtras);
  }

  public PilotageBundleQuery withPeriod(String from, String to) {
    return new PilotageBundleQuery(
        domaine,
        devise,
        devises,
        tauxUsdCdf,
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
        extraProductKeys,
        transfertRestrictedToExtras);
  }

  public PilotageBundleQuery withAgenceIds(List<Integer> nextAgenceIds) {
    return new PilotageBundleQuery(
        domaine,
        devise,
        devises,
        tauxUsdCdf,
        from,
        to,
        produitIds,
        ecran,
        statutUniformes,
        categories,
        nextAgenceIds == null ? List.of() : List.copyOf(nextAgenceIds),
        agentIds,
        typeOperationIds,
        jourFiltre,
        couloirCodes,
        geoScope,
        domaines,
        extraProductKeys,
        transfertRestrictedToExtras);
  }

  public PilotageBundleQuery withGeoScope(PilotageAgenceFilterScope nextGeoScope) {
    return new PilotageBundleQuery(
        domaine,
        devise,
        devises,
        tauxUsdCdf,
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
        nextGeoScope,
        domaines,
        extraProductKeys,
        transfertRestrictedToExtras);
  }

  public PilotageBundleQuery withProductAccess(List<String> keys, boolean restrictTransfert) {
    return new PilotageBundleQuery(
        domaine,
        devise,
        devises,
        tauxUsdCdf,
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
        keys == null ? List.of() : List.copyOf(keys),
        restrictTransfert);
  }
}
