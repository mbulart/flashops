package com.flashops.api.pilotage;

import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;

/** Fragments SQL communs pour les agrégats pilotage. */
final class PilotageSqlScope {

  private PilotageSqlScope() {}

  static ScopedSql build(
      JdbcTemplate jdbc,
      PilotageBundleQuery q,
      String table,
      String alias,
      boolean joinAgence,
      boolean agentGrain) {
    var sql = new StringBuilder();
    var args = new ArrayList<Object>();
    boolean joinDate = needsDateJoin(q.jourFiltre());

    sql.append(" FROM ").append(table).append(" AS ").append(alias);
    sql.append(" INNER JOIN pilotage.dim_devise AS dv ON dv.devise_id = ").append(alias).append(".devise_id");
    appendDeviseMatch(q, sql, args);

    if (joinDate) {
      sql.append(" INNER JOIN pilotage.dim_date AS dd ON dd.jour = ").append(alias).append(".jour");
      appendJourFiltre(q.jourFiltre(), sql);
    }

    String agenceAlias = null;
    if (joinAgence) {
      agenceAlias = "d";
      sql.append(" INNER JOIN pilotage.dim_agence AS d ON d.agence_id = ").append(alias).append(".agence_id");
      if (q.categories() != null && !q.categories().isEmpty()) {
        sql.append(" AND btrim(d.categorie) = ANY(?)");
        args.add(q.categories().toArray(new String[0]));
      }
      if (q.agenceIds() != null && !q.agenceIds().isEmpty()) {
        sql.append(" AND ").append(alias).append(".agence_id = ANY(?)");
        args.add(q.agenceIds().toArray(new Integer[0]));
      }
      if (q.geoScope() != null && q.geoScope().isActive()) {
        // Match geo une fois sur dim_agence, puis filtre indexable sur le grain.
        PilotageGeoMatchSupport.appendAgenceIdFilter(jdbc, q.geoScope(), alias, sql, args);
      }
    }

    sql.append(" WHERE 1=1");
    PilotageProductRules.appendAggregateDomaines(
        alias,
        q.resolvedDomaines(),
        sql,
        args,
        q.extraProductKeys(),
        q.transfertRestrictedToExtras());

    sql.append(" AND ").append(alias).append(".jour >= ?::date AND ").append(alias).append(".jour <= ?::date");
    args.add(q.from());
    args.add(q.to());

    if (q.agentIds() != null && !q.agentIds().isEmpty()) {
      sql.append(" AND ").append(alias).append(".agent_id = ANY(?)");
      args.add(q.agentIds().toArray(new Integer[0]));
    }

    if (q.statutUniformes() != null && !q.statutUniformes().isEmpty()) {
      sql.append(" AND ").append(alias).append(".statut_uniforme = ANY(?)");
      args.add(q.statutUniformes().toArray(new String[0]));
    }

    if (q.produitIds() != null && !q.produitIds().isEmpty()) {
      sql.append(" AND ").append(alias).append(".produit_id = ANY(?)");
      args.add(q.produitIds().toArray(new Integer[0]));
    } else if (q.ecran() != null && !q.ecran().isBlank()) {
      sql.append(
          " AND "
              + alias
              + ".produit_id IN (SELECT p.produit_id FROM pilotage.dim_produit AS p"
              + " WHERE p.produit_id <> 0 AND btrim(p.ecran) = btrim(?))");
      args.add(q.ecran().trim());
    }

    if (!agentGrain && q.typeOperationIds() != null && !q.typeOperationIds().isEmpty()) {
      sql.append(" AND ").append(alias).append(".type_operation_id = ANY(?)");
      args.add(q.typeOperationIds().toArray(new Integer[0]));
    }

    if (q.couloirOnAggregate()) {
      PilotageCouloirFilter.appendPairs(alias, q.couloirCodes(), sql, args);
    }

    return new ScopedSql(sql.toString(), args, joinDate, agenceAlias);
  }

  /**
   * Périmètre exact quand le couloir est combiné à un agent ou un type d’opération (absents de
   * {@code agg_couloir_jour}).
   */
  static ScopedSql buildFait(JdbcTemplate jdbc, PilotageBundleQuery q) {
    var sql = new StringBuilder();
    var args = new ArrayList<Object>();

    sql.append(" FROM pilotage.fait_operation AS f");
    sql.append(" INNER JOIN pilotage.dim_date AS d ON d.date_id = f.date_id");
    sql.append(" INNER JOIN pilotage.dim_produit AS p ON p.produit_id = f.produit_id");
    sql.append(" INNER JOIN pilotage.dim_statut AS s ON s.statut_id = f.statut_id AND s.inclure_agregat");
    sql.append(" INNER JOIN pilotage.dim_devise AS dv ON dv.devise_id = f.devise_id");
    appendDeviseMatch(q, sql, args);

    boolean joinAgence = q.usesAgenceGrain();
    if (joinAgence) {
      sql.append(" INNER JOIN pilotage.dim_agence AS ag ON ag.agence_id = f.agence_id");
      if (q.categories() != null && !q.categories().isEmpty()) {
        sql.append(" AND btrim(ag.categorie) = ANY(?)");
        args.add(q.categories().toArray(new String[0]));
      }
      if (q.agenceIds() != null && !q.agenceIds().isEmpty()) {
        sql.append(" AND f.agence_id = ANY(?)");
        args.add(q.agenceIds().toArray(new Integer[0]));
      }
      if (q.geoScope() != null && q.geoScope().isActive()) {
        PilotageGeoMatchSupport.appendAgenceIdFilter(jdbc, q.geoScope(), "f", sql, args);
      }
    }

    sql.append(" WHERE p.produit_id <> 0");
    PilotageProductRules.appendDimProduitDomaines(
        "p",
        q.resolvedDomaines(),
        sql,
        q.extraProductKeys(),
        q.transfertRestrictedToExtras());
    sql.append(" AND d.jour >= ?::date AND d.jour <= ?::date");
    args.add(q.from());
    args.add(q.to());
    appendJourFiltreOnDate(q.jourFiltre(), "d", sql);
    if (q.hasCouloir()) {
      PilotageCouloirFilter.appendPairs("f", q.couloirCodes(), sql, args);
    }

    if (q.agentIds() != null && !q.agentIds().isEmpty()) {
      sql.append(" AND f.agent_id = ANY(?)");
      args.add(q.agentIds().toArray(new Integer[0]));
    }
    if (q.statutUniformes() != null && !q.statutUniformes().isEmpty()) {
      sql.append(" AND s.statut_uniforme = ANY(?)");
      args.add(q.statutUniformes().toArray(new String[0]));
    }
    if (q.produitIds() != null && !q.produitIds().isEmpty()) {
      sql.append(" AND f.produit_id = ANY(?)");
      args.add(q.produitIds().toArray(new Integer[0]));
    } else if (q.ecran() != null && !q.ecran().isBlank()) {
      sql.append(" AND btrim(p.ecran) = btrim(?)");
      args.add(q.ecran().trim());
    }
    if (q.typeOperationIds() != null && !q.typeOperationIds().isEmpty()) {
      sql.append(" AND f.type_operation_id = ANY(?)");
      args.add(q.typeOperationIds().toArray(new Integer[0]));
    }

    return new ScopedSql(sql.toString(), args, true, joinAgence ? "ag" : null);
  }

  /** Lignes de fait du périmètre (agence toujours jointe, couloir seulement s’il est choisi). */
  static ScopedSql buildLignes(JdbcTemplate jdbc, PilotageBundleQuery q) {
    var scoped = buildFait(jdbc, q);
    if (scoped.agenceAlias() != null) {
      return scoped;
    }
    String from =
        scoped
            .fromAndWhere()
            .replaceFirst(
                " WHERE ",
                " INNER JOIN pilotage.dim_agence AS ag ON ag.agence_id = f.agence_id WHERE ");
    return new ScopedSql(from, scoped.args(), true, "ag");
  }

  static ScopedSql buildMois(
      JdbcTemplate jdbc,
      PilotageBundleQuery q,
      String table,
      String alias,
      boolean joinAgence,
      boolean agentGrain) {
    var scoped = build(jdbc, q, table, alias, joinAgence, agentGrain);
    var fromSql =
        scoped.fromAndWhere().replace(alias + ".jour >=", alias + ".mois >=")
            .replace(alias + ".jour <=", alias + ".mois <=");
    if (scoped.joinDate()) {
      fromSql = fromSql.replace("dd.jour = " + alias + ".jour", "dd.jour = " + alias + ".mois");
    }
    return new ScopedSql(fromSql, scoped.args(), scoped.joinDate(), scoped.agenceAlias());
  }

  private static void appendDeviseMatch(
      PilotageBundleQuery q, StringBuilder sql, java.util.ArrayList<Object> args) {
    sql.append(" AND upper(btrim(dv.code)) = ANY(?)");
    args.add(PilotageMoneySql.toSqlArray(q.resolvedDevises()));
  }

  private static boolean needsDateJoin(String jourFiltre) {
    if (jourFiltre == null || jourFiltre.isBlank()) {
      return false;
    }
    return "hors_weekend".equals(jourFiltre) || "feries".equals(jourFiltre);
  }

  /** Totaux d’un mois civil (MoM / YoY) — sans borne from/to jour. */
  static ScopedSql buildSingleMonth(PilotageBundleQuery q, String moisIso) {
    var sql = new StringBuilder();
    var args = new ArrayList<Object>();
    sql.append(" FROM pilotage.agg_operation_mois AS g");
    sql.append(" INNER JOIN pilotage.dim_devise AS dv ON dv.devise_id = g.devise_id");
    appendDeviseMatch(q, sql, args);
    sql.append(" WHERE g.mois = ?::date");
    args.add(moisIso);
    PilotageProductRules.appendAggregateDomaines(
        "g",
        q.resolvedDomaines(),
        sql,
        args,
        q.extraProductKeys(),
        q.transfertRestrictedToExtras());
    appendCommonProductStatutFilters(q, "g", sql, args, false);
    return new ScopedSql(sql.toString(), args, false, null);
  }

  private static void appendCommonProductStatutFilters(
      PilotageBundleQuery q, String alias, StringBuilder sql, List<Object> args, boolean agentGrain) {
    if (q.statutUniformes() != null && !q.statutUniformes().isEmpty()) {
      sql.append(" AND ").append(alias).append(".statut_uniforme = ANY(?)");
      args.add(q.statutUniformes().toArray(new String[0]));
    }
    if (q.produitIds() != null && !q.produitIds().isEmpty()) {
      sql.append(" AND ").append(alias).append(".produit_id = ANY(?)");
      args.add(q.produitIds().toArray(new Integer[0]));
    } else if (q.ecran() != null && !q.ecran().isBlank()) {
      sql.append(
          " AND "
              + alias
              + ".produit_id IN (SELECT p.produit_id FROM pilotage.dim_produit AS p"
              + " WHERE p.produit_id <> 0 AND btrim(p.ecran) = btrim(?))");
      args.add(q.ecran().trim());
    }
    if (!agentGrain && q.typeOperationIds() != null && !q.typeOperationIds().isEmpty()) {
      sql.append(" AND ").append(alias).append(".type_operation_id = ANY(?)");
      args.add(q.typeOperationIds().toArray(new Integer[0]));
    }
  }

  private static void appendJourFiltre(String jourFiltre, StringBuilder sql) {
    appendJourFiltreOnDate(jourFiltre, "dd", sql);
  }

  private static void appendJourFiltreOnDate(String jourFiltre, String alias, StringBuilder sql) {
    if ("hors_weekend".equals(jourFiltre)) {
      sql.append(" AND ").append(alias).append(".est_weekend = FALSE");
    } else if ("feries".equals(jourFiltre)) {
      sql.append(" AND ").append(alias).append(".est_ferie = TRUE");
    }
  }

  record ScopedSql(String fromAndWhere, List<Object> args, boolean joinDate, String agenceAlias) {}
}
