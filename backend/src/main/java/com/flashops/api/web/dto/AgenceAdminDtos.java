package com.flashops.api.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public final class AgenceAdminDtos {

  private AgenceAdminDtos() {}

  public record AgenceAdminRow(
      int agenceId,
      @JsonProperty("code_agence") String codeAgence,
      String nom,
      String categorie,
      @JsonProperty("pos_id") String posId,
      @JsonProperty("fp_agent") String fpAgent,
      String ville,
      String commune,
      String province,
      String pays,
      String adresse,
      BigDecimal latitude,
      BigDecimal longitude,
      Integer regionId,
      Integer zoneId,
      String region,
      String zone,
      @JsonProperty("responsable_zone") String responsableZone,
      Integer parentAgenceId,
      @JsonProperty("mere_code") String mereCode,
      @JsonProperty("mere_nom") String mereNom,
      @JsonProperty("premiere_transaction") String premiereTransaction,
      @JsonProperty("derniere_transaction") String derniereTransaction,
      /** Nouveau | Actif | Inactif */
      @JsonProperty("statut_activite") String statutActivite) {}

  public record AgenceAdminPage(
      long total, int page, int size, List<AgenceAdminRow> items) {}

  public record AgenceAdminInput(
      @NotBlank @Size(max = 80) @JsonProperty("code_agence") String codeAgence,
      @NotBlank @Size(max = 200) String nom,
      @Size(max = 80) String categorie,
      @Size(max = 80) @JsonProperty("pos_id") String posId,
      @Size(max = 80) @JsonProperty("fp_agent") String fpAgent,
      @Size(max = 120) String ville,
      @Size(max = 120) String commune,
      @Size(max = 120) String province,
      @Size(max = 80) String pays,
      @Size(max = 500) String adresse,
      BigDecimal latitude,
      BigDecimal longitude,
      Integer regionId,
      Integer zoneId,
      Integer parentAgenceId) {}
}
