package com.flashops.api.pilotage;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/** Règles métier produit / domaine (alignées Flash OPS — ex. MPESA = monnaie). */
public final class PilotageProductRules {

  private PilotageProductRules() {}

  /**
   * Mobile money / monnaie électronique mal rangée en {@code domaine = transfert} (ex. MPESA —
   * Retraits).
   */
  private static String sqlMonnaieElectroniqueOn(String pAlias) {
    return "("
        + "upper(btrim(coalesce("
        + pAlias
        + ".module, ''))) = 'MPESA'"
        + " OR btrim(coalesce("
        + pAlias
        + ".ecran, '')) = 'MobileMoney'"
        + " OR ("
        + "upper(btrim(coalesce("
        + pAlias
        + ".module, ''))) <> 'FLASHPAYMENT'"
        + " AND ("
        + "upper(btrim(coalesce("
        + pAlias
        + ".produit, ''))) IN ('MPESA', 'M-PESA', 'M PESA')"
        + " OR upper(btrim(coalesce("
        + pAlias
        + ".produit, ''))) LIKE '%MPESA%'"
        + ")))";
  }

  /** Prédicat SQL sur alias {@code p} de {@code pilotage.dim_produit} (listes produits). */
  static final String SQL_MPESA_ON_P = sqlMonnaieElectroniqueOn("p");

  /**
   * Restreint les lignes d’agrégat au domaine UI via {@code dim_produit} (pas seulement {@code
   * g.domaine}, qui peut diverger).
   */
  static void appendAggregateDomaine(String aggregateAlias, String domaine, StringBuilder sql) {
    appendAggregateDomaine(aggregateAlias, domaine, sql, List.of(), false);
  }

  static void appendAggregateDomaine(
      String aggregateAlias,
      String domaine,
      StringBuilder sql,
      List<String> extraProductKeys,
      boolean transfertRestrictedToExtras) {
    if ("transfert".equals(domaine)) {
      sql.append(" AND EXISTS (SELECT 1 FROM pilotage.dim_produit AS dp WHERE dp.produit_id = ")
          .append(aggregateAlias)
          .append(".produit_id AND dp.produit_id <> 0 AND dp.domaine = 'transfert' AND NOT ")
          .append(sqlMonnaieElectroniqueOn("dp"));
      if (transfertRestrictedToExtras && extraProductKeys != null && !extraProductKeys.isEmpty()) {
        sql.append(" AND ").append(sqlProductKeyMatch("dp", extraProductKeys));
      }
      sql.append(")");
    } else if ("monnaie".equals(domaine)) {
      sql.append(" AND EXISTS (SELECT 1 FROM pilotage.dim_produit AS dp WHERE dp.produit_id = ")
          .append(aggregateAlias)
          .append(".produit_id AND dp.produit_id <> 0 AND (dp.domaine = 'monnaie' OR ")
          .append(sqlMonnaieElectroniqueOn("dp"))
          .append("))");
    } else if ("service".equals(domaine)) {
      sql.append(" AND EXISTS (SELECT 1 FROM pilotage.dim_produit AS dp WHERE dp.produit_id = ")
          .append(aggregateAlias)
          .append(".produit_id AND dp.produit_id <> 0 AND dp.domaine = 'service')");
    } else {
      sql.append(" AND ").append(aggregateAlias).append(".domaine = ?");
    }
  }

  /** Filtre produit après jointure {@code dim_produit AS p} (ventilation graphiques). */
  static void appendDimProduitUiDomain(String pAlias, String domaine, StringBuilder sql) {
    appendDimProduitUiDomain(pAlias, domaine, sql, List.of(), false);
  }

  static void appendDimProduitUiDomain(
      String pAlias,
      String domaine,
      StringBuilder sql,
      List<String> extraProductKeys,
      boolean transfertRestrictedToExtras) {
    if ("transfert".equals(domaine)) {
      if (transfertRestrictedToExtras && extraProductKeys != null && !extraProductKeys.isEmpty()) {
        sql.append(" AND ").append(pAlias).append(".domaine = 'transfert' AND NOT ");
        sql.append(sqlMonnaieElectroniqueOn(pAlias));
        sql.append(" AND ").append(sqlProductKeyMatch(pAlias, extraProductKeys));
      } else {
        sql.append(" AND ").append(pAlias).append(".domaine = 'transfert' AND NOT ");
        sql.append(sqlMonnaieElectroniqueOn(pAlias));
      }
    } else if ("monnaie".equals(domaine)) {
      sql.append(" AND (").append(pAlias).append(".domaine = 'monnaie' OR ");
      sql.append(sqlMonnaieElectroniqueOn(pAlias)).append(")");
    } else if ("service".equals(domaine)) {
      sql.append(" AND ").append(pAlias).append(".domaine = 'service'");
    }
  }

  static String sqlProductKeyMatch(String pAlias, List<String> keys) {
    var cleaned = cleanProductKeys(keys);
    if (cleaned.isEmpty()) {
      return "TRUE";
    }
    StringBuilder sb = new StringBuilder("(");
    for (int i = 0; i < cleaned.size(); i++) {
      if (i > 0) {
        sb.append(" OR ");
      }
      String lit = cleaned.get(i).replace("'", "''");
      sb.append("upper(replace(replace(btrim(coalesce(")
          .append(pAlias)
          .append(".module, '')), ' ', '_'), '-', '_')) = '")
          .append(lit)
          .append("' OR upper(replace(replace(btrim(coalesce(")
          .append(pAlias)
          .append(".produit, '')), ' ', '_'), '-', '_')) = '")
          .append(lit)
          .append("' OR upper(replace(replace(btrim(coalesce(")
          .append(pAlias)
          .append(".module, '')), ' ', '_'), '-', '_')) LIKE '%")
          .append(lit)
          .append("%' OR upper(replace(replace(btrim(coalesce(")
          .append(pAlias)
          .append(".produit, '')), ' ', '_'), '-', '_')) LIKE '%")
          .append(lit)
          .append("%'");
    }
    sb.append(")");
    return sb.toString();
  }

  static List<String> cleanProductKeys(List<String> keys) {
    var out = new ArrayList<String>();
    var seen = new LinkedHashSet<String>();
    if (keys == null) {
      return out;
    }
    for (String key : keys) {
      if (key == null || key.isBlank()) {
        continue;
      }
      String value =
          key.trim().toUpperCase().replace(' ', '_').replace('-', '_').replace("'", "");
      if (seen.add(value)) {
        out.add(value);
      }
    }
    return out;
  }

  static boolean usesDomaineParam(String domaine) {
    return domaine != null
        && !"monnaie".equals(domaine)
        && !"transfert".equals(domaine)
        && !"service".equals(domaine);
  }

  /** Un domaine : même SQL qu’avant. Plusieurs : union, sans compter deux fois une opération. */
  static void appendAggregateDomaines(
      String aggregateAlias, List<String> domaines, StringBuilder sql, List<Object> args) {
    appendAggregateDomaines(aggregateAlias, domaines, sql, args, List.of(), false);
  }

  static void appendAggregateDomaines(
      String aggregateAlias,
      List<String> domaines,
      StringBuilder sql,
      List<Object> args,
      List<String> extraProductKeys,
      boolean transfertRestrictedToExtras) {
    List<String> list = cleanDomaines(domaines);
    if (list.size() <= 1) {
      String domaine = list.isEmpty() ? "" : list.get(0);
      appendAggregateDomaine(
          aggregateAlias, domaine, sql, extraProductKeys, transfertRestrictedToExtras);
      if (usesDomaineParam(domaine)) {
        args.add(domaine);
      }
      return;
    }
    sql.append(" AND (");
    for (int i = 0; i < list.size(); i++) {
      if (i > 0) {
        sql.append(" OR ");
      }
      var one = new StringBuilder();
      appendAggregateDomaine(
          aggregateAlias, list.get(i), one, extraProductKeys, transfertRestrictedToExtras);
      sql.append("(").append(stripLeadingAnd(one.toString())).append(")");
      if (usesDomaineParam(list.get(i))) {
        args.add(list.get(i));
      }
    }
    sql.append(")");
  }

  static void appendDimProduitDomaines(String pAlias, List<String> domaines, StringBuilder sql) {
    appendDimProduitDomaines(pAlias, domaines, sql, List.of(), false);
  }

  static void appendDimProduitDomaines(
      String pAlias,
      List<String> domaines,
      StringBuilder sql,
      List<String> extraProductKeys,
      boolean transfertRestrictedToExtras) {
    List<String> list = cleanDomaines(domaines);
    if (list.size() <= 1) {
      appendDimProduitUiDomain(
          pAlias,
          list.isEmpty() ? "" : list.get(0),
          sql,
          extraProductKeys,
          transfertRestrictedToExtras);
      return;
    }
    sql.append(" AND (");
    for (int i = 0; i < list.size(); i++) {
      if (i > 0) {
        sql.append(" OR ");
      }
      var one = new StringBuilder();
      appendDimProduitUiDomain(
          pAlias, list.get(i), one, extraProductKeys, transfertRestrictedToExtras);
      sql.append("(").append(stripLeadingAnd(one.toString())).append(")");
    }
    sql.append(")");
  }

  static List<String> cleanDomaines(List<String> domaines) {
    var out = new ArrayList<String>();
    var seen = new LinkedHashSet<String>();
    if (domaines == null) {
      return out;
    }
    for (String domaine : domaines) {
      if (domaine == null || domaine.isBlank()) {
        continue;
      }
      String value = domaine.trim();
      if (seen.add(value)) {
        out.add(value);
      }
    }
    return out;
  }

  private static String stripLeadingAnd(String sql) {
    return sql.replaceFirst("(?i)^\\s*AND\\s+", "");
  }
}
