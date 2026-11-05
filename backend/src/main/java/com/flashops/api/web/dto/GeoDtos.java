package com.flashops.api.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.flashops.api.referentiel.geo.domain.Commune;
import com.flashops.api.referentiel.geo.domain.Pays;
import com.flashops.api.referentiel.geo.domain.Province;
import com.flashops.api.referentiel.geo.domain.Territoire;
import com.flashops.api.referentiel.geo.domain.Ville;

public final class GeoDtos {

  private GeoDtos() {}

  public record PaysRow(
      Short id,
      @JsonProperty("code_iso") String codeIso,
      String libelle,
      @JsonProperty("libelle_fr") String libelleFr,
      @JsonProperty("geoname_id") Long geonameId,
      boolean actif) {}

  public record ProvinceRow(
      Short id,
      @JsonProperty("pays_id") Short paysId,
      String code,
      String libelle,
      @JsonProperty("libelle_fr") String libelleFr,
      @JsonProperty("geoname_id") Long geonameId,
      @JsonProperty("ordre_tri") short ordreTri,
      boolean actif) {}

  public record VilleRow(
      Short id,
      @JsonProperty("province_id") Short provinceId,
      String code,
      String libelle,
      @JsonProperty("libelle_fr") String libelleFr,
      @JsonProperty("geoname_id") Long geonameId,
      boolean actif) {}

  public record TerritoireRow(
      Short id,
      @JsonProperty("province_id") Short provinceId,
      String code,
      String libelle,
      @JsonProperty("libelle_fr") String libelleFr,
      @JsonProperty("geoname_id") Long geonameId,
      boolean actif) {}

  public record CommuneRow(
      Integer id,
      @JsonProperty("ville_id") Short villeId,
      @JsonProperty("territoire_id") Short territoireId,
      @JsonProperty("province_id") Short provinceId,
      String code,
      String libelle,
      @JsonProperty("libelle_fr") String libelleFr,
      @JsonProperty("geoname_id") Long geonameId,
      boolean actif) {}

  public record SyncResult(
      boolean skipped,
      int pays,
      int provinces,
      int villes,
      int territoires,
      int communes,
      String status) {}

  public static PaysRow toPaysRow(Pays p) {
    return new PaysRow(
        p.getId(), p.getCodeIso(), p.getLibelle(), p.getLibelleFr(), p.getGeonameId(), p.isActif());
  }

  public static ProvinceRow toProvinceRow(Province p) {
    return new ProvinceRow(
        p.getId(),
        p.getPays().getId(),
        p.getCode(),
        p.getLibelle(),
        p.getLibelleFr(),
        p.getGeonameId(),
        p.getOrdreTri(),
        p.isActif());
  }

  public static VilleRow toVilleRow(Ville v) {
    return new VilleRow(
        v.getId(),
        v.getProvince().getId(),
        v.getCode(),
        v.getLibelle(),
        v.getLibelleFr(),
        v.getGeonameId(),
        v.isActif());
  }

  public static TerritoireRow toTerritoireRow(Territoire t) {
    return new TerritoireRow(
        t.getId(),
        t.getProvince().getId(),
        t.getCode(),
        t.getLibelle(),
        t.getLibelleFr(),
        t.getGeonameId(),
        t.isActif());
  }

  public static CommuneRow toCommuneRow(Commune c) {
    Short villeId = c.getVille() != null ? c.getVille().getId() : null;
    Short territoireId = c.getTerritoire() != null ? c.getTerritoire().getId() : null;
    Short provinceId = null;
    if (c.getVille() != null && c.getVille().getProvince() != null) {
      provinceId = c.getVille().getProvince().getId();
    } else if (c.getTerritoire() != null && c.getTerritoire().getProvince() != null) {
      provinceId = c.getTerritoire().getProvince().getId();
    }
    return new CommuneRow(
        c.getId(),
        villeId,
        territoireId,
        provinceId,
        c.getCode(),
        c.getLibelle(),
        c.getLibelleFr(),
        c.getGeonameId(),
        c.isActif());
  }
}
