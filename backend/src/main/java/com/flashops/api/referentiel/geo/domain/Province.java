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
@Table(name = "provinces")
public class Province {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Short id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "pays_id", nullable = false)
  private Pays pays;

  @Column(nullable = false, length = 30)
  private String code;

  @Column(nullable = false, length = 200)
  private String libelle;

  @Column(name = "libelle_fr", length = 200)
  private String libelleFr;

  @Column(name = "libelle_defaut", length = 200)
  private String libelleDefaut;

  @Column(name = "geoname_id", unique = true)
  private Long geonameId;

  @Column(name = "ordre_tri", nullable = false)
  private short ordreTri;

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

  public Short getId() {
    return id;
  }

  public Pays getPays() {
    return pays;
  }

  public void setPays(Pays pays) {
    this.pays = pays;
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

  public short getOrdreTri() {
    return ordreTri;
  }

  public void setOrdreTri(short ordreTri) {
    this.ordreTri = ordreTri;
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
