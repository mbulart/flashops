package com.flashops.api.admin;

import com.flashops.api.domain.ParametresApplication;
import com.flashops.api.repository.ParametresApplicationRepository;
import com.flashops.api.web.dto.AdminDtos;
import com.flashops.api.web.dto.AdminDtos.AppSettingsUpdate;
import com.flashops.api.web.dto.AdminDtos.AppSettingsView;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AppParametersService {

  private final ParametresApplicationRepository repo;

  public AppParametersService(ParametresApplicationRepository repo) {
    this.repo = repo;
  }

  @Transactional(readOnly = true)
  public ParametresApplication requireRow() {
    return repo.findById((short) 1).orElseThrow(() -> new IllegalStateException("parametres_application missing"));
  }

  @Transactional(readOnly = true)
  public AppSettingsView adminView() {
    return toView(requireRow());
  }

  @Transactional(readOnly = true)
  public Map<String, Object> publicConfig() {
    ParametresApplication p = requireRow();
    return Map.of(
        "data",
        Map.of(
            "app_name", p.getAppName(),
            "app_short_name", p.getAppShortName(),
            "app_url", p.getAppUrl(),
            "logo_light", p.getLogoLight(),
            "logo_dark", p.getLogoDark(),
            "favicon", p.getFavicon(),
            "default_language", p.getDefaultLanguage(),
            "timezone", p.getFuseauHoraire()));
  }

  @Transactional
  public AppSettingsView update(AppSettingsUpdate input) {
    ParametresApplication p = requireRow();
    String name = trim(input.appName());
    String shortName = trim(input.appShortName());
    if (name.isBlank() || shortName.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid app identity");
    }
    int port = input.smtpPort();
    if (port < 1 || port > 65535) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid smtp port");
    }
    String enc = normalizeEncryption(input.smtpEncryption());
    String lang = trim(input.defaultLanguage()).toLowerCase(Locale.ROOT);
    if (!lang.equals("fr") && !lang.equals("en")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid language");
    }
    String tz = trim(input.timezone());
    if (tz.isBlank()) {
      tz = "Africa/Kinshasa";
    }
    BigDecimal taux = input.tauxChangeUsdCdf() == null ? BigDecimal.ZERO : input.tauxChangeUsdCdf();
    if (taux.compareTo(BigDecimal.ZERO) < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid exchange rate");
    }
    BigDecimal delai =
        input.delaiTraitementHeures() == null ? BigDecimal.valueOf(2) : input.delaiTraitementHeures();
    if (delai.compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid processing delay");
    }

    p.setAppName(name);
    p.setAppShortName(shortName);
    p.setAppUrl(trim(input.appUrl()));
    p.setLogoLight(nullToEmpty(input.logoLight()));
    p.setLogoDark(nullToEmpty(input.logoDark()));
    p.setFavicon(nullToEmpty(input.favicon()));
    p.setDefaultLanguage(lang);
    p.setFuseauHoraire(tz);
    p.setSmtpHost(trim(input.smtpHost()));
    p.setSmtpPort(port);
    p.setSmtpUsername(trim(input.smtpUsername()).toLowerCase(Locale.ROOT));
    p.setSmtpEncryption(enc);
    p.setSmtpFromEmail(trim(input.smtpFromEmail()));
    p.setSmtpFromName(trim(input.smtpFromName()));
    p.setSmtpTestTo(trim(input.smtpTestTo()));
    if (input.smtpPassword() != null && !input.smtpPassword().isBlank()) {
      p.setSmtpMotDePasse(input.smtpPassword().trim());
    }
    p.setTauxChangeUsdCdf(taux);
    p.setDelaiTraitementHeures(delai);
    p.setModifieLe(Instant.now());
    repo.save(p);
    return toView(p);
  }

  @Transactional(readOnly = true)
  public String resolveSmtpTestRecipient(String overrideTo) {
    String to = trim(overrideTo);
    if (!to.isBlank()) {
      return to;
    }
    to = trim(requireRow().getSmtpTestTo());
    if (to.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recipient required");
    }
    return to;
  }

  private static AppSettingsView toView(ParametresApplication p) {
    BigDecimal taux = p.getTauxChangeUsdCdf() == null ? BigDecimal.ZERO : p.getTauxChangeUsdCdf();
    BigDecimal delai =
        p.getDelaiTraitementHeures() == null ? BigDecimal.valueOf(2) : p.getDelaiTraitementHeures();
    return new AppSettingsView(
        p.getAppName(),
        p.getAppShortName(),
        p.getAppUrl(),
        p.getLogoLight(),
        p.getLogoDark(),
        p.getFavicon(),
        p.getDefaultLanguage(),
        p.getFuseauHoraire(),
        p.getSmtpHost(),
        p.getSmtpPort(),
        p.getSmtpUsername(),
        p.getSmtpMotDePasse() != null && !p.getSmtpMotDePasse().isBlank(),
        p.getSmtpEncryption(),
        p.getSmtpFromEmail(),
        p.getSmtpFromName(),
        p.getSmtpTestTo(),
        taux,
        delai);
  }

  private static String trim(String v) {
    return v == null ? "" : v.trim();
  }

  private static String nullToEmpty(String v) {
    return v == null ? "" : v;
  }

  private static String normalizeEncryption(String v) {
    String enc = trim(v).toLowerCase(Locale.ROOT);
    if (!enc.equals("none") && !enc.equals("tls") && !enc.equals("ssl")) {
      return "tls";
    }
    return enc;
  }
}
