package com.flashops.api.onboarding;

import com.flashops.api.admin.AppParametersService;
import com.flashops.api.admin.SmtpTestService;
import com.flashops.api.domain.ParametresApplication;
import com.flashops.api.web.dto.OnboardingDtos;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class OnboardingMailService {
  public static final String PROCESSOR_EMAIL = "a.mbelu@flash.one";

  private static final Logger log = LoggerFactory.getLogger(OnboardingMailService.class);

  private final JdbcTemplate jdbc;
  private final AppParametersService parameters;
  private final SmtpTestService smtp;

  public OnboardingMailService(
      JdbcTemplate jdbc, AppParametersService parameters, SmtpTestService smtp) {
    this.jdbc = jdbc;
    this.parameters = parameters;
    this.smtp = smtp;
  }

  public void notifySubmitted(OnboardingDtos.Candidature candidature) {
    Thread.startVirtualThread(() -> deliver(candidature));
  }

  private void deliver(OnboardingDtos.Candidature candidature) {
    try {
      ParametresApplication settings = parameters.requireRow();
      String base = baseUrl(settings.getAppUrl());
      String applicant = firstEmail(candidature.email(),
          candidature.representant() == null ? null : candidature.representant().email());
      if (applicant != null) {
        smtp.send(settings, applicant, "Flash OPS — demande reçue " + candidature.reference(),
            applicantBody(candidature, base));
      }
      for (String staff : staffRecipients()) {
        smtp.send(settings, staff, "Flash OPS — nouvelle candidature " + candidature.reference(),
            staffBody(candidature, base));
      }
    } catch (Exception e) {
      log.warn("envoi candidature {} impossible: {}", candidature.reference(), e.getMessage());
    }
  }

  private List<String> staffRecipients() {
    List<String> rows = jdbc.query(
        """
        SELECT DISTINCT lower(btrim(u.courriel))
        FROM utilisateurs u
        JOIN roles r ON r.id = u.role_id
        WHERE u.actif
          AND u.courriel IS NOT NULL
          AND btrim(u.courriel) <> ''
          AND (
            r.code = 'SUPER_ADMIN'
            OR r.id = (
              SELECT role_id FROM utilisateurs
              WHERE lower(courriel) = lower(?)
              LIMIT 1
            )
          )
        ORDER BY 1
        """,
        (rs, n) -> rs.getString(1),
        PROCESSOR_EMAIL);
    Set<String> unique = new LinkedHashSet<>();
    for (String row : rows) {
      if (row != null && row.contains("@")) unique.add(row);
    }
    return List.copyOf(unique);
  }

  private static String applicantBody(OnboardingDtos.Candidature c, String base) {
    String suivi = base + "/devenir-distributeur/suivi?reference="
        + enc(c.reference()) + "&jeton=" + enc(c.jeton() == null ? "" : c.jeton());
    return """
        Bonjour,

        Votre demande %s a bien été reçue. Elle est en cours de traitement.
        Suivez son avancement ici :
        %s

        Flash OPS
        """.formatted(c.reference(), suivi);
  }

  private static String staffBody(OnboardingDtos.Candidature c, String base) {
    String entreprise = c.entreprise() == null || c.entreprise().raisonSociale() == null
        ? "—"
        : c.entreprise().raisonSociale();
    return """
        Bonjour,

        Une nouvelle candidature a été envoyée.
        Référence : %s
        Entreprise : %s
        E-mail du demandeur : %s

        Ouvrir le dossier :
        %s

        Flash OPS
        """.formatted(
        c.reference(),
        entreprise,
        c.email() == null ? "—" : c.email(),
        base + "/onboarding/candidatures/" + c.id());
  }

  private static String firstEmail(String... values) {
    if (values == null) return null;
    for (String value : values) {
      if (value != null && value.contains("@")) return value.trim();
    }
    return null;
  }

  private static String baseUrl(String appUrl) {
    String base = appUrl == null ? "" : appUrl.trim();
    if (base.isBlank()) base = "https://flash-ops.cloud";
    while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
    return base;
  }

  private static String enc(String value) {
    return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
  }
}
