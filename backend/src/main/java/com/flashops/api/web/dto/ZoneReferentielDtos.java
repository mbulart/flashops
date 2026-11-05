package com.flashops.api.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.flashops.api.referentiel.zone.domain.Region;
import com.flashops.api.referentiel.zone.domain.ResponsableZone;
import com.flashops.api.referentiel.zone.domain.Zone;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class ZoneReferentielDtos {

  private ZoneReferentielDtos() {}

  public record ResponsableZoneRow(
      Integer id,
      String code,
      String nom,
      String perimetre,
      boolean actif,
      @JsonProperty("zone_libelle") String zoneLibelle) {}

  public record ResponsableZoneInput(
      @NotBlank @Size(max = 40) String code,
      @NotBlank @Size(max = 120) String nom,
      @NotBlank @Size(max = 30) String perimetre,
      boolean actif) {}

  public record RegionRow(
      Integer id,
      String code,
      String libelle,
      @JsonProperty("par_defaut") boolean parDefaut,
      boolean actif) {}

  public record RegionInput(
      @NotBlank @Size(max = 30) String code,
      @NotBlank @Size(max = 120) String libelle,
      @JsonProperty("par_defaut") boolean parDefaut,
      boolean actif) {}

  public record ZoneRow(
      Integer id,
      String code,
      String libelle,
      String perimetre,
      String region,
      @JsonProperty("region_id") Integer regionId,
      @JsonProperty("region_code") String regionCode,
      @JsonProperty("responsable_zone_id") Integer responsableZoneId,
      @JsonProperty("responsable_nom") String responsableNom,
      @JsonProperty("nb_communes") int nbCommunes,
      @JsonProperty("nb_villes") int nbVilles,
      boolean actif) {}

  public record ZoneInput(
      @NotBlank @Size(max = 40) String code,
      @NotBlank @Size(max = 120) String libelle,
      @NotBlank @Size(max = 30) String perimetre,
      @Size(max = 80) String region,
      @JsonProperty("region_id") Integer regionId,
      @JsonProperty("responsable_zone_id") Integer responsableZoneId,
      @JsonProperty("nb_communes") int nbCommunes,
      @JsonProperty("nb_villes") int nbVilles,
      boolean actif) {}

  public static ResponsableZoneRow toResponsableRow(ResponsableZone r, String zoneLibelle) {
    return new ResponsableZoneRow(r.getId(), r.getCode(), r.getNom(), r.getPerimetre(), r.isActif(), zoneLibelle);
  }

  public static RegionRow toRegionRow(Region r) {
    return new RegionRow(r.getId(), r.getCode(), r.getLibelle(), r.isParDefaut(), r.isActif());
  }

  public static ZoneRow toZoneRow(Zone z) {
    Integer rzId = z.getResponsableZone() != null ? z.getResponsableZone().getId() : null;
    String rzNom = z.getResponsableZone() != null ? z.getResponsableZone().getNom() : null;
    Integer regionId = z.getRegionRef() != null ? z.getRegionRef().getId() : null;
    String regionCode = z.getRegionRef() != null ? z.getRegionRef().getCode() : null;
    String regionLibelle =
        z.getRegionRef() != null && z.getRegionRef().getLibelle() != null
            ? z.getRegionRef().getLibelle()
            : z.getRegion();
    return new ZoneRow(
        z.getId(),
        z.getCode(),
        z.getLibelle(),
        z.getPerimetre(),
        regionLibelle,
        regionId,
        regionCode,
        rzId,
        rzNom,
        z.getNbCommunes(),
        z.getNbVilles(),
        z.isActif());
  }
}
