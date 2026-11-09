package com.flashops.api.pilotage;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PilotageAnalyticsRepository {

  private static final Logger log = LoggerFactory.getLogger(PilotageAnalyticsRepository.class);

  private final JdbcTemplate jdbc;

  public PilotageAnalyticsRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<TotalsRow> loadPeriodTotals(PilotageBundleQuery q) {
    try {
      if (q.couloirOnFact()) {
        return loadFaitTotals(q);
      }
      Grain grain = resolveGrain(q);
      var scoped = PilotageSqlScope.build(jdbc, q, grain.table(), grain.alias(), grain.joinAgence(), grain.agent());
      var nbMontantExpr =
          grain.hasNbMontant()
              ? "coalesce(sum(g.nb_montant), 0)::bigint"
              : "coalesce(sum(g.nb), 0)::bigint";
      var sql =
          new StringBuilder(
              """
              SELECT coalesce(sum(g.nb), 0)::bigint AS nb,
                     """
              + nbMontantExpr
              + """
               AS nb_montant,
                     coalesce(sum(g.montant), 0) AS montant,
              """
                  + commissionSelect(grain.table(), "g")
                  + """
                     ,
                     coalesce(sum(g.nb) FILTER (WHERE g.statut_uniforme = 'Succès'), 0)::bigint AS nb_succes
              """);
      sql.append(scoped.fromAndWhere());
      return Optional.ofNullable(
          jdbc.query(
                  sql.toString(),
                  rs -> {
                    if (!rs.next()) {
                      return null;
                    }
                    return mapTotals(rs);
                  },
                  scoped.args().toArray())
              );
    } catch (DataAccessException ex) {
      log.error("Totaux pilotage indisponibles", ex);
      return Optional.empty();
    }
  }

  public List<TimeseriesRow> loadTimeseries(PilotageBundleQuery q) {
    try {
      if (q.couloirOnFact()) {
        return loadFaitTimeseries(q);
      }
      Grain grain = resolveGrain(q);
      var scoped = PilotageSqlScope.build(jdbc, q, grain.table(), grain.alias(), grain.joinAgence(), grain.agent());
      var sql =
          new StringBuilder(
              """
              SELECT g.jour::text AS jour,
                     coalesce(sum(g.nb), 0)::bigint AS nb,
                     coalesce(sum(g.montant), 0) AS montant
              """);
      sql.append(scoped.fromAndWhere());
      sql.append(" GROUP BY g.jour ORDER BY g.jour");
      return jdbc.query(
          sql.toString(),
          (rs, rowNum) ->
              new TimeseriesRow(rs.getString("jour"), rs.getLong("nb"), rs.getBigDecimal("montant")),
          scoped.args().toArray());
    } catch (DataAccessException ex) {
      return List.of();
    }
  }

  /**
   * Série journalière des N premiers produits (par montant période) pour le graphique « Courbes ».
   */
  public List<ProductTimeseriesRow> loadProductTimeseries(PilotageBundleQuery q, List<Integer> produitIds) {
    if (produitIds == null || produitIds.isEmpty()) {
      return List.of();
    }
    try {
      if (q.couloirOnFact()) {
        return loadFaitProductTimeseries(q, produitIds);
      }
      Grain grain = resolveGrain(q);
      var scoped = PilotageSqlScope.build(jdbc, q, grain.table(), grain.alias(), grain.joinAgence(), grain.agent());
      var fromWhere = scoped.fromAndWhere();
      var joinProduit = " INNER JOIN pilotage.dim_produit AS p ON p.produit_id = g.produit_id";
      String body;
      if (fromWhere.contains(" WHERE 1=1")) {
        body = fromWhere.replace(" WHERE 1=1", joinProduit + " WHERE 1=1");
      } else if (fromWhere.contains(" WHERE p.produit_id <> 0")) {
        body = fromWhere.replace(" WHERE p.produit_id <> 0", joinProduit + " WHERE p.produit_id <> 0");
      } else {
        body = fromWhere + joinProduit;
      }
      body = body + " AND g.produit_id = ANY(?)";
      var domainFilter = new StringBuilder();
      PilotageProductRules.appendDimProduitDomaines(
          "p",
          q.resolvedDomaines(),
          domainFilter,
          q.extraProductKeys(),
          q.transfertRestrictedToExtras());
      body = body + domainFilter;
      var sql =
          new StringBuilder(
              """
              SELECT g.jour::text AS jour,
                     g.produit_id,
                     coalesce(nullif(btrim(p.module), ''), '?') AS module,
                     coalesce(nullif(btrim(p.produit), ''), 'Non renseigné') AS produit,
                     coalesce(nullif(btrim(p.ecran), ''), '') AS ecran,
                     coalesce(nullif(btrim(p.partenaire), ''), '') AS partenaire,
                     coalesce(sum(g.nb), 0)::bigint AS nb,
                     coalesce(sum(g.montant), 0) AS montant
              """);
      sql.append(body);
      sql.append(
          """
           GROUP BY g.jour, g.produit_id, p.module, p.produit, p.ecran, p.partenaire
           ORDER BY g.jour, g.produit_id
          """);
      var args = new ArrayList<>(scoped.args());
      args.add(produitIds.toArray(new Integer[0]));
      return jdbc.query(
          sql.toString(),
          (rs, rowNum) ->
              new ProductTimeseriesRow(
                  rs.getString("jour"),
                  rs.getInt("produit_id"),
                  rs.getString("module"),
                  rs.getString("produit"),
                  rs.getString("ecran"),
                  rs.getString("partenaire"),
                  rs.getLong("nb"),
                  rs.getBigDecimal("montant")),
          args.toArray());
    } catch (DataAccessException ex) {
      log.error("Product timeseries pilotage indisponible", ex);
      return List.of();
    }
  }

  public List<ProductRow> loadProductBreakdown(PilotageBundleQuery q) {
    try {
      if (q.couloirOnFact()) {
        return loadFaitProducts(q);
      }
      Grain grain = resolveGrain(q);
      var scoped = PilotageSqlScope.build(jdbc, q, grain.table(), grain.alias(), grain.joinAgence(), grain.agent());
      var fromWhere = scoped.fromAndWhere();
      var joinProduit = " INNER JOIN pilotage.dim_produit AS p ON p.produit_id = g.produit_id";
      // Le périmètre lieu contient déjà des WHERE dans ses sous-requêtes.
      // La jointure produit se place sur le WHERE principal, pas sur le premier trouvé.
      String body;
      if (fromWhere.contains(" WHERE 1=1")) {
        body = fromWhere.replace(" WHERE 1=1", joinProduit + " WHERE 1=1");
      } else if (fromWhere.contains(" WHERE p.produit_id <> 0")) {
        body = fromWhere.replace(" WHERE p.produit_id <> 0", joinProduit + " WHERE p.produit_id <> 0");
      } else {
        body = fromWhere + joinProduit;
      }
      body = body + " AND g.produit_id <> 0";
      var domainFilter = new StringBuilder();
      PilotageProductRules.appendDimProduitDomaines(
          "p",
          q.resolvedDomaines(),
          domainFilter,
          q.extraProductKeys(),
          q.transfertRestrictedToExtras());
      body = body + domainFilter;
      var sql =
          new StringBuilder(
              """
              SELECT g.produit_id,
                     coalesce(nullif(btrim(p.module), ''), '?') AS module,
                     coalesce(nullif(btrim(p.produit), ''), 'Non renseigné') AS produit,
                     coalesce(nullif(btrim(p.ecran), ''), '') AS ecran,
                     coalesce(nullif(btrim(p.partenaire), ''), '') AS partenaire,
                     coalesce(sum(g.nb), 0)::bigint AS nb,
                     coalesce(sum(g.montant), 0) AS montant
              """);
      sql.append(body);
      sql.append(
          """
           GROUP BY g.produit_id, p.module, p.produit, p.ecran, p.partenaire
           ORDER BY sum(g.montant) DESC, sum(g.nb) DESC
           LIMIT 24
          """);
      return jdbc.query(
          sql.toString(),
          (rs, rowNum) ->
              new ProductRow(
                  rs.getInt("produit_id"),
                  rs.getString("module"),
                  rs.getString("produit"),
                  rs.getString("ecran"),
                  rs.getString("partenaire"),
                  rs.getLong("nb"),
                  rs.getBigDecimal("montant")),
          scoped.args().toArray());
    } catch (DataAccessException ex) {
      log.error("Ventilation produits pilotage indisponible", ex);
      return List.of();
    }
  }

  /** Volume et valeur par mois pour chaque produit du périmètre (sans limite). */
  public List<ProductMonthlyRow> loadProductMonthly(PilotageBundleQuery q) {
    try {
      if (q.couloirOnFact()) {
        return loadFaitProductMonthly(q);
      }
      Grain grain = resolveGrain(q);
      var scoped = PilotageSqlScope.build(jdbc, q, grain.table(), grain.alias(), grain.joinAgence(), grain.agent());
      var fromWhere = scoped.fromAndWhere();
      var joinProduit = " INNER JOIN pilotage.dim_produit AS p ON p.produit_id = g.produit_id";
      String body;
      if (fromWhere.contains(" WHERE 1=1")) {
        body = fromWhere.replace(" WHERE 1=1", joinProduit + " WHERE 1=1");
      } else if (fromWhere.contains(" WHERE p.produit_id <> 0")) {
        body = fromWhere.replace(" WHERE p.produit_id <> 0", joinProduit + " WHERE p.produit_id <> 0");
      } else {
        body = fromWhere + joinProduit;
      }
      body = body + " AND g.produit_id <> 0";
      var domainFilter = new StringBuilder();
      PilotageProductRules.appendDimProduitDomaines(
          "p",
          q.resolvedDomaines(),
          domainFilter,
          q.extraProductKeys(),
          q.transfertRestrictedToExtras());
      body = body + domainFilter;
      var sql =
          new StringBuilder(
              """
              SELECT to_char(date_trunc('month', g.jour::date), 'YYYY-MM') AS mois,
                     g.produit_id,
                     coalesce(nullif(btrim(p.module), ''), '?') AS module,
                     coalesce(nullif(btrim(p.produit), ''), 'Non renseigné') AS produit,
                     coalesce(nullif(btrim(p.ecran), ''), '') AS ecran,
                     coalesce(nullif(btrim(p.partenaire), ''), '') AS partenaire,
                     coalesce(sum(g.nb), 0)::bigint AS nb,
                     coalesce(sum(g.montant), 0) AS montant
              """);
      sql.append(body);
      sql.append(
          """
           GROUP BY 1, g.produit_id, p.module, p.produit, p.ecran, p.partenaire
           ORDER BY 1, sum(g.montant) DESC, sum(g.nb) DESC
          """);
      return jdbc.query(
          sql.toString(),
          (rs, rowNum) ->
              new ProductMonthlyRow(
                  rs.getString("mois"),
                  rs.getInt("produit_id"),
                  rs.getString("module"),
                  rs.getString("produit"),
                  rs.getString("ecran"),
                  rs.getString("partenaire"),
                  rs.getLong("nb"),
                  rs.getBigDecimal("montant")),
          scoped.args().toArray());
    } catch (DataAccessException ex) {
      log.error("Ventilation mensuelle produits indisponible", ex);
      return List.of();
    }
  }

  public Optional<MonthCompareRow> loadMonthCompare(PilotageBundleQuery q, String moisIso) {
    try {
      if (q.hasCouloir()) {
        var start = java.time.LocalDate.parse(moisIso);
        var end = start.withDayOfMonth(start.lengthOfMonth());
        return loadPeriodTotals(q.withPeriod(start.toString(), end.toString()))
            .map(t -> new MonthCompareRow(t.nb(), t.montant()));
      }
      var scoped = PilotageSqlScope.buildSingleMonth(q, moisIso);
      var sql =
          new StringBuilder(
              """
              SELECT coalesce(sum(g.nb), 0)::bigint AS nb,
                     coalesce(sum(g.montant), 0) AS montant
              """);
      sql.append(scoped.fromAndWhere());
      var args = new ArrayList<>(scoped.args());
      return Optional.ofNullable(
          jdbc.query(
              sql.toString(),
              rs -> {
                if (!rs.next()) {
                  return null;
                }
                return new MonthCompareRow(rs.getLong("nb"), rs.getBigDecimal("montant"));
              },
              args.toArray()));
    } catch (DataAccessException ex) {
      return Optional.empty();
    }
  }

  private Optional<TotalsRow> loadFaitTotals(PilotageBundleQuery q) {
    var scoped = PilotageSqlScope.buildFait(jdbc, q);
    var sql =
        """
        SELECT count(*)::bigint AS nb,
               count(*) FILTER (WHERE f.montant IS NOT NULL)::bigint AS nb_montant,
               coalesce(sum(f.montant), 0) AS montant,
        """
            + commissionSelect("pilotage.fait_operation", "f")
            + """
               ,
               count(*) FILTER (WHERE s.statut_uniforme = 'Succès')::bigint AS nb_succes
        """
            + scoped.fromAndWhere();
    return Optional.ofNullable(
        jdbc.query(
            sql,
            rs -> {
              if (!rs.next()) {
                return null;
              }
              return mapTotals(rs);
            },
            scoped.args().toArray()));
  }

  private List<TimeseriesRow> loadFaitTimeseries(PilotageBundleQuery q) {
    var scoped = PilotageSqlScope.buildFait(jdbc, q);
    var sql =
        """
        SELECT d.jour::text AS jour,
               count(*)::bigint AS nb,
               coalesce(sum(f.montant), 0) AS montant
        """
            + scoped.fromAndWhere()
            + " GROUP BY d.jour ORDER BY d.jour";
    return jdbc.query(
        sql,
        (rs, rowNum) ->
            new TimeseriesRow(rs.getString("jour"), rs.getLong("nb"), rs.getBigDecimal("montant")),
        scoped.args().toArray());
  }

  private List<ProductTimeseriesRow> loadFaitProductTimeseries(
      PilotageBundleQuery q, List<Integer> produitIds) {
    var scoped = PilotageSqlScope.buildFait(jdbc, q);
    var sql =
        """
        SELECT d.jour::text AS jour,
               f.produit_id,
               coalesce(nullif(btrim(p.module), ''), '?') AS module,
               coalesce(nullif(btrim(p.produit), ''), 'Non renseigné') AS produit,
               coalesce(nullif(btrim(p.ecran), ''), '') AS ecran,
               coalesce(nullif(btrim(p.partenaire), ''), '') AS partenaire,
               count(*)::bigint AS nb,
               coalesce(sum(f.montant), 0) AS montant
        """
            + scoped.fromAndWhere()
            + """
             AND f.produit_id = ANY(?)
             GROUP BY d.jour, f.produit_id, p.module, p.produit, p.ecran, p.partenaire
             ORDER BY d.jour, f.produit_id
            """;
    var args = new ArrayList<>(scoped.args());
    args.add(produitIds.toArray(new Integer[0]));
    return jdbc.query(
        sql,
        (rs, rowNum) ->
            new ProductTimeseriesRow(
                rs.getString("jour"),
                rs.getInt("produit_id"),
                rs.getString("module"),
                rs.getString("produit"),
                rs.getString("ecran"),
                rs.getString("partenaire"),
                rs.getLong("nb"),
                rs.getBigDecimal("montant")),
        args.toArray());
  }

  private List<ProductMonthlyRow> loadFaitProductMonthly(PilotageBundleQuery q) {
    var scoped = PilotageSqlScope.buildFait(jdbc, q);
    var sql =
        """
        SELECT to_char(date_trunc('month', d.jour::date), 'YYYY-MM') AS mois,
               f.produit_id,
               coalesce(nullif(btrim(p.module), ''), '?') AS module,
               coalesce(nullif(btrim(p.produit), ''), 'Non renseigné') AS produit,
               coalesce(nullif(btrim(p.ecran), ''), '') AS ecran,
               coalesce(nullif(btrim(p.partenaire), ''), '') AS partenaire,
               count(*)::bigint AS nb,
               coalesce(sum(f.montant), 0) AS montant
        """
            + scoped.fromAndWhere()
            + """
             GROUP BY 1, f.produit_id, p.module, p.produit, p.ecran, p.partenaire
             ORDER BY 1, sum(f.montant) DESC, count(*) DESC
            """;
    return jdbc.query(
        sql,
        (rs, rowNum) ->
            new ProductMonthlyRow(
                rs.getString("mois"),
                rs.getInt("produit_id"),
                rs.getString("module"),
                rs.getString("produit"),
                rs.getString("ecran"),
                rs.getString("partenaire"),
                rs.getLong("nb"),
                rs.getBigDecimal("montant")),
        scoped.args().toArray());
  }

  private List<ProductRow> loadFaitProducts(PilotageBundleQuery q) {
    var scoped = PilotageSqlScope.buildFait(jdbc, q);
    var sql =
        """
        SELECT f.produit_id,
               coalesce(nullif(btrim(p.module), ''), '?') AS module,
               coalesce(nullif(btrim(p.produit), ''), 'Non renseigné') AS produit,
               coalesce(nullif(btrim(p.ecran), ''), '') AS ecran,
               coalesce(nullif(btrim(p.partenaire), ''), '') AS partenaire,
               count(*)::bigint AS nb,
               coalesce(sum(f.montant), 0) AS montant
        """
            + scoped.fromAndWhere()
            + """
             GROUP BY f.produit_id, p.module, p.produit, p.ecran, p.partenaire
             ORDER BY sum(f.montant) DESC, count(*) DESC
             LIMIT 24
            """;
    return jdbc.query(
        sql,
        (rs, rowNum) ->
            new ProductRow(
                rs.getInt("produit_id"),
                rs.getString("module"),
                rs.getString("produit"),
                rs.getString("ecran"),
                rs.getString("partenaire"),
                rs.getLong("nb"),
                rs.getBigDecimal("montant")),
        scoped.args().toArray());
  }

  public LignesExport loadLignes(PilotageBundleQuery q, int limit) {
    int cap = Math.min(Math.max(limit, 1), 20000);
    try {
      var scoped = PilotageSqlScope.buildLignes(jdbc, q);
      var sql =
          """
          SELECT coalesce(nullif(btrim(ag.nom), ''), coalesce(nullif(btrim(ag.code_agence), ''), '')) AS agence,
                 coalesce(nullif(btrim(ag.code_agence), ''), '') AS code_agence,
                 coalesce(nullif(btrim(ag.pos_id), ''), '') AS pos_id,
                 coalesce(nullif(btrim(f.expediteur), ''), '') AS expediteur,
                 coalesce(nullif(btrim(f.beneficiaire), ''), '') AS beneficiaire,
                 coalesce(nullif(btrim(f.telephone), ''), '') AS telephone,
                 coalesce(nullif(btrim(f.telephone_expediteur), ''), '') AS telephone_expediteur,
                 coalesce(nullif(btrim(f.reference), ''), nullif(btrim(f.source_id), ''), '') AS numero,
                 d.jour::text AS jour,
                 f.montant,
                 coalesce(s.statut_uniforme, '') AS statut
          """
              + scoped.fromAndWhere()
              + """
               AND f.agence_id <> 0
               ORDER BY ag.nom, ag.code_agence, d.jour, f.operation_id
               LIMIT ?
              """;
      var args = new ArrayList<>(scoped.args());
      args.add(cap + 1);
      var rows = jdbc.query(sql, this::mapLigne, args.toArray());
      boolean truncated = rows.size() > cap;
      if (truncated) {
        rows = rows.subList(0, cap);
      }
      return new LignesExport(rows, truncated, cap);
    } catch (DataAccessException ex) {
      log.error("Lignes pilotage indisponibles", ex);
      return new LignesExport(List.of(), false, cap);
    }
  }

  public Optional<AgenceFicheRow> loadAgenceFiche(int agenceId) {
    var sql =
        """
        SELECT d.agence_id,
               coalesce(nullif(btrim(d.code_agence), ''), '') AS code_agence,
               coalesce(nullif(btrim(d.nom), ''), '') AS nom,
               coalesce(nullif(btrim(d.categorie), ''), '') AS categorie,
               coalesce(nullif(btrim(d.pos_id), ''), '') AS pos_id,
               coalesce(nullif(nullif(btrim(rg.libelle), ''), 'Non renseigné'), '') AS region,
               coalesce(nullif(nullif(btrim(zn.libelle), ''), 'Non renseigné'), '') AS zone,
               coalesce(nullif(btrim(d.ville), ''), '') AS ville,
               coalesce(nullif(btrim(d.commune), ''), '') AS commune,
               coalesce(nullif(btrim(d.province), ''), '') AS province,
               coalesce(nullif(btrim(d.pays), ''), '') AS pays,
               d.latitude,
               d.longitude
        FROM pilotage.dim_agence AS d
        LEFT JOIN pilotage.dim_region AS rg ON rg.region_id = d.region_id
        LEFT JOIN pilotage.dim_zone AS zn ON zn.zone_id = d.zone_id
        WHERE d.agence_id = ?
          AND d.agence_id <> 0
        """;
    return jdbc.query(sql, this::mapAgenceFiche, agenceId).stream().findFirst();
  }

  /**
   * Transactions d’une agence dans le périmètre du tableau de bord. La moyenne porte sur tout le
   * périmètre, pas seulement la page.
   */
  public AgenceTransactions loadAgenceTransactions(
      PilotageBundleQuery q, int agenceId, int page, int size, String partyQuery) {
    return loadAgenceTransactions(q, agenceId, page, size, partyQuery, false);
  }

  public AgenceTransactions loadAgenceTransactions(
      PilotageBundleQuery q,
      int agenceId,
      int page,
      int size,
      String partyQuery,
      boolean exportAll) {
    int safeSize = Math.min(Math.max(size, 1), exportAll ? 5_000 : 50);
    int safePage = Math.max(page, 1);
    long offset = (long) (safePage - 1) * safeSize;
    if (offset > 200_000L) {
      safePage = (int) (200_000L / safeSize) + 1;
      offset = (long) (safePage - 1) * safeSize;
    }
    var scoped = PilotageSqlScope.buildLignes(jdbc, q);
    String scope = scoped.fromAndWhere() + " AND f.agence_id = ?";
    var args = new ArrayList<>(scoped.args());
    args.add(agenceId);
    String party = partyQuery == null ? "" : partyQuery.trim();
    if (!party.isEmpty()) {
      scope += " AND (f.expediteur ILIKE ? OR f.beneficiaire ILIKE ?)";
      String like = "%" + party.replace("%", "").replace("_", "") + "%";
      args.add(like);
      args.add(like);
    }
    var stats =
        jdbc.queryForObject(
            "SELECT count(*)::bigint AS total,"
                + " coalesce(avg(f.montant), 0) AS moyenne,"
                + " coalesce(sum(f.montant), 0) AS montant_total "
                + scope,
            (rs, rowNum) ->
                new AgenceTxStats(
                    rs.getLong("total"), rs.getBigDecimal("moyenne"), rs.getBigDecimal("montant_total")),
            args.toArray());
    var sql =
        """
        SELECT f.operation_id,
               d.jour::text AS jour,
               coalesce(
                 to_char(f.date_operation, 'HH24:MI'),
                 CASE
                   WHEN f.heure IS NULL THEN NULL
                   ELSE lpad(f.heure::text, 2, '0') || ':00'
                 END
               ) AS heure,
               coalesce(nullif(btrim(p.produit), ''), '') AS produit,
               coalesce(nullif(btrim(p.ecran), ''), '') AS ecran,
               coalesce(nullif(btrim(agent.nom), ''), '') AS operateur,
               coalesce(nullif(btrim(f.expediteur), ''), '') AS expediteur,
               coalesce(nullif(btrim(f.beneficiaire), ''), '') AS beneficiaire,
               coalesce(s.statut_uniforme, '') AS statut,
               f.montant
        """
            + scope.replace(
                " FROM pilotage.fait_operation AS f",
                " FROM pilotage.fait_operation AS f"
                    + " LEFT JOIN pilotage.dim_agent AS agent ON agent.agent_id = f.agent_id")
            + """
             ORDER BY d.jour DESC, coalesce(f.date_operation, d.jour::timestamp) DESC, f.operation_id DESC
             LIMIT ? OFFSET ?
            """;
    var pageArgs = new ArrayList<>(args);
    pageArgs.add(safeSize);
    pageArgs.add((int) offset);
    var rows = jdbc.query(sql, this::mapAgenceTransaction, pageArgs.toArray());
    long total = stats == null ? 0L : stats.total();
    BigDecimal moyenne = stats == null || stats.moyenne() == null ? BigDecimal.ZERO : stats.moyenne();
    BigDecimal montantTotal =
        stats == null || stats.montantTotal() == null ? BigDecimal.ZERO : stats.montantTotal();
    return new AgenceTransactions(total, safePage, safeSize, moyenne, montantTotal, rows);
  }

  public List<AgenceRankRow> loadTopAgences(PilotageBundleQuery q, int limit) {
    return loadTopAgences(q, limit, false);
  }

  /** Toutes les agences avec coordonnées, éventuellement bornées au périmètre user. */
  public List<AgenceGeoRow> loadAllLocatedAgences(List<Integer> restrictAgenceIds) {
    if (restrictAgenceIds != null && restrictAgenceIds.isEmpty()) {
      return List.of();
    }
    try {
      var sql =
          new StringBuilder(
              """
              SELECT d.agence_id,
                     coalesce(nullif(btrim(d.code_agence), ''), '') AS code_agence,
                     coalesce(nullif(btrim(d.nom), ''), '') AS nom,
                     d.latitude,
                     d.longitude,
                     0::bigint AS nb,
                     0::numeric AS montant
              FROM pilotage.dim_agence AS d
              WHERE d.agence_id <> 0
                AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
                AND d.latitude <> 0 AND d.longitude <> 0
              """);
      var args = new ArrayList<Object>();
      if (restrictAgenceIds != null) {
        sql.append(" AND d.agence_id = ANY(?)");
        args.add(restrictAgenceIds.toArray(new Integer[0]));
      }
      sql.append(" ORDER BY d.nom, d.code_agence LIMIT 5000");
      return jdbc.query(sql.toString(), this::mapAgenceGeo, args.toArray());
    } catch (DataAccessException ex) {
      log.error("Geo all agences indisponible", ex);
      return List.of();
    }
  }

  /**
   * Agences du périmètre avec coordonnées valides (carte). Tri montant DESC, plafond {@code limit}.
   */
  public List<AgenceGeoRow> loadGeoAgences(PilotageBundleQuery q, int limit) {
    int cap = Math.min(Math.max(limit, 1), 2000);
    try {
      if (q.couloirOnFact()) {
        return loadFaitGeoAgences(q, cap);
      }
      return loadGrainGeoAgences(q, cap);
    } catch (DataAccessException ex) {
      log.error("Geo agences pilotage indisponible", ex);
      return List.of();
    }
  }

  private List<AgenceGeoRow> loadGrainGeoAgences(PilotageBundleQuery q, int limit) {
    Grain grain = resolveAgenceRankGrain(q);
    var scoped =
        PilotageSqlScope.build(jdbc, q, grain.table(), grain.alias(), true, grain.agent());
    String grouped =
        withAgenceGeo(scoped.fromAndWhere(), "d")
            + """
             AND g.agence_id <> 0
             AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
             AND d.latitude <> 0 AND d.longitude <> 0
             GROUP BY g.agence_id, d.code_agence, d.nom, d.latitude, d.longitude
            """;
    var sql =
        """
        SELECT g.agence_id,
               coalesce(nullif(btrim(d.code_agence), ''), '') AS code_agence,
               coalesce(nullif(btrim(d.nom), ''), '') AS nom,
               d.latitude,
               d.longitude,
               coalesce(sum(g.nb), 0)::bigint AS nb,
               coalesce(sum(g.montant), 0) AS montant
        """
            + grouped
            + """
             ORDER BY sum(g.montant) DESC, sum(g.nb) DESC
             LIMIT ?
            """;
    var args = new ArrayList<>(scoped.args());
    args.add(limit);
    return jdbc.query(sql, this::mapAgenceGeo, args.toArray());
  }

  private List<AgenceGeoRow> loadFaitGeoAgences(PilotageBundleQuery q, int limit) {
    var scoped = PilotageSqlScope.buildFait(jdbc, q);
    String from = scoped.fromAndWhere();
    if (scoped.agenceAlias() == null) {
      from =
          from.replaceFirst(
              " WHERE ",
              " INNER JOIN pilotage.dim_agence AS ag ON ag.agence_id = f.agence_id WHERE ");
    }
    String ag = scoped.agenceAlias() != null ? scoped.agenceAlias() : "ag";
    String grouped =
        from
            + " AND f.agence_id <> 0"
            + " AND "
            + ag
            + ".latitude IS NOT NULL AND "
            + ag
            + ".longitude IS NOT NULL"
            + " AND "
            + ag
            + ".latitude <> 0 AND "
            + ag
            + ".longitude <> 0"
            + " GROUP BY f.agence_id, "
            + ag
            + ".code_agence, "
            + ag
            + ".nom, "
            + ag
            + ".latitude, "
            + ag
            + ".longitude";
    var sql =
        "SELECT f.agence_id,"
            + " coalesce(nullif(btrim("
            + ag
            + ".code_agence), ''), '') AS code_agence,"
            + " coalesce(nullif(btrim("
            + ag
            + ".nom), ''), '') AS nom,"
            + " "
            + ag
            + ".latitude,"
            + " "
            + ag
            + ".longitude,"
            + " count(*)::bigint AS nb,"
            + " coalesce(sum(f.montant), 0) AS montant"
            + grouped
            + " ORDER BY sum(f.montant) DESC, count(*) DESC LIMIT ?";
    var args = new ArrayList<>(scoped.args());
    args.add(limit);
    return jdbc.query(sql, this::mapAgenceGeo, args.toArray());
  }

  private AgenceGeoRow mapAgenceGeo(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
    Double lat = coord(rs, "latitude");
    Double lng = coord(rs, "longitude");
    return new AgenceGeoRow(
        rs.getInt("agence_id"),
        rs.getString("code_agence"),
        rs.getString("nom"),
        lat == null ? 0d : lat,
        lng == null ? 0d : lng,
        rs.getLong("nb"),
        rs.getBigDecimal("montant"));
  }

  /** Bundle / export : LIMIT seul, sans count (peut aller jusqu’à 5 000). */
  public List<AgenceRankRow> loadTopAgences(PilotageBundleQuery q, int limit, boolean worst) {
    int cap = Math.min(Math.max(limit, 1), 5000);
    try {
      if (q.couloirOnFact()) {
        return loadFaitTopAgences(q, cap, 0, worst, false).rows();
      }
      return loadGrainTopAgences(q, cap, 0, worst, false).rows();
    } catch (DataAccessException ex) {
      log.error("Top agences pilotage indisponible", ex);
      return List.of();
    }
  }

  /** Classement UI : page SQL + total (size plafonné à 50). */
  public AgenceClassement loadTopAgencesPage(
      PilotageBundleQuery q, int page, int size, boolean worst) {
    int safeSize = Math.min(Math.max(size, 1), 50);
    int safePage = Math.max(page, 1);
    long offset = (long) (safePage - 1) * safeSize;
    if (offset > 200_000L) {
      safePage = (int) (200_000L / safeSize) + 1;
      offset = (long) (safePage - 1) * safeSize;
    }
    try {
      if (q.couloirOnFact()) {
        return loadFaitTopAgences(q, safeSize, (int) offset, worst, true)
            .withPage(safePage, safeSize);
      }
      return loadGrainTopAgences(q, safeSize, (int) offset, worst, true)
          .withPage(safePage, safeSize);
    } catch (DataAccessException ex) {
      log.error("Top agences pilotage indisponible", ex);
      return new AgenceClassement(0, safePage, safeSize, List.of());
    }
  }

  private AgenceClassement loadGrainTopAgences(
      PilotageBundleQuery q, int limit, int offset, boolean worst, boolean withTotal) {
    String order =
        worst
            ? " ORDER BY sum(g.montant) ASC, sum(g.nb) ASC "
            : " ORDER BY sum(g.montant) DESC, sum(g.nb) DESC ";
    Grain grain = resolveAgenceRankGrain(q);
    var scoped =
        PilotageSqlScope.build(jdbc, q, grain.table(), grain.alias(), true, grain.agent());
    String grouped =
        withAgenceGeo(scoped.fromAndWhere(), "d")
            + """
             AND g.agence_id <> 0
             GROUP BY g.agence_id, d.code_agence, d.nom, d.categorie, d.pos_id, rg.libelle, zn.libelle
            """;
    long total = 0L;
    if (withTotal) {
      Long counted =
          jdbc.queryForObject(
              "SELECT count(*)::bigint FROM (SELECT g.agence_id " + grouped + ") t",
              Long.class,
              scoped.args().toArray());
      total = counted == null ? 0L : counted;
    }
    var sql =
        """
        SELECT g.agence_id,
               coalesce(nullif(btrim(d.code_agence), ''), '') AS code_agence,
               coalesce(nullif(btrim(d.nom), ''), '') AS nom,
               coalesce(nullif(btrim(d.categorie), ''), '') AS categorie,
               coalesce(nullif(btrim(d.pos_id), ''), '') AS pos_id,
        """
            + AGENCE_GEO_SELECT
            + """
               coalesce(sum(g.nb), 0)::bigint AS nb,
               coalesce(sum(g.montant), 0) AS montant,
        """
            + commissionSelect(grain.table(), "g")
            + grouped
            + order
            + """
             LIMIT ? OFFSET ?
            """;
    var args = new ArrayList<>(scoped.args());
    args.add(limit);
    args.add(offset);
    var rows = jdbc.query(sql, this::mapAgenceRank, args.toArray());
    return new AgenceClassement(total, 1, limit, rows);
  }

  private AgenceClassement loadFaitTopAgences(
      PilotageBundleQuery q, int limit, int offset, boolean worst, boolean withTotal) {
    String order =
        worst
            ? " ORDER BY sum(f.montant) ASC, count(*) ASC "
            : " ORDER BY sum(f.montant) DESC, count(*) DESC ";
    var scoped = PilotageSqlScope.buildFait(jdbc, q);
    String from = scoped.fromAndWhere();
    if (scoped.agenceAlias() == null) {
      from =
          from.replaceFirst(
              " WHERE ",
              " INNER JOIN pilotage.dim_agence AS ag ON ag.agence_id = f.agence_id WHERE ");
    }
    from = withAgenceGeo(from, "ag");
    String grouped =
        from
            + """
             AND f.agence_id <> 0
             GROUP BY f.agence_id, ag.code_agence, ag.nom, ag.categorie, ag.pos_id, rg.libelle, zn.libelle
            """;
    long total = 0L;
    if (withTotal) {
      Long counted =
          jdbc.queryForObject(
              "SELECT count(*)::bigint FROM (SELECT f.agence_id " + grouped + ") t",
              Long.class,
              scoped.args().toArray());
      total = counted == null ? 0L : counted;
    }
    var sql =
        """
        SELECT f.agence_id,
               coalesce(nullif(btrim(ag.code_agence), ''), '') AS code_agence,
               coalesce(nullif(btrim(ag.nom), ''), '') AS nom,
               coalesce(nullif(btrim(ag.categorie), ''), '') AS categorie,
               coalesce(nullif(btrim(ag.pos_id), ''), '') AS pos_id,
        """
            + AGENCE_GEO_SELECT
            + """
               count(*)::bigint AS nb,
               coalesce(sum(f.montant), 0) AS montant,
        """
            + commissionSelect("pilotage.fait_operation", "f")
            + grouped
            + order
            + """
             LIMIT ? OFFSET ?
            """;
    var args = new ArrayList<>(scoped.args());
    args.add(limit);
    args.add(offset);
    var rows = jdbc.query(sql, this::mapAgenceRank, args.toArray());
    return new AgenceClassement(total, 1, limit, rows);
  }

  private LigneExportRow mapLigne(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
    String expediteur = rs.getString("expediteur");
    String beneficiaire = rs.getString("beneficiaire");
    String nom = expediteur != null && !expediteur.isBlank() ? expediteur : beneficiaire;
    return new LigneExportRow(
        rs.getString("agence"),
        rs.getString("code_agence"),
        rs.getString("pos_id"),
        nom == null ? "" : nom,
        expediteur == null ? "" : expediteur,
        beneficiaire == null ? "" : beneficiaire,
        rs.getString("telephone"),
        rs.getString("telephone_expediteur"),
        rs.getString("numero"),
        rs.getString("jour"),
        rs.getBigDecimal("montant"),
        rs.getString("statut"));
  }

  private AgenceFicheRow mapAgenceFiche(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
    return new AgenceFicheRow(
        rs.getInt("agence_id"),
        rs.getString("code_agence"),
        rs.getString("nom"),
        rs.getString("categorie"),
        rs.getString("pos_id"),
        rs.getString("region"),
        rs.getString("zone"),
        rs.getString("ville"),
        rs.getString("commune"),
        rs.getString("province"),
        rs.getString("pays"),
        coord(rs, "latitude"),
        coord(rs, "longitude"));
  }

  private AgenceTransactionRow mapAgenceTransaction(java.sql.ResultSet rs, int rowNum)
      throws java.sql.SQLException {
    String heure = rs.getString("heure");
    String expediteur = rs.getString("expediteur");
    String beneficiaire = rs.getString("beneficiaire");
    String ecran = rs.getString("ecran");
    String operateur = rs.getString("operateur");
    return new AgenceTransactionRow(
        rs.getLong("operation_id"),
        rs.getString("jour"),
        heure == null ? "" : heure,
        rs.getString("produit"),
        ecran == null ? "" : ecran,
        operateur == null ? "" : operateur,
        expediteur == null ? "" : expediteur,
        beneficiaire == null ? "" : beneficiaire,
        rs.getString("statut"),
        rs.getBigDecimal("montant"));
  }

  private static Double coord(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
    BigDecimal value = rs.getBigDecimal(column);
    if (value == null || value.signum() == 0) {
      return null;
    }
    double n = value.doubleValue();
    return Double.isFinite(n) ? n : null;
  }

  private AgenceRankRow mapAgenceRank(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
    return new AgenceRankRow(
        rs.getInt("agence_id"),
        rs.getString("code_agence"),
        rs.getString("nom"),
        rs.getString("categorie"),
        rs.getString("pos_id"),
        rs.getString("region"),
        rs.getString("zone"),
        rs.getLong("nb"),
        money(rs, "montant"),
        money(rs, "commission"),
        money(rs, "commission_fcn"),
        money(rs, "commission_agent"),
        money(rs, "commission_fcn_agent"));
  }

  private static TotalsRow mapTotals(java.sql.ResultSet rs) throws java.sql.SQLException {
    return new TotalsRow(
        rs.getLong("nb"),
        rs.getLong("nb_montant"),
        money(rs, "montant"),
        rs.getLong("nb_succes"),
        money(rs, "commission"),
        money(rs, "commission_fcn"),
        money(rs, "commission_agent"),
        money(rs, "commission_fcn_agent"));
  }

  /**
   * Sommes commissions selon le grain : l’agrégat agent n’a que {@code commission_agent},
   * le couloir n’a pas {@code commission_fcn_agent}.
   */
  private static String commissionSelect(String table, String alias) {
    String t = table == null ? "" : table;
    if (t.contains("agg_agent_jour")) {
      return """
          0::numeric AS commission,
          0::numeric AS commission_fcn,
          coalesce(sum(%s.commission_agent), 0) AS commission_agent,
          0::numeric AS commission_fcn_agent
          """
          .formatted(alias);
    }
    if (t.contains("agg_couloir_jour")) {
      return """
          coalesce(sum(%s.commission), 0) AS commission,
          coalesce(sum(%s.commission_fcn), 0) AS commission_fcn,
          coalesce(sum(%s.commission_agent), 0) AS commission_agent,
          0::numeric AS commission_fcn_agent
          """
          .formatted(alias, alias, alias);
    }
    return """
        coalesce(sum(%s.commission), 0) AS commission,
        coalesce(sum(%s.commission_fcn), 0) AS commission_fcn,
        coalesce(sum(%s.commission_agent), 0) AS commission_agent,
        coalesce(sum(%s.commission_fcn_agent), 0) AS commission_fcn_agent
        """
        .formatted(alias, alias, alias, alias);
  }

  private static BigDecimal money(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
    BigDecimal value = rs.getBigDecimal(column);
    return value == null ? BigDecimal.ZERO : value;
  }

  private static String withAgenceGeo(String from, String agenceAlias) {
    String joins =
        " LEFT JOIN pilotage.dim_region AS rg ON rg.region_id = "
            + agenceAlias
            + ".region_id"
            + " LEFT JOIN pilotage.dim_zone AS zn ON zn.zone_id = "
            + agenceAlias
            + ".zone_id";
    if (from.contains(" WHERE 1=1")) {
      return from.replace(" WHERE 1=1", joins + " WHERE 1=1");
    }
    if (from.contains(" WHERE p.produit_id <> 0")) {
      return from.replace(" WHERE p.produit_id <> 0", joins + " WHERE p.produit_id <> 0");
    }
    return from.replaceFirst(" WHERE ", joins + " WHERE ");
  }

  private static Grain resolveAgenceRankGrain(PilotageBundleQuery q) {
    if (q.couloirOnAggregate()) {
      return new Grain("pilotage.agg_couloir_jour", "g", true, false, false);
    }
    if (q.usesAgentGrain()) {
      return new Grain("pilotage.agg_agent_jour", "g", true, true, false);
    }
    return new Grain("pilotage.agg_operation_agence_jour", "g", true, false, true);
  }

  private static Grain resolveGrain(PilotageBundleQuery q) {
    if (q.couloirOnAggregate()) {
      return new Grain("pilotage.agg_couloir_jour", "g", q.usesAgenceGrain(), false, false);
    }
    if (q.usesAgentGrain()) {
      return new Grain("pilotage.agg_agent_jour", "g", true, true, false);
    }
    if (q.usesAgenceGrain()) {
      return new Grain("pilotage.agg_operation_agence_jour", "g", true, false, true);
    }
    return new Grain("pilotage.agg_operation_jour", "g", false, false, true);
  }

  /**
   * Commission WU des agences SAG WU uniquement ({@code dim_agence.categorie} contient « SAG » et
   * « WU »). 0 s’il n’y en a pas dans le périmètre.
   */
  public BigDecimal loadSagWuCommission(PilotageBundleQuery q) {
    try {
      if (q.couloirOnFact() || q.usesAgentGrain()) {
        return loadFaitSagWuCommission(q);
      }
      Grain grain = resolveAgenceRankGrain(q);
      if (grain.agent() || !tableHasCommission(grain.table())) {
        return BigDecimal.ZERO;
      }
      var scoped =
          PilotageSqlScope.build(jdbc, q, grain.table(), grain.alias(), true, grain.agent());
      var sql =
          "SELECT coalesce(sum("
              + grain.alias()
              + ".commission) FILTER (WHERE "
              + sagWuPredicate("d")
              + "), 0) AS commission"
              + scoped.fromAndWhere();
      BigDecimal value =
          jdbc.query(
              sql,
              rs -> rs.next() ? rs.getBigDecimal("commission") : BigDecimal.ZERO,
              scoped.args().toArray());
      return value == null ? BigDecimal.ZERO : value;
    } catch (DataAccessException ex) {
      log.error("Commission SAG WU indisponible", ex);
      return BigDecimal.ZERO;
    }
  }

  private BigDecimal loadFaitSagWuCommission(PilotageBundleQuery q) {
    var scoped = PilotageSqlScope.buildFait(jdbc, q);
    String from = scoped.fromAndWhere();
    String agenceAlias = scoped.agenceAlias();
    if (agenceAlias == null) {
      from =
          from.replaceFirst(
              " WHERE ",
              " INNER JOIN pilotage.dim_agence AS ag ON ag.agence_id = f.agence_id WHERE ");
      agenceAlias = "ag";
    }
    var sql =
        "SELECT coalesce(sum(f.commission) FILTER (WHERE "
            + sagWuPredicate(agenceAlias)
            + "), 0) AS commission"
            + from;
    BigDecimal value =
        jdbc.query(
            sql,
            rs -> rs.next() ? rs.getBigDecimal("commission") : BigDecimal.ZERO,
            scoped.args().toArray());
    return value == null ? BigDecimal.ZERO : value;
  }

  /** Catégorie commerciale « SAG WU » (ex. {@code SAG WU}). */
  static String sagWuPredicate(String agenceAlias) {
    return "upper(btrim(" + agenceAlias + ".categorie)) LIKE '%SAG%WU%'";
  }

  private static boolean tableHasCommission(String table) {
    String t = table == null ? "" : table;
    return !t.contains("agg_agent_jour");
  }

  /** Totaux agent : pas de nb_montant — on retombe sur nb pour le ticket. */
  public record TotalsRow(
      long nb,
      long nbMontant,
      BigDecimal montant,
      long nbSucces,
      BigDecimal commission,
      BigDecimal commissionFcn,
      BigDecimal commissionAgent,
      BigDecimal commissionFcnAgent) {
    TotalsRow withCommission(BigDecimal next) {
      return new TotalsRow(
          nb,
          nbMontant,
          montant,
          nbSucces,
          next == null ? BigDecimal.ZERO : next,
          commissionFcn,
          commissionAgent,
          commissionFcnAgent);
    }
  }

  public record TimeseriesRow(String jour, long nb, BigDecimal montant) {}

  public record ProductTimeseriesRow(
      String jour,
      int produitId,
      String module,
      String produit,
      String ecran,
      String partenaire,
      long nb,
      BigDecimal montant) {}

  public record ProductRow(
      int produitId,
      String module,
      String produit,
      String ecran,
      String partenaire,
      long nb,
      BigDecimal montant) {}

  public record ProductMonthlyRow(
      String mois,
      int produitId,
      String module,
      String produit,
      String ecran,
      String partenaire,
      long nb,
      BigDecimal montant) {}

  public record MonthCompareRow(long nb, BigDecimal montant) {}

  private static final String AGENCE_GEO_SELECT =
      """
         coalesce(nullif(nullif(btrim(rg.libelle), ''), 'Non renseigné'), '') AS region,
         coalesce(nullif(nullif(btrim(zn.libelle), ''), 'Non renseigné'), '') AS zone,
      """;

  public record AgenceFicheRow(
      int agenceId,
      String codeAgence,
      String nom,
      String categorie,
      String posId,
      String region,
      String zone,
      String ville,
      String commune,
      String province,
      String pays,
      Double latitude,
      Double longitude) {}

  public record AgenceTransactionRow(
      long operationId,
      String jour,
      String heure,
      String produit,
      String ecran,
      String operateur,
      String expediteur,
      String beneficiaire,
      String statut,
      BigDecimal montant) {}

  public record AgenceTransactions(
      long total,
      int page,
      int size,
      BigDecimal moyenne,
      BigDecimal montantTotal,
      List<AgenceTransactionRow> rows) {}

  private record AgenceTxStats(long total, BigDecimal moyenne, BigDecimal montantTotal) {}

  public record AgenceRankRow(
      int agenceId,
      String codeAgence,
      String nom,
      String categorie,
      String posId,
      String region,
      String zone,
      long nb,
      BigDecimal montant,
      BigDecimal commission,
      BigDecimal commissionFcn,
      BigDecimal commissionAgent,
      BigDecimal commissionFcnAgent) {}

  public record AgenceGeoRow(
      int agenceId,
      String codeAgence,
      String nom,
      double latitude,
      double longitude,
      long nb,
      BigDecimal montant) {}

  public record AgenceClassement(long total, int page, int size, List<AgenceRankRow> rows) {
    AgenceClassement withPage(int page, int size) {
      return new AgenceClassement(total, page, size, rows);
    }
  }

  public record LigneExportRow(
      String agence,
      String codeAgence,
      String posId,
      String nom,
      String expediteur,
      String beneficiaire,
      String telephone,
      String telephoneExpediteur,
      String numero,
      String jour,
      BigDecimal montant,
      String statut) {}

  public record LignesExport(List<LigneExportRow> rows, boolean truncated, int limit) {}

  private record Grain(String table, String alias, boolean joinAgence, boolean agent, boolean hasNbMontant) {}
}
