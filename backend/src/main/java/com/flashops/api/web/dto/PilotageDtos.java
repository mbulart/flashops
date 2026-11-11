package com.flashops.api.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public final class PilotageDtos {

  private PilotageDtos() {}

  public record DomaineOption(String code, String label) {}

  public record MetaResponse(
      List<DomaineOption> domaines,
      List<String> devises,
      String dataFrom,
      String dataTo,
      boolean pilotageSchemaReady) {}

  public record ProduitRow(
      int produitId, String module, String produit, String ecran, String partenaire) {}

  public record TypeOperationRow(int typeOperationId, String libelle) {}

  public record FiltresResponse(
      List<ProduitRow> produits, List<String> categories, List<TypeOperationRow> typesOperation) {}

  public record AgenceRow(
      int agenceId,
      @JsonProperty("code_agence") String codeAgence,
      String nom,
      String categorie,
      @JsonProperty("pos_id") String posId,
      @JsonProperty("fp_agent") String fpAgent) {}

  public record AgentRow(int agentId, String nom) {}

  /** Région ou zone réseau (pilotage.dim_region / dim_zone). */
  public record ReseauRefRow(int id, String code, String libelle) {}

  /** Couloir pays origine → destination (code = « origine_id|destination_id »). */
  public record CouloirRow(String code, String label) {}

  public record KpiBlock(
      long volume,
      java.math.BigDecimal montant,
      double ticketMoyen,
      long volumeSucces,
      Double momMontantPct,
      Double yoyMontantPct,
      String compareMois,
      java.math.BigDecimal commission,
      @JsonProperty("commission_fcn") java.math.BigDecimal commissionFcn,
      @JsonProperty("commission_agent") java.math.BigDecimal commissionAgent,
      @JsonProperty("commission_fcn_agent") java.math.BigDecimal commissionFcnAgent) {}

  public record TimeseriesPoint(String jour, long volume, java.math.BigDecimal montant) {}

  public record ProductSlice(
      int produitId,
      String module,
      String produit,
      String ecran,
      String partenaire,
      long volume,
      java.math.BigDecimal montant) {}

  /** Point journalier d’un produit (courbes Produits). */
  public record ProductTimeseriesPoint(
      String jour,
      int produitId,
      String module,
      String produit,
      String ecran,
      String partenaire,
      long volume,
      java.math.BigDecimal montant) {}

  public record LigneExport(
      String agence,
      @JsonProperty("code_agence") String codeAgence,
      @JsonProperty("pos_id") String posId,
      String nom,
      String expediteur,
      String beneficiaire,
      String telephone,
      @JsonProperty("telephone_expediteur") String telephoneExpediteur,
      String numero,
      String jour,
      java.math.BigDecimal montant,
      String statut) {}

  public record ExportResponse(
      java.util.List<AgenceRank> agencies,
      java.util.List<LigneExport> lignes,
      boolean lignesTronquees,
      int lignesLimite) {}

  public record ProductMonthlyPoint(
      String mois,
      @JsonProperty("produit_id") int produitId,
      String module,
      String produit,
      String ecran,
      String partenaire,
      long volume,
      java.math.BigDecimal montant) {}

  public record ProduitsMensuelExport(
      String from,
      String to,
      String domaine,
      String devise,
      java.util.List<ProductMonthlyPoint> rows) {}

  public record AgenceRank(
      int agenceId,
      @JsonProperty("code_agence") String codeAgence,
      String nom,
      String categorie,
      @JsonProperty("pos_id") String posId,
      String region,
      String zone,
      long volume,
      java.math.BigDecimal montant,
      java.math.BigDecimal commission,
      @JsonProperty("commission_fcn") java.math.BigDecimal commissionFcn,
      @JsonProperty("commission_agent") java.math.BigDecimal commissionAgent,
      @JsonProperty("commission_fcn_agent") java.math.BigDecimal commissionFcnAgent) {}

  public record AgenceClassementPage(
      long total, int page, int size, java.util.List<AgenceRank> items) {}

  public record CouloirRank(
      String code,
      String label,
      long volume,
      java.math.BigDecimal montant) {}

  public record CouloirClassementPage(
      long total, int page, int size, java.util.List<CouloirRank> items) {}

  public record AgenceGeoPoint(
      int agenceId,
      @JsonProperty("code_agence") String codeAgence,
      String nom,
      double latitude,
      double longitude,
      long volume,
      java.math.BigDecimal montant) {}

  public record BundleResponse(
      String from,
      String to,
      String domaine,
      String devise,
      KpiBlock kpis,
      java.util.List<TimeseriesPoint> timeseries,
      java.util.List<ProductSlice> products,
      java.util.List<ProductTimeseriesPoint> productTimeseries,
      java.util.List<AgenceRank> agencies,
      java.util.List<AgenceGeoPoint> geoPoints,
      boolean couloirIgnored) {}

  public record AgenceFiche(
      int agenceId,
      @JsonProperty("code_agence") String codeAgence,
      String nom,
      String categorie,
      @JsonProperty("pos_id") String posId,
      String region,
      String zone,
      String ville,
      String commune,
      String province,
      String pays,
      Double latitude,
      Double longitude) {}

  public record AgenceTransaction(
      long operationId,
      String jour,
      String heure,
      String produit,
      String ecran,
      String operateur,
      String expediteur,
      String beneficiaire,
      String statut,
      java.math.BigDecimal montant) {}

  public record AgenceTransactionsPage(
      long total,
      int page,
      int size,
      java.math.BigDecimal moyenne,
      java.math.BigDecimal montantTotal,
      java.util.List<AgenceTransaction> lignes) {}
}
