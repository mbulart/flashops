package com.flashops.api.referentiel.zone.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "responsables_zone")
public class ResponsableZone {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Integer id;

  @Column(nullable = false, unique = true, length = 40)
  private String code;

  @Column(nullable = false, length = 120)
  private String nom;

  @Column(nullable = false, length = 30)
  private String perimetre;

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

  public String getNom() {
    return nom;
  }

  public void setNom(String nom) {
    this.nom = nom;
  }

  public String getPerimetre() {
    return perimetre;
  }

  public void setPerimetre(String perimetre) {
    this.perimetre = perimetre;
  }

  public boolean isActif() {
    return actif;
  }

  public void setActif(boolean actif) {
    this.actif = actif;
  }
}
