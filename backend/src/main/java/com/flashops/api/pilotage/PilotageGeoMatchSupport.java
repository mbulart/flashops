package com.flashops.api.pilotage;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Résout les IDs référentiel geo en prédicats sur pilotage.dim_agence (champs texte).
 *
 * <p>Sur les agrégats / faits, préférer {@link #appendAgenceIdFilter} : le match texte (folded /
 * regexp) est calculé une fois sur {@code dim_agence}, puis filtré par {@code agence_id = ANY(?)} —
 * même logique, sans rejouer le folded sur chaque ligne d’agrégat.
 */
final class PilotageGeoMatchSupport {

  private PilotageGeoMatchSupport() {}

  /**
   * Filtre le grain opération ({@code g}/{@code f}) par les agences du scope geo, sans appliquer
   * folded() sur le join des agrégats.
   */
  static void appendAgenceIdFilter(
      JdbcTemplate jdbc,
      PilotageAgenceFilterScope scope,
      String operationAlias,
      StringBuilder sql,
      List<Object> args) {
    if (scope == null || !scope.isActive()) {
      return;
    }
    Integer[] ids = resolveAgenceIds(jdbc, scope);
    if (ids.length == 0) {
      sql.append(" AND 1 = 0");
      return;
    }
    sql.append(" AND ").append(operationAlias).append(".agence_id = ANY(?)");
    args.add(ids);
  }

  /** IDs {@code dim_agence} correspondant au scope (même règles que {@link #appendDimAgenceScope}). */
  static Integer[] resolveAgenceIds(JdbcTemplate jdbc, PilotageAgenceFilterScope scope) {
    var sql = new StringBuilder("SELECT a.agence_id FROM pilotage.dim_agence AS a WHERE a.agence_id <> 0");
    var args = new ArrayList<Object>();
    appendDimAgenceScope(jdbc, scope, "a", sql, args);
    try {
      List<Integer> ids = jdbc.query(sql.toString(), (rs, rowNum) -> rs.getInt(1), args.toArray());
      return ids.toArray(Integer[]::new);
    } catch (DataAccessException ex) {
      return new Integer[0];
    }
  }

  static void appendDimAgenceScope(
      JdbcTemplate jdbc,
      PilotageAgenceFilterScope scope,
      String agenceAlias,
      StringBuilder sql,
      List<Object> args) {
    appendReseauScope(jdbc, scope, agenceAlias, sql, args);

    if (!scope.communeIds().isEmpty()) {
      appendLibelleAny(jdbc, "communes", scope.communeIds(), agenceAlias + ".commune", sql, args);
      return;
    }
    if (!scope.villeIds().isEmpty()) {
      appendLibelleAny(jdbc, "villes", scope.villeIds(), agenceAlias + ".ville", sql, args);
      return;
    }
    if (scope.territoireId() != null && scope.territoireId() > 0) {
      appendTerritoireMatch(scope.territoireId(), agenceAlias, sql, args);
      return;
    }
    if (scope.provinceId() != null && scope.provinceId() > 0) {
      appendProvinceMatch(jdbc, scope.provinceId(), agenceAlias, sql, args);
      return;
    }
    if (scope.paysId() != null && scope.paysId() > 0) {
      appendPaysMatch(jdbc, scope.paysId(), agenceAlias, sql, args);
    }
  }

  private static void appendPaysMatch(
      JdbcTemplate jdbc, int paysId, String agenceAlias, StringBuilder sql, List<Object> args) {
    PaysRow pays = loadPays(jdbc, paysId);
    if (pays == null) {
      sql.append(" AND 1 = 0");
      return;
    }
    Set<String> labels = new LinkedHashSet<>();
    addLabel(labels, pays.libelle());
    addLabel(labels, pays.libelleFr());
    addLabel(labels, pays.libelleDefaut());
    if (labels.isEmpty() && !"CD".equalsIgnoreCase(pays.codeIso())) {
      sql.append(" AND 1 = 0");
      return;
    }
    sql.append(" AND (");
    int i = 0;
    for (String label : labels) {
      if (i++ > 0) {
        sql.append(" OR ");
      }
      sql.append(folded(agenceAlias + ".pays")).append(" = ").append(folded("?"));
      args.add(label);
    }
    if ("CD".equalsIgnoreCase(pays.codeIso())) {
      if (i > 0) {
        sql.append(" OR ");
      }
      sql.append(
          folded(agenceAlias + ".pays")
              + " IN ("
              + foldedLiteral("RDC")
              + ", "
              + foldedLiteral("RD CONGO")
              + ", "
              + foldedLiteral("REPUBLIQUE DEMOCRATIQUE DU CONGO")
              + ", "
              + foldedLiteral("CONGO RDC")
              + ", "
              + foldedLiteral("CONGO (RDC)")
              + ", "
              + foldedLiteral("DRC")
              + ", "
              + foldedLiteral("COD")
              + ", "
              + foldedLiteral("CONGO KINSHASA")
              + ")");
      // Pays vide/NULL : beaucoup d'agences Flash Payment n'ont pas le texte renseigné
      // (region/zone aussi NULL). Sans ce cas, le filtre RDC exclut 100 % de leurs tx.
      sql.append(" OR ").append(folded(agenceAlias + ".pays")).append(" = ''");
      sql.append(
          " OR (("
              + folded(agenceAlias + ".pays")
              + " IN ("
              + foldedLiteral("RDC")
              + ", "
              + foldedLiteral("RD CONGO")
              + ", "
              + foldedLiteral("DRC")
              + ", "
              + foldedLiteral("COD")
              + ")) AND (coalesce("
              + agenceAlias
              + ".region_id, 0) <> 0 OR coalesce("
              + agenceAlias
              + ".zone_id, 0) <> 0))");
    }
    sql.append(")");
  }

  private static void appendProvinceMatch(
      JdbcTemplate jdbc, int provinceId, String agenceAlias, StringBuilder sql, List<Object> args) {
    String libelle = loadLibelle(jdbc, "provinces", provinceId);
    if (libelle == null) {
      sql.append(" AND 1 = 0");
      return;
    }
    sql.append(" AND ").append(folded(agenceAlias + ".province")).append(" = ").append(folded("?"));
    args.add(libelle);
  }

  private static void appendVilleMatch(
      JdbcTemplate jdbc, int villeId, String agenceAlias, StringBuilder sql, List<Object> args) {
    String libelle = loadLibelle(jdbc, "villes", villeId);
    if (libelle == null) {
      sql.append(" AND 1 = 0");
      return;
    }
    sql.append(" AND ").append(folded(agenceAlias + ".ville")).append(" = ").append(folded("?"));
    args.add(libelle);
  }

  private static void appendTerritoireMatch(
      int territoireId, String agenceAlias, StringBuilder sql, List<Object> args) {
    sql.append(
        " AND EXISTS (SELECT 1 FROM communes AS c WHERE c.territoire_id = ? AND "
            + folded(agenceAlias + ".commune")
            + " = "
            + folded("c.libelle")
            + ")");
    args.add(territoireId);
  }

  private static void appendCommuneMatch(
      JdbcTemplate jdbc, int communeId, String agenceAlias, StringBuilder sql, List<Object> args) {
    String libelle = loadLibelle(jdbc, "communes", communeId);
    if (libelle == null) {
      sql.append(" AND 1 = 0");
      return;
    }
    sql.append(" AND ").append(folded(agenceAlias + ".commune")).append(" = ").append(folded("?"));
    args.add(libelle);
  }

  private static PaysRow loadPays(JdbcTemplate jdbc, int paysId) {
    try {
      var rows =
          jdbc.query(
              """
              SELECT code_iso, libelle, libelle_fr, libelle_defaut
              FROM pays WHERE id = ? AND actif = TRUE
              """,
              (rs, rowNum) ->
                  new PaysRow(
                      rs.getString("code_iso"),
                      rs.getString("libelle"),
                      rs.getString("libelle_fr"),
                      rs.getString("libelle_defaut")),
              paysId);
      return rows.isEmpty() ? null : rows.getFirst();
    } catch (DataAccessException ex) {
      return null;
    }
  }

  private static String loadLibelle(JdbcTemplate jdbc, String table, int id) {
    try {
      return jdbc.queryForObject(
          "SELECT libelle FROM " + table + " WHERE id = ? AND actif = TRUE", String.class, id);
    } catch (DataAccessException ex) {
      return null;
    }
  }

  private static void appendReseauScope(
      JdbcTemplate jdbc,
      PilotageAgenceFilterScope scope,
      String agenceAlias,
      StringBuilder sql,
      List<Object> args) {
    if (!scope.zoneIds().isEmpty()) {
      sql.append(" AND (");
      boolean any = false;
      for (int zoneId : scope.zoneIds()) {
        ZoneKeys keys = loadZoneKeys(jdbc, zoneId);
        if (keys == null) {
          continue;
        }
        if (any) {
          sql.append(" OR ");
        }
        any = true;
        appendDimZoneExpr(agenceAlias, sql, args, keys.code(), keys.libelle());
      }
      if (!any) {
        sql.append("1 = 0");
      }
      sql.append(")");
    }
    if (!scope.reseauRegions().isEmpty()) {
      sql.append(" AND (");
      for (int i = 0; i < scope.reseauRegions().size(); i++) {
        if (i > 0) {
          sql.append(" OR ");
        }
        appendDimRegionExpr(agenceAlias, sql, args, scope.reseauRegions().get(i));
      }
      sql.append(")");
    }
  }

  private static void appendLibelleAny(
      JdbcTemplate jdbc,
      String table,
      List<Integer> ids,
      String column,
      StringBuilder sql,
      List<Object> args) {
    List<String> labels = new java.util.ArrayList<>();
    for (int id : ids) {
      String libelle = loadLibelle(jdbc, table, id);
      if (libelle != null && !libelle.isBlank()) {
        labels.add(libelle.trim());
      }
    }
    if (labels.isEmpty()) {
      sql.append(" AND 1 = 0");
      return;
    }
    sql.append(" AND (");
    for (int i = 0; i < labels.size(); i++) {
      if (i > 0) {
        sql.append(" OR ");
      }
      sql.append(folded(column)).append(" = ").append(folded("?"));
      args.add(labels.get(i));
    }
    sql.append(")");
  }

  /**
   * Région sur l'agence elle-même ({@code region_id}) ou via sa zone. Toutes les catégories
   * (CFC, SAG, X, …) sont prises dès qu'elles ont ce rattachement.
   */
  private static void appendDimRegionExpr(
      String agenceAlias, StringBuilder sql, List<Object> args, String region) {
    String same =
        "("
            + folded("dr.libelle")
            + " = "
            + folded("?")
            + " OR "
            + folded("dr.code")
            + " = "
            + folded("?")
            + ")";
    sql.append(" EXISTS (SELECT 1 FROM pilotage.dim_region AS dr WHERE dr.region_id = ")
        .append(agenceAlias)
        .append(".region_id AND dr.region_id <> 0 AND ")
        .append(same)
        .append(")");
    sql.append(" OR EXISTS (SELECT 1 FROM pilotage.dim_zone AS dz")
        .append(" INNER JOIN pilotage.dim_region AS dr ON dr.region_id = dz.region_id")
        .append(" WHERE dz.zone_id = ")
        .append(agenceAlias)
        .append(".zone_id AND dz.zone_id <> 0 AND dr.region_id <> 0 AND ")
        .append(same)
        .append(")");
    for (int i = 0; i < 4; i++) {
      args.add(region);
    }
  }

  /** Zone du référentiel rapprochée de pilotage.dim_zone par code ou libellé normalisé. */
  private static void appendDimZoneExpr(
      String agenceAlias, StringBuilder sql, List<Object> args, String code, String libelle) {
    sql.append("EXISTS (SELECT 1 FROM pilotage.dim_zone AS dz WHERE dz.zone_id = ")
        .append(agenceAlias)
        .append(".zone_id AND dz.zone_id <> 0 AND (")
        .append(folded("dz.code"))
        .append(" = ")
        .append(folded("?"))
        .append(" OR ")
        .append(folded("dz.libelle"))
        .append(" = ")
        .append(folded("?"))
        .append(" OR ")
        .append(folded("dz.libelle"))
        .append(" = ")
        .append(folded("?"))
        .append(" OR ")
        .append(folded("dz.code"))
        .append(" = ")
        .append(folded("?"))
        .append("))");
    args.add(code);
    args.add(libelle);
    args.add(code);
    args.add(libelle);
  }

  /**
   * Mot entier, sans casse, accents ni ponctuation. Les majuscules sont faites avant de retirer
   * la ponctuation, sinon « Kikwit » et « Kinshasa » se réduisent tous les deux à « K ».
   * {@code expr} est une colonne ou {@code ?}.
   */
  private static String folded(String expr) {
    String source = "?".equals(expr) ? "coalesce(?::text, '')" : "coalesce(" + expr + "::text, '')";
    return "regexp_replace(translate(upper(btrim("
        + source
        + ")), 'ÀÁÂÄÃÅÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜÇ', 'AAAAAAEEEEIIIIOOOOOUUUUC'), '[^A-Z0-9]+', '', 'g')";
  }

  private static String foldedLiteral(String value) {
    String safe = value.replace("'", "''");
    return folded("'" + safe + "'");
  }

  private static ZoneKeys loadZoneKeys(JdbcTemplate jdbc, int zoneId) {
    try {
      var rows =
          jdbc.query(
              """
              SELECT code, libelle
              FROM zones
              WHERE id = ? AND actif = TRUE
              """,
              (rs, rowNum) -> new ZoneKeys(rs.getString("code"), rs.getString("libelle")),
              zoneId);
      return rows.isEmpty() ? null : rows.getFirst();
    } catch (DataAccessException ex) {
      return null;
    }
  }

  private static void addLabel(Set<String> labels, String value) {
    if (value == null) {
      return;
    }
    String t = value.trim();
    if (!t.isEmpty()) {
      labels.add(t);
    }
  }

  private record PaysRow(String codeIso, String libelle, String libelleFr, String libelleDefaut) {}

  private record ZoneKeys(String code, String libelle) {}
}
