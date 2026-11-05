package com.flashops.api.referentiel.geo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "communes")
public class Commune {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Integer id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "ville_id")
  private Ville ville;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "territoire_id")
  private Territoire territoire;

  @Column(nullable = false, length = 50)
  private String code;

  @Column(nullable = false, length = 200)
  private String libelle;

  @Column(name = "libelle_fr", length = 200)
  private String libelleFr;

  @Column(name = "libelle_defaut", length = 200)
  private String libelleDefaut;

  @Column(name = "geoname_id", unique = true)
  private Long geonameId;

  private Double latitude;
  private Double longitude;

  @Column(nullable = false, length = 20)
  private String source = "seed";

  @Column(nullable = false)
  private boolean actif = true;

  @Column(name = "cree_le", nullable = false)
  private Instant creeLe;

  @Column(name = "modifie_le", nullable = false)
  private Instant modifieLe;

  @PrePersist
  void onCreate() {
    Instant now = Instant.now();
    creeLe = now;
    modifieLe = now;
  }

  @PreUpdate
  void onUpdate() {
    modifieLe = Instant.now();
  }

  public Integer getId() {
    return id;
  }

  public Ville getVille() {
    return ville;
  }

  public void setVille(Ville ville) {
    this.ville = ville;
  }

  public Territoire getTerritoire() {
    return territoire;
  }

  public void setTerritoire(Territoire territoire) {
    this.territoire = territoire;
  }

  public String getCode() {
    return code;
  }

  public void setCode(String code) {
    this.code = code;
  }

  public String getLibelle() {
    return libelle;
  }

  public void setLibelle(String libelle) {
    this.libelle = libelle;
  }

  public String getLibelleFr() {
    return libelleFr;
  }

  public void setLibelleFr(String libelleFr) {
    this.libelleFr = libelleFr;
  }

  public String getLibelleDefaut() {
    return libelleDefaut;
  }

  public void setLibelleDefaut(String libelleDefaut) {
    this.libelleDefaut = libelleDefaut;
  }

  public Long getGeonameId() {
    return geonameId;
  }

  public void setGeonameId(Long geonameId) {
    this.geonameId = geonameId;
  }

  public Double getLatitude() {
    return latitude;
  }

  public void setLatitude(Double latitude) {
    this.latitude = latitude;
  }

  public Double getLongitude() {
    return longitude;
  }

  public void setLongitude(Double longitude) {
    this.longitude = longitude;
  }

  public String getSource() {
    return source;
  }

  public void setSource(String source) {
    this.source = source;
  }

  public boolean isActif() {
    return actif;
  }

  public void setActif(boolean actif) {
    this.actif = actif;
  }
}
