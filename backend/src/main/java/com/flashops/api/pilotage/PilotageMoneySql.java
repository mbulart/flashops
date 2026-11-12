package com.flashops.api.pilotage;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Expressions monétaires pilotage. Quand USD et CDF sont sélectionnés ensemble, les montants CDF
 * (et assimilés non-USD) sont convertis en USD via {@code taux_change_usd_cdf} (1 USD = N CDF).
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

  static boolean convertsToUsd(List<String> devises, BigDecimal tauxUsdCdf) {
    if (devises == null || devises.isEmpty()) {
      return false;
    }
    if (tauxUsdCdf == null || tauxUsdCdf.compareTo(BigDecimal.ZERO) <= 0) {
      return false;
    }
    Set<String> set = Set.copyOf(devises);
    return set.contains("USD") && set.contains("CDF");
  }

  static String displayDevise(List<String> devises, BigDecimal tauxUsdCdf) {
    List<String> clean = cleanDevises(devises);
    if (convertsToUsd(clean, tauxUsdCdf)) {
      return "USD";
    }
    return clean.isEmpty() ? "" : clean.get(0);
  }

  /** {@code coalesce(sum(...), 0)} avec conversion éventuelle CDF→USD. */
  static String sum(String alias, String column, PilotageBundleQuery q) {
    return "coalesce(" + sumRaw(alias, column, q) + ", 0)";
  }

  /** Expression {@code sum(...)} seule (ORDER BY). */
  static String sumRaw(String alias, String column, PilotageBundleQuery q) {
    String ref = alias + "." + column;
    if (!q.convertsToUsd()) {
      return "sum(" + ref + ")";
    }
    return "sum(" + converted(ref, q.tauxUsdCdf()) + ")";
  }

  /** {@code coalesce(avg(...), 0)} sur montants éventuellement convertis. */
  static String avg(String alias, String column, PilotageBundleQuery q) {
    String ref = alias + "." + column;
    if (!q.convertsToUsd()) {
      return "coalesce(avg(" + ref + "), 0)";
    }
    return "coalesce(avg(" + converted(ref, q.tauxUsdCdf()) + "), 0)";
  }

  /** Valeur unitaire (ligne) éventuellement convertie. */
  static String value(String alias, String column, PilotageBundleQuery q) {
    String ref = alias + "." + column;
    if (!q.convertsToUsd()) {
      return ref;
    }
    return converted(ref, q.tauxUsdCdf());
  }

  private static String converted(String ref, BigDecimal tauxUsdCdf) {
    String taux = tauxUsdCdf.toPlainString();
    return "CASE WHEN upper(btrim(dv.code)) = 'USD' THEN "
        + ref
        + " ELSE "
        + ref
        + " / NULLIF("
        + taux
        + "::numeric, 0) END";
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
