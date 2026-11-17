package com.flashops.api.pilotage;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Expressions monétaires pilotage. Quand USD est sélectionné avec CDF et/ou FCN, les montants
 * non-USD sont convertis en USD via les taux système (1 USD = N CDF / N FCN).
 */
final class PilotageMoneySql {

  private PilotageMoneySql() {}

  static List<String> cleanDevises(List<String> raw) {
    if (raw == null || raw.isEmpty()) {
      return List.of();
    }
    Set<String> out = new LinkedHashSet<>();
    for (String item : raw) {
      if (item == null) {
        continue;
      }
      for (String part : item.split(",")) {
        String code = part.trim().toUpperCase(Locale.ROOT);
        if (!code.isEmpty()) {
          out.add(code);
        }
      }
    }
    return List.copyOf(out);
  }

  private static boolean positive(BigDecimal taux) {
    return taux != null && taux.compareTo(BigDecimal.ZERO) > 0;
  }

  static boolean convertsToUsd(List<String> devises, BigDecimal tauxUsdCdf, BigDecimal tauxUsdFcn) {
    if (devises == null || devises.isEmpty()) {
      return false;
    }
    Set<String> set = Set.copyOf(devises);
    if (!set.contains("USD")) {
      return false;
    }
    boolean cdf = set.contains("CDF") && positive(tauxUsdCdf);
    boolean fcn = set.contains("FCN") && positive(tauxUsdFcn);
    return cdf || fcn;
  }

  static String displayDevise(List<String> devises, BigDecimal tauxUsdCdf, BigDecimal tauxUsdFcn) {
    List<String> clean = cleanDevises(devises);
    if (convertsToUsd(clean, tauxUsdCdf, tauxUsdFcn)) {
      return "USD";
    }
    return clean.isEmpty() ? "" : clean.get(0);
  }

  /** {@code coalesce(sum(...), 0)} avec conversion éventuelle CDF/FCN→USD. */
  static String sum(String alias, String column, PilotageBundleQuery q) {
    return "coalesce(" + sumRaw(alias, column, q) + ", 0)";
  }

  /** Expression {@code sum(...)} seule (ORDER BY). */
  static String sumRaw(String alias, String column, PilotageBundleQuery q) {
    String ref = alias + "." + column;
    if (!q.convertsToUsd()) {
      return "sum(" + ref + ")";
    }
    return "sum(" + converted(ref, q.tauxUsdCdf(), q.tauxUsdFcn()) + ")";
  }

  /** {@code coalesce(avg(...), 0)} sur montants éventuellement convertis. */
  static String avg(String alias, String column, PilotageBundleQuery q) {
    String ref = alias + "." + column;
    if (!q.convertsToUsd()) {
      return "coalesce(avg(" + ref + "), 0)";
    }
    return "coalesce(avg(" + converted(ref, q.tauxUsdCdf(), q.tauxUsdFcn()) + "), 0)";
  }

  /** Valeur unitaire (ligne) éventuellement convertie. */
  static String value(String alias, String column, PilotageBundleQuery q) {
    String ref = alias + "." + column;
    if (!q.convertsToUsd()) {
      return ref;
    }
    return converted(ref, q.tauxUsdCdf(), q.tauxUsdFcn());
  }

  private static String converted(String ref, BigDecimal tauxUsdCdf, BigDecimal tauxUsdFcn) {
    StringBuilder sql = new StringBuilder("CASE WHEN upper(btrim(dv.code)) = 'USD' THEN ");
    sql.append(ref);
    if (positive(tauxUsdCdf)) {
      String taux = tauxUsdCdf.toPlainString();
      sql.append(" WHEN upper(btrim(dv.code)) = 'CDF' THEN ")
          .append(ref)
          .append(" / NULLIF(")
          .append(taux)
          .append("::numeric, 0)");
    }
    if (positive(tauxUsdFcn)) {
      String taux = tauxUsdFcn.toPlainString();
      sql.append(" WHEN upper(btrim(dv.code)) = 'FCN' THEN ")
          .append(ref)
          .append(" / NULLIF(")
          .append(taux)
          .append("::numeric, 0)");
    }
    // Autres devises non-USD : conserver l’ancien comportement via le taux CDF si disponible.
    if (positive(tauxUsdCdf)) {
      sql.append(" ELSE ")
          .append(ref)
          .append(" / NULLIF(")
          .append(tauxUsdCdf.toPlainString())
          .append("::numeric, 0)");
    } else {
      sql.append(" ELSE ").append(ref);
    }
    sql.append(" END");
    return sql.toString();
  }

  static String[] toSqlArray(List<String> devises) {
    List<String> clean = cleanDevises(devises);
    return clean.toArray(new String[0]);
  }

  static List<String> ensureNonEmpty(List<String> devises, String fallback) {
    List<String> clean = cleanDevises(devises);
    if (!clean.isEmpty()) {
      return clean;
    }
    if (fallback == null || fallback.isBlank()) {
      return List.of();
    }
    return cleanDevises(List.of(fallback));
  }

  static List<String> mergeParam(List<String> devises) {
    if (devises == null) {
      return List.of();
    }
    List<String> expanded = new ArrayList<>();
    for (String d : devises) {
      if (d != null) {
        expanded.add(d);
      }
    }
    return cleanDevises(expanded);
  }
}
