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

  public record PeriodeView(LocalDate debut, LocalDate fin) {}

  public record ConsommationPeriodeView(
      PeriodeView periode, BigDecimal depots, BigDecimal retraits, BigDecimal consommation) {}

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
      @JsonProperty("libelle_solde") String libelleSolde,
      @JsonProperty("solde_08h") BigDecimal solde08h,
      @JsonProperty("montant_propose") BigDecimal montantPropose,
      @JsonProperty("montant_valide") BigDecimal montantValide) {}

  public record DemandeInput(
      @JsonProperty("date_reference") LocalDate dateReference,
      String commentaire,
      String statut,
      List<LigneInput> lignes) {}

  public record TransitionInput(String statut, String commentaire, @JsonProperty("motif_rejet") String motifRejet) {}

  public record HistoriqueStatutView(
      Long id,
      @JsonProperty("demande_id") long demandeId,
      @JsonProperty("ancien_statut") String ancienStatut,
      @JsonProperty("nouveau_statut") String nouveauStatut,
      @JsonProperty("utilisateur_id") Integer utilisateurId,
      String commentaire,
      @JsonProperty("cree_le") Instant creeLe) {}

  public record PaiementInput(
      BigDecimal montant,
      String devise,
      @JsonProperty("date_paiement") LocalDate datePaiement,
      @JsonProperty("mode_paiement") String modePaiement,
      @JsonProperty("reference_paiement") String referencePaiement,
      String commentaire) {}

  public record PaiementView(
      Long id,
      @JsonProperty("ligne_id") long ligneId,
      BigDecimal montant,
      String devise,
      @JsonProperty("date_paiement") LocalDate datePaiement,
      @JsonProperty("mode_paiement") String modePaiement,
      @JsonProperty("reference_paiement") String referencePaiement,
      String commentaire,
      @JsonProperty("utilisateur_id") Integer utilisateurId,
      @JsonProperty("cree_le") Instant creeLe) {}

  public record ReleveSoldeInput(
      @JsonProperty("produit_id") int produitId,
      String devise,
      BigDecimal solde,
      @JsonProperty("releve_le") Instant releveLe,
      String commentaire) {}

  public record ReleveSoldeView(
      Long id,
      @JsonProperty("produit_id") int produitId,
      String operateur,
      @JsonProperty("produit_libelle") String produitLibelle,
      String devise,
      BigDecimal solde,
      @JsonProperty("releve_le") Instant releveLe,
      @JsonProperty("utilisateur_id") Integer utilisateurId,
      String commentaire,
      @JsonProperty("cree_le") Instant creeLe) {}

  public record SeuilAlerteInput(
      @JsonProperty("produit_id") int produitId,
      String devise,
      @JsonProperty("seuil_attention") BigDecimal seuilAttention,
      @JsonProperty("seuil_critique") BigDecimal seuilCritique) {}

  public record SeuilAlerteView(
      Long id,
      @JsonProperty("produit_id") int produitId,
      String operateur,
      @JsonProperty("produit_libelle") String produitLibelle,
      String devise,
      @JsonProperty("seuil_attention") BigDecimal seuilAttention,
      @JsonProperty("seuil_critique") BigDecimal seuilCritique,
      @JsonProperty("modifie_le") Instant modifieLe) {}

  public record SoldeAlerteView(
      @JsonProperty("produit_id") int produitId,
      String operateur,
      @JsonProperty("produit_libelle") String produitLibelle,
      String devise,
      BigDecimal solde,
      @JsonProperty("seuil_attention") BigDecimal seuilAttention,
      @JsonProperty("seuil_critique") BigDecimal seuilCritique,
      String niveau,
      @JsonProperty("releve_le") Instant releveLe) {}

  public record DashboardKpiView(
      @JsonProperty("total_propose_usd") BigDecimal totalProposeUsd,
      @JsonProperty("total_propose_cdf") BigDecimal totalProposeCdf,
      @JsonProperty("total_valide_usd") BigDecimal totalValideUsd,
      @JsonProperty("total_valide_cdf") BigDecimal totalValideCdf,
      @JsonProperty("total_paye_usd") BigDecimal totalPayeUsd,
      @JsonProperty("total_paye_cdf") BigDecimal totalPayeCdf,
      @JsonProperty("nb_brouillon") int nbBrouillon,
      @JsonProperty("nb_en_attente") int nbEnAttente,
      @JsonProperty("nb_en_retard") int nbEnRetard,
      @JsonProperty("nb_payees") int nbPayees,
      @JsonProperty("delai_traitement_heures") BigDecimal delaiTraitementHeures) {}

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
      @JsonProperty("libelle_solde") String libelleSolde,
      @JsonProperty("solde_08h") BigDecimal solde08h,
      @JsonProperty("montant_propose") BigDecimal montantPropose,
      @JsonProperty("montant_valide") BigDecimal montantValide,
      @JsonProperty("montant_paye") BigDecimal montantPaye,
      @JsonProperty("reste_a_payer") BigDecimal resteAPayer) {}

  public record DemandeView(
      Long id,
      @JsonProperty("date_reference") LocalDate dateReference,
      String statut,
      String commentaire,
      @JsonProperty("motif_rejet") String motifRejet,
      @JsonProperty("cree_par") Integer creePar,
      @JsonProperty("cree_le") Instant creeLe,
      @JsonProperty("modifie_par") Integer modifiePar,
      @JsonProperty("modifie_le") Instant modifieLe,
      @JsonProperty("soumise_par") Integer soumisePar,
      @JsonProperty("soumise_le") Instant soumiseLe,
      @JsonProperty("validee_par") Integer valideePar,
      @JsonProperty("validee_le") Instant valideeLe,
      @JsonProperty("rejetee_par") Integer rejeteePar,
      @JsonProperty("rejetee_le") Instant rejeteeLe,
      @JsonProperty("en_retard") boolean enRetard,
      @JsonProperty("delai_heures") BigDecimal delaiHeures,
      List<LigneView> lignes,
      List<HistoriqueStatutView> historique) {}

  public record DemandeListItem(
      Long id,
      @JsonProperty("date_reference") LocalDate dateReference,
      String statut,
      @JsonProperty("nb_lignes") int nbLignes,
      @JsonProperty("cree_le") Instant creeLe,
      @JsonProperty("soumise_le") Instant soumiseLe,
      @JsonProperty("en_retard") boolean enRetard,
      @JsonProperty("total_propose_usd") BigDecimal totalProposeUsd,
      @JsonProperty("total_propose_cdf") BigDecimal totalProposeCdf) {}
}
