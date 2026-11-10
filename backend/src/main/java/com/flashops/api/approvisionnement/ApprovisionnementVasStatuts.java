package com.flashops.api.approvisionnement;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Transitions de statut Approvisionnement VAS (côté serveur). */
public final class ApprovisionnementVasStatuts {

  public static final String BROUILLON = "brouillon";
  public static final String SOUMISE = "soumise";
  public static final String EN_ATTENTE_VALIDATION = "en_attente_validation";
  public static final String VALIDEE = "validee";
  public static final String EN_ATTENTE_PAIEMENT = "en_attente_paiement";
  public static final String PARTIELLEMENT_PAYEE = "partiellement_payee";
  public static final String PAYEE = "payee";
  public static final String REJETEE = "rejetee";
  public static final String ANNULEE = "annulee";

  public static final Set<String> ALL =
      Set.of(
          BROUILLON,
          SOUMISE,
          EN_ATTENTE_VALIDATION,
          VALIDEE,
          EN_ATTENTE_PAIEMENT,
          PARTIELLEMENT_PAYEE,
          PAYEE,
          REJETEE,
          ANNULEE);

  private static final Map<String, Set<String>> TRANSITIONS =
      Map.of(
          BROUILLON, Set.of(SOUMISE, ANNULEE),
          SOUMISE, Set.of(EN_ATTENTE_VALIDATION, ANNULEE),
          EN_ATTENTE_VALIDATION, Set.of(VALIDEE, REJETEE, ANNULEE),
          VALIDEE, Set.of(EN_ATTENTE_PAIEMENT, ANNULEE),
          EN_ATTENTE_PAIEMENT, Set.of(PARTIELLEMENT_PAYEE, PAYEE, ANNULEE),
          PARTIELLEMENT_PAYEE, Set.of(PAYEE, PARTIELLEMENT_PAYEE, ANNULEE),
          PAYEE, Set.of(),
          REJETEE, Set.of(),
          ANNULEE, Set.of());

  private ApprovisionnementVasStatuts() {}

  public static String normalize(String statut) {
    String v =
        (statut == null || statut.isBlank() ? BROUILLON : statut.trim().toLowerCase(Locale.ROOT));
    if (!ALL.contains(v)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "statut invalide");
    }
    return v;
  }

  public static void assertTransition(String from, String to) {
    String f = normalize(from);
    String t = normalize(to);
    if (f.equals(t)) {
      return;
    }
    Set<String> allowed = TRANSITIONS.getOrDefault(f, Set.of());
    if (!allowed.contains(t)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "transition de statut interdite: " + f + " → " + t);
    }
  }

  public static boolean isEditable(String statut) {
    String s = normalize(statut);
    return BROUILLON.equals(s) || SOUMISE.equals(s);
  }

  public static boolean isPayable(String statut) {
    String s = normalize(statut);
    return EN_ATTENTE_PAIEMENT.equals(s)
        || PARTIELLEMENT_PAYEE.equals(s)
        || VALIDEE.equals(s);
  }
}
