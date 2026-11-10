package com.flashops.api.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ApprovisionnementVasDtos {

  private ApprovisionnementVasDtos() {}

  public record ProduitOption(
      @JsonProperty("produit_id") int produitId,
      String operateur,
      @JsonProperty("produit_libelle") String produitLibelle,
      String module,
      String ecran,
      String partenaire) {}

  public record PeriodeView(
      LocalDate debut,
      LocalDate fin) {}

  public record ConsommationPeriodeView(
      PeriodeView periode,
      BigDecimal depots,
      BigDecimal retraits,
      BigDecimal consommation) {}

  public record ConsommationCalculView(
      @JsonProperty("date_reference") LocalDate dateReference,
      @JsonProperty("produit_id") int produitId,
      String operateur,
      @JsonProperty("produit_libelle") String produitLibelle,
      String devise,
      @JsonProperty("j1") ConsommationPeriodeView j1,
      @JsonProperty("j2") ConsommationPeriodeView j2,
      BigDecimal moyenne) {}

  public record LigneInput(
      @JsonProperty("produit_id") int produitId,
      String devise,
      @JsonProperty("solde_08h") BigDecimal solde08h,
      @JsonProperty("montant_propose") BigDecimal montantPropose,
      @JsonProperty("montant_valide") BigDecimal montantValide,
      @JsonProperty("montant_paye") BigDecimal montantPaye) {}

  public record DemandeInput(
      @JsonProperty("date_reference") LocalDate dateReference,
      String commentaire,
      String statut,
      List<LigneInput> lignes) {}

  public record LigneView(
      Long id,
      @JsonProperty("produit_id") int produitId,
      String operateur,
      @JsonProperty("produit_libelle") String produitLibelle,
      String devise,
      @JsonProperty("date_reference") LocalDate dateReference,
      @JsonProperty("j1_debut") LocalDate j1Debut,
      @JsonProperty("j1_fin") LocalDate j1Fin,
      @JsonProperty("j2_debut") LocalDate j2Debut,
      @JsonProperty("j2_fin") LocalDate j2Fin,
      @JsonProperty("depots_j1") BigDecimal depotsJ1,
      @JsonProperty("retraits_j1") BigDecimal retraitsJ1,
      @JsonProperty("consommation_j1") BigDecimal consommationJ1,
      @JsonProperty("depots_j2") BigDecimal depotsJ2,
      @JsonProperty("retraits_j2") BigDecimal retraitsJ2,
      @JsonProperty("consommation_j2") BigDecimal consommationJ2,
      BigDecimal moyenne,
      @JsonProperty("solde_08h") BigDecimal solde08h,
      @JsonProperty("montant_propose") BigDecimal montantPropose,
      @JsonProperty("montant_valide") BigDecimal montantValide,
      @JsonProperty("montant_paye") BigDecimal montantPaye) {}

  public record DemandeView(
      Long id,
      @JsonProperty("date_reference") LocalDate dateReference,
      String statut,
      String commentaire,
      @JsonProperty("cree_par") Integer creePar,
      @JsonProperty("cree_le") Instant creeLe,
      @JsonProperty("modifie_le") Instant modifieLe,
      List<LigneView> lignes) {}

  public record DemandeListItem(
      Long id,
      @JsonProperty("date_reference") LocalDate dateReference,
      String statut,
      @JsonProperty("nb_lignes") int nbLignes,
      @JsonProperty("cree_le") Instant creeLe) {}
}
