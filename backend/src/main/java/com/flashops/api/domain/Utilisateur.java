package com.flashops.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "utilisateurs")
public class Utilisateur {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Integer id;

  @Column(nullable = false, unique = true)
  private String courriel;

  @Column(name = "mot_de_passe_hash", nullable = false)
  private String motDePasseHash;

  @Column(name = "nom_complet", nullable = false)
  private String nomComplet;

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "role_id", nullable = false)
  private Role role;

  @Column(nullable = false)
  private boolean actif;

  @Column(name = "derniere_connexion_le")
  private Instant derniereConnexionLe;

  @Column(name = "version_session", nullable = false)
  private long versionSession;

  @Column(name = "photo_fichier", length = 120)
  private String photoFichier;

  @Column(name = "photo_modifie_le")
  private Instant photoModifieLe;

  /** Rattachement agence — utilisé pour le rôle AGENT. */
  @Column(name = "agence_id")
  private Integer agenceId;

  /** Rattachement responsable de zone — utilisé pour le rôle RZ. */
  @Column(name = "responsable_zone_id")
  private Integer responsableZoneId;

  public Integer getId() {
    return id;
  }

  public void setCourriel(String courriel) {
    this.courriel = courriel;
  }

  public String getCourriel() {
    return courriel;
  }

  public String getMotDePasseHash() {
    return motDePasseHash;
  }

  public void setMotDePasseHash(String motDePasseHash) {
    this.motDePasseHash = motDePasseHash;
  }

  public String getNomComplet() {
    return nomComplet;
  }

  public void setNomComplet(String nomComplet) {
    this.nomComplet = nomComplet;
  }

  public Role getRole() {
    return role;
  }

  public void setRole(Role role) {
    this.role = role;
  }

  public boolean isActif() {
    return actif;
  }

  public void setActif(boolean actif) {
    this.actif = actif;
  }

  public Instant getDerniereConnexionLe() {
    return derniereConnexionLe;
  }

  public void setDerniereConnexionLe(Instant derniereConnexionLe) {
    this.derniereConnexionLe = derniereConnexionLe;
  }

  public long getVersionSession() {
    return versionSession;
  }

  public void setVersionSession(long versionSession) {
    this.versionSession = versionSession;
  }

  public String getPhotoFichier() {
    return photoFichier;
  }

  public void setPhotoFichier(String photoFichier) {
    this.photoFichier = photoFichier;
  }

  public Instant getPhotoModifieLe() {
    return photoModifieLe;
  }

  public void setPhotoModifieLe(Instant photoModifieLe) {
    this.photoModifieLe = photoModifieLe;
  }

  public Integer getAgenceId() {
    return agenceId;
  }

  public void setAgenceId(Integer agenceId) {
    this.agenceId = agenceId;
  }

  public Integer getResponsableZoneId() {
    return responsableZoneId;
  }

  public void setResponsableZoneId(Integer responsableZoneId) {
    this.responsableZoneId = responsableZoneId;
  }
}
