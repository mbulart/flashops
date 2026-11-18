package com.flashops.api.pilotage;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/**
 * Fenêtres et taux MoM / YoY du montant. Le montant courant est celui de la période filtrée ;
 * la référence reprend exactement les mêmes filtres sur une autre fenêtre.
 */
public final class PilotageMontantCompare {

  public static final String OK = "ok";
  public static final String NOUVEAU = "nouveau";
  public static final String INSUFFISANT = "insuffisant";

  private static final DateTimeFormatter LABEL =
      DateTimeFormatter.ofPattern("d MMM yyyy", Locale.FRENCH);

  private PilotageMontantCompare() {}

  public record Window(LocalDate from, LocalDate to) {}

  public record Variation(String statut, BigDecimal pct, BigDecimal ecart) {}

  /** Mois civils complets → bloc précédent de même longueur. Sinon, mêmes jours le mois d’avant. */
  public static Window mom(LocalDate from, LocalDate to) {
    var span = ordered(from, to);
    if (completeMonths(span.from(), span.to())) {
      int months = (int) ChronoUnit.MONTHS.between(span.from(), span.to()) + 1;
      LocalDate refTo = span.from().minusDays(1);
      LocalDate refFrom = span.from().minusMonths(months);
      return new Window(refFrom, refTo);
    }
    return new Window(span.from().minusMonths(1), span.to().minusMonths(1));
  }

  /** Mêmes bornes, un an plus tôt. */
  public static Window yoy(LocalDate from, LocalDate to) {
    var span = ordered(from, to);
    return new Window(span.from().minusYears(1), span.to().minusYears(1));
  }

  public static String label(Window window) {
    return LABEL.format(window.from()) + " – " + LABEL.format(window.to());
  }

  /**
   * {@code reference == null} ou {@code current == null} : données insuffisantes.
   * Référence nulle et actuel non nul : nouveau. Les deux nuls : 0 %.
   */
  public static Variation variation(BigDecimal current, BigDecimal reference) {
    if (current == null || reference == null) {
      return new Variation(INSUFFISANT, null, null);
    }
    if (reference.compareTo(BigDecimal.ZERO) == 0) {
      if (current.compareTo(BigDecimal.ZERO) == 0) {
        return new Variation(OK, BigDecimal.ZERO, BigDecimal.ZERO);
      }
      return new Variation(NOUVEAU, null, current);
    }
    BigDecimal ecart = current.subtract(reference);
    BigDecimal pct =
        ecart.multiply(BigDecimal.valueOf(100)).divide(reference, 8, RoundingMode.HALF_UP);
    return new Variation(OK, pct, ecart);
  }

  private static Window ordered(LocalDate from, LocalDate to) {
    if (to.isBefore(from)) {
      return new Window(to, from);
    }
    return new Window(from, to);
  }

  private static boolean completeMonths(LocalDate from, LocalDate to) {
    return from.getDayOfMonth() == 1
        && to.equals(to.withDayOfMonth(to.lengthOfMonth()))
        && !to.isBefore(from);
  }
}
