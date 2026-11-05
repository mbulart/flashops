package com.flashops.api.referentiel.zone.domain;

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
@Table(name = "zones")
public class Zone {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Integer id;

  @Column(nullable = false, unique = true, length = 40)
  private String code;

  @Column(nullable = false, length = 120)
  private String libelle;

  @Column(nullable = false, length = 30)
  private String perimetre;

  @Column(nullable = false, length = 80)
  private String region = "";

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "region_id")
  private Region regionRef;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "responsable_zone_id")
  private ResponsableZone responsableZone;

  @Column(name = "nb_communes", nullable = false)
  private int nbCommunes;

  @Column(name = "nb_villes", nullable = false)
  private int nbVilles;

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

  public String getPerimetre() {
    return perimetre;
  }

  public void setPerimetre(String perimetre) {
    this.perimetre = perimetre;
  }

  public String getRegion() {
    return region;
  }

  public void setRegion(String region) {
    this.region = region;
  }

  public Region getRegionRef() {
    return regionRef;
  }

  public void setRegionRef(Region regionRef) {
    this.regionRef = regionRef;
  }

  public ResponsableZone getResponsableZone() {
    return responsableZone;
  }

  public void setResponsableZone(ResponsableZone responsableZone) {
    this.responsableZone = responsableZone;
  }

  public int getNbCommunes() {
    return nbCommunes;
  }

  public void setNbCommunes(int nbCommunes) {
    this.nbCommunes = nbCommunes;
  }

  public int getNbVilles() {
    return nbVilles;
  }

  public void setNbVilles(int nbVilles) {
    this.nbVilles = nbVilles;
  }

  public boolean isActif() {
    return actif;
  }

  public void setActif(boolean actif) {
    this.actif = actif;
  }
}
