package com.flashops.api.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.List;

public final class OnboardingDtos {
  private OnboardingDtos() {}

  public record Option(
      Object id, String code, String libelle, String famille, Boolean obligatoire) {}

  public record Referentiels(
      @JsonProperty("categories_distributeur") List<Option> categoriesDistributeur,
      @JsonProperty("types_candidat") List<Option> typesCandidat,
      List<Option> services,
      @JsonProperty("types_documents") List<Option> typesDocuments,
      @JsonProperty("types_piece_identite") List<Option> typesPieceIdentite,
      @JsonProperty("formes_juridiques") List<Option> formesJuridiques) {}

  public record Representant(
      String nom,
      String prenom,
      String telephone,
      String email,
      String fonction,
      @JsonProperty("piece_identite") String pieceIdentite) {}

  public record Entreprise(
      @JsonProperty("raison_sociale") String raisonSociale,
      @JsonProperty("nom_commercial") String nomCommercial,
      @JsonProperty("forme_juridique") String formeJuridique,
      String rccm,
      @JsonProperty("id_nat") String idNat,
      String nif,
      String adresse,
      String ville,
      String province,
      String commune) {}

  public record PointVente(
      Long id,
      String nom,
      String adresse,
      String ville,
      String province,
      String commune,
      String telephone,
      boolean principal) {}

  public record Document(
      Long id,
      @JsonProperty("type_code") String typeCode,
      @JsonProperty("type_libelle") String typeLibelle,
      @JsonProperty("nom_fichier") String nomFichier,
      String statut,
      String note,
      @JsonProperty("content_type") String contentType,
      @JsonProperty("a_fichier") boolean aFichier) {}

  public record Lieu(Number id, String libelle) {}

  public record FichierMeta(String chemin, String nom, String contentType) {}

  public record WorkflowHistorique(
      String etape, String action, String commentaire, String acteur, OffsetDateTime date) {}

  public record WorkflowAction(
      String code,
      String libelle,
      @JsonProperty("commentaire_requis") boolean commentaireRequis) {}

  public record CandidatureDraft(
      String email,
      String telephone,
      Representant representant,
      Entreprise entreprise,
      List<String> services,
      @JsonProperty("points_vente") List<PointVente> pointsVente,
      List<Document> documents) {}

  public record Candidature(
      Long id,
      String reference,
      String jeton,
      String statut,
      String etape,
      int progression,
      String email,
      String telephone,
      Representant representant,
      Entreprise entreprise,
      List<String> services,
      @JsonProperty("points_vente") List<PointVente> pointsVente,
      List<Document> documents,
      @JsonProperty("workflow_historique") List<WorkflowHistorique> workflowHistorique,
      @JsonProperty("actions_disponibles") List<WorkflowAction> actionsDisponibles,
      @JsonProperty("cree_le") OffsetDateTime creeLe,
      @JsonProperty("modifie_le") OffsetDateTime modifieLe,
      @JsonProperty("soumis_le") OffsetDateTime soumisLe) {}

  public record CandidaturePage(List<Candidature> items, long total, int page, int size) {}

  public record Task(
      long id,
      @JsonProperty("candidature_id") long candidatureId,
      String reference,
      String libelle,
      String etape,
      String statut,
      String assignee,
      String echeance,
      @JsonProperty("actions_disponibles") List<WorkflowAction> actionsDisponibles) {}

  public record TaskActionInput(String action, String commentaire) {}

  public record DemandeNonTraitee(
      long id,
      String reference,
      String statut,
      @JsonProperty("raison_sociale") String raisonSociale,
      @JsonProperty("soumis_le") OffsetDateTime soumisLe) {}

  public record DemandesNonTraitees(long count, List<DemandeNonTraitee> items) {}

  public static CandidatureDraft emptyDraft() {
    return new CandidatureDraft(null, null, null, null, List.of(), List.of(), List.of());
  }
}
