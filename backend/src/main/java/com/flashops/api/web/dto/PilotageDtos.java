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
      String momStatut,
      java.math.BigDecimal momReference,
      java.math.BigDecimal momEcart,
      String momPeriode,
      String yoyStatut,
      java.math.BigDecimal yoyReference,
      java.math.BigDecimal yoyEcart,
      String yoyPeriode,
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

  public record AgencePeriodeBucket(
      String periode,
      String label,
      @JsonProperty("periode_debut") String periodeDebut,
      @JsonProperty("periode_fin") String periodeFin,
      long volume,
      java.math.BigDecimal montant,
      java.math.BigDecimal commission,
      @JsonProperty("commission_fcn") java.math.BigDecimal commissionFcn,
      @JsonProperty("commission_agent") java.math.BigDecimal commissionAgent,
      @JsonProperty("commission_fcn_agent") java.math.BigDecimal commissionFcnAgent,
      java.util.List<AgenceRank> agencies) {}

  public record AgencesPeriodiqueExport(
      String grain,
      String from,
      String to,
      String domaine,
      String devise,
      java.util.List<AgencePeriodeBucket> periods) {}

  /** Ligne agence × produit pour export périodique. */
  public record AgenceProduitRank(
      int agenceId,
      @JsonProperty("code_agence") String codeAgence,
      String nom,
      String categorie,
      @JsonProperty("pos_id") String posId,
      String region,
      String zone,
      @JsonProperty("produit_id") int produitId,
      String produit,
      long volume,
      java.math.BigDecimal montant,
      java.math.BigDecimal commission,
      @JsonProperty("commission_fcn") java.math.BigDecimal commissionFcn,
      @JsonProperty("commission_agent") java.math.BigDecimal commissionAgent,
      @JsonProperty("commission_fcn_agent") java.math.BigDecimal commissionFcnAgent) {}

  public record AgenceProduitPeriodeBucket(
      String periode,
      String label,
      @JsonProperty("periode_debut") String periodeDebut,
      @JsonProperty("periode_fin") String periodeFin,
      long volume,
      java.math.BigDecimal montant,
      java.math.BigDecimal commission,
      @JsonProperty("commission_fcn") java.math.BigDecimal commissionFcn,
      @JsonProperty("commission_agent") java.math.BigDecimal commissionAgent,
      @JsonProperty("commission_fcn_agent") java.math.BigDecimal commissionFcnAgent,
      java.util.List<AgenceProduitRank> rows) {}

  public record AgencesProduitsPeriodiqueExport(
      String grain,
      String from,
      String to,
      String domaine,
      String devise,
      java.util.List<AgenceProduitPeriodeBucket> periods) {}

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

  /**
   * Classement léger réseau commercial (quelques dizaines de zones). Le front en déduit aussi le
   * Top régions sans requête supplémentaire.
   */
  public record ReseauZoneRank(
      int zoneId,
      String zone,
      String region,
      long volume,
      java.math.BigDecimal montant) {}

  /** {@code code} = nom GeoJSON de la province (après rapprochement de {@code dim_agence.province}). */
  public record ZoneActivite(
      String code, long volume, java.math.BigDecimal montant) {}

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

  /** Ligne de la liste globale Transactions (hors modal agence). */
  public record TransactionListItem(
      long operationId,
      String jour,
      String heure,
      int agenceId,
      @JsonProperty("code_agence") String codeAgence,
      @JsonProperty("agence_nom") String agenceNom,
      String produit,
      String ecran,
      String operateur,
      String expediteur,
      String beneficiaire,
      String statut,
      String devise,
      java.math.BigDecimal montant) {}

  public record TransactionsPage(
      long total,
      int page,
      int size,
      java.math.BigDecimal moyenne,
      java.math.BigDecimal montantTotal,
      java.util.List<TransactionListItem> lignes) {}

  /** Fiche détail d’une opération (métadonnées fait + dims). */
  public record TransactionDetail(
      long operationId,
      String jour,
      String heure,
      @JsonProperty("date_operation") String dateOperation,
      String reference,
      @JsonProperty("source_id") String sourceId,
      @JsonProperty("id_externe") String idExterne,
      @JsonProperty("cle_metier") String cleMetier,
      int agenceId,
      @JsonProperty("code_agence") String codeAgence,
      @JsonProperty("agence_nom") String agenceNom,
      @JsonProperty("pos_id") String posId,
      @JsonProperty("fp_agent") String fpAgent,
      String produit,
      String module,
      String ecran,
      String partenaire,
      String operateur,
      String expediteur,
      String beneficiaire,
      String telephone,
      @JsonProperty("telephone_expediteur") String telephoneExpediteur,
      @JsonProperty("numero_abonnement") String numeroAbonnement,
      @JsonProperty("numero_id") String numeroId,
      String commentaire,
      String statut,
      String devise,
      @JsonProperty("devise_reception") String deviseReception,
      @JsonProperty("type_operation") String typeOperation,
      @JsonProperty("pays_origine") String paysOrigine,
      @JsonProperty("pays_destination") String paysDestination,
      @JsonProperty("ville_origine") String villeOrigine,
      java.math.BigDecimal montant,
      @JsonProperty("montant_total") java.math.BigDecimal montantTotal,
      @JsonProperty("montant_caisse") java.math.BigDecimal montantCaisse,
      @JsonProperty("montant_paye") java.math.BigDecimal montantPaye,
      java.math.BigDecimal frais,
      java.math.BigDecimal taxes,
      java.math.BigDecimal marge,
      java.math.BigDecimal commission,
      @JsonProperty("commission_fcn") java.math.BigDecimal commissionFcn,
      @JsonProperty("commission_agent") java.math.BigDecimal commissionAgent,
      @JsonProperty("commission_fcn_agent") java.math.BigDecimal commissionFcnAgent,
      java.math.BigDecimal taux,
      @JsonProperty("montant_reception") java.math.BigDecimal montantReception,
      @JsonProperty("taux_change") Boolean tauxChange) {}
}
