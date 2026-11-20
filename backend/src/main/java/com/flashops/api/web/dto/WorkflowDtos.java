package com.flashops.api.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.List;

public final class WorkflowDtos {
  private WorkflowDtos() {}

  public record Node(Long id, String code, String libelle, String type) {}

  public record Definition(
      Long id,
      String code,
      String libelle,
      String description,
      Integer version,
      String statut,
      List<Node> nodes,
      @JsonProperty("updated_at") OffsetDateTime updatedAt) {}

  public record DefinitionUpdate(
      String nom, String libelle, String description, String statut) {}
}
