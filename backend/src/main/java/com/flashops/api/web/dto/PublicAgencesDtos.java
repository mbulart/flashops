package com.flashops.api.web.dto;

public final class PublicAgencesDtos {

  private PublicAgencesDtos() {}

  public record AgenceGeo(
      int agenceId, String code, String nom, String adresse, double latitude, double longitude) {}
}
