package com.flashops.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "parametres_application")
public class ParametresApplication {

  @Id private Short id = 1;

  @Column(name = "app_name", nullable = false, length = 120)
  private String appName;

  @Column(name = "app_short_name", nullable = false, length = 40)
  private String appShortName;

  @Column(name = "app_url", nullable = false, length = 500)
  private String appUrl;

  @Column(name = "logo_light", nullable = false, columnDefinition = "TEXT")
  private String logoLight;

  @Column(name = "logo_dark", nullable = false, columnDefinition = "TEXT")
  private String logoDark;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String favicon;

  @Column(name = "default_language", nullable = false, length = 10)
  private String defaultLanguage;

  @Column(name = "fuseau_horaire", nullable = false, length = 64)
  private String fuseauHoraire;

  @Column(name = "smtp_host", nullable = false)
  private String smtpHost;

  @Column(name = "smtp_port", nullable = false)
  private int smtpPort;

  @Column(name = "smtp_username", nullable = false)
  private String smtpUsername;

  @Column(name = "smtp_mot_de_passe", columnDefinition = "TEXT")
  private String smtpMotDePasse;

  @Column(name = "smtp_encryption", nullable = false, length = 10)
  private String smtpEncryption;

  @Column(name = "smtp_from_email", nullable = false)
  private String smtpFromEmail;

  @Column(name = "smtp_from_name", nullable = false, length = 120)
  private String smtpFromName;

  @Column(name = "smtp_test_to", nullable = false)
  private String smtpTestTo;

  @Column(name = "taux_change_usd_cdf", nullable = false, precision = 18, scale = 6)
  private BigDecimal tauxChangeUsdCdf = BigDecimal.ZERO;

  @Column(name = "modifie_le", nullable = false)
  private Instant modifieLe;

  public Short getId() {
    return id;
  }

  public String getAppName() {
    return appName;
  }

  public void setAppName(String appName) {
    this.appName = appName;
  }

  public String getAppShortName() {
    return appShortName;
  }

  public void setAppShortName(String appShortName) {
    this.appShortName = appShortName;
  }

  public String getAppUrl() {
    return appUrl;
  }

  public void setAppUrl(String appUrl) {
    this.appUrl = appUrl;
  }

  public String getLogoLight() {
    return logoLight;
  }

  public void setLogoLight(String logoLight) {
    this.logoLight = logoLight;
  }

  public String getLogoDark() {
    return logoDark;
  }

  public void setLogoDark(String logoDark) {
    this.logoDark = logoDark;
  }

  public String getFavicon() {
    return favicon;
  }

  public void setFavicon(String favicon) {
    this.favicon = favicon;
  }

  public String getDefaultLanguage() {
    return defaultLanguage;
  }

  public void setDefaultLanguage(String defaultLanguage) {
    this.defaultLanguage = defaultLanguage;
  }

  public String getFuseauHoraire() {
    return fuseauHoraire;
  }

  public void setFuseauHoraire(String fuseauHoraire) {
    this.fuseauHoraire = fuseauHoraire;
  }

  public String getSmtpHost() {
    return smtpHost;
  }

  public void setSmtpHost(String smtpHost) {
    this.smtpHost = smtpHost;
  }

  public int getSmtpPort() {
    return smtpPort;
  }

  public void setSmtpPort(int smtpPort) {
    this.smtpPort = smtpPort;
  }

  public String getSmtpUsername() {
    return smtpUsername;
  }

  public void setSmtpUsername(String smtpUsername) {
    this.smtpUsername = smtpUsername;
  }

  public String getSmtpMotDePasse() {
    return smtpMotDePasse;
  }

  public void setSmtpMotDePasse(String smtpMotDePasse) {
    this.smtpMotDePasse = smtpMotDePasse;
  }

  public String getSmtpEncryption() {
    return smtpEncryption;
  }

  public void setSmtpEncryption(String smtpEncryption) {
    this.smtpEncryption = smtpEncryption;
  }

  public String getSmtpFromEmail() {
    return smtpFromEmail;
  }

  public void setSmtpFromEmail(String smtpFromEmail) {
    this.smtpFromEmail = smtpFromEmail;
  }

  public String getSmtpFromName() {
    return smtpFromName;
  }

  public void setSmtpFromName(String smtpFromName) {
    this.smtpFromName = smtpFromName;
  }

  public String getSmtpTestTo() {
    return smtpTestTo;
  }

  public void setSmtpTestTo(String smtpTestTo) {
    this.smtpTestTo = smtpTestTo;
  }

  public BigDecimal getTauxChangeUsdCdf() {
    return tauxChangeUsdCdf;
  }

  public void setTauxChangeUsdCdf(BigDecimal tauxChangeUsdCdf) {
    this.tauxChangeUsdCdf = tauxChangeUsdCdf;
  }

  public Instant getModifieLe() {
    return modifieLe;
  }

  public void setModifieLe(Instant modifieLe) {
    this.modifieLe = modifieLe;
  }
}
