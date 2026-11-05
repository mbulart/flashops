package com.flashops.api.pilotage;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PilotageFiltresRepository {

  private static final Logger log = LoggerFactory.getLogger(PilotageFiltresRepository.class);

  /**
   * Régions commerciales vers les provinces administratives dont les villes sont proposées.
   * Kin 2 est un libellé hors référentiel : il n'ajoute aucune ville.
   */
  private static final Map<String, List<String>> REGION_PROVINCES =
      Map.of(
          "KINSHASA", List.of("KINSHASA"),
          "KATANGA", List.of("HAUT-KATANGA", "LUALABA"),
          "EST", List.of("NORD-KIVU", "SUD-KIVU", "ITURI", "MANIEMA"),
          "KONGO_CENTRAL", List.of("KONGO-CENTRAL"),
          "BAS_CONGO", List.of("KONGO-CENTRAL"),
          "KIKWIT", List.of("KWILU"));

  private final JdbcTemplate jdbc;

  public PilotageFiltresRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<FiltresSnapshot> load(String domaine) {
    try {
      var produits = listProduitsForDomaine(domaine);

      var categories =
          jdbc.query(
              """
              SELECT DISTINCT btrim(categorie) AS categorie
              FROM pilotage.dim_agence
              WHERE agence_id <> 0
                AND categorie IS NOT NULL
                AND btrim(categorie) <> ''
              ORDER BY categorie
              """,
              (rs, rowNum) -> rs.getString("categorie"));

      var typesOperation =
          jdbc.query(
              """
              SELECT DISTINCT t.type_operation_id, t.libelle
              FROM pilotage.agg_operation_jour AS g
              JOIN pilotage.dim_type_operation AS t ON t.type_operation_id = g.type_operation_id
              WHERE g.domaine = ?
                AND g.type_operation_id <> 0
                AND btrim(t.libelle) <> ''
              ORDER BY t.libelle
              """,
              (rs, rowNum) ->
                  new TypeOperationRow(rs.getInt("type_operation_id"), rs.getString("libelle")),
              domaine);

      return Optional.of(new FiltresSnapshot(produits, categories, typesOperation));
    } catch (DataAccessException ex) {
      log.error("Chargement des filtres pilotage impossible pour domaine={}", domaine, ex);
      return Optional.empty();
    }
  }

  public List<AgenceRow> searchAgences(
      String q, int limit, PilotageAgenceFilterScope scope, List<Integer> restrictAgenceIds) {
    String term = q == null ? "" : q.trim();
    String pattern = "%" + term + "%";
    var sql =
        new StringBuilder(
            """
            SELECT d.agence_id, d.code_agence, d.nom, d.categorie,
                   NULLIF(btrim(d.pos_id), '') AS pos_id,
                   NULLIF(btrim(d.fp_agent), '') AS fp_agent
            FROM pilotage.dim_agence AS d
            WHERE d.agence_id <> 0
              AND (
                d.code_agence ILIKE ?
                OR coalesce(d.nom, '') ILIKE ?
                OR coalesce(d.pos_id, '') ILIKE ?
                OR coalesce(d.fp_agent, '') ILIKE ?
              )
            """);
    var args = new ArrayList<Object>();
    args.add(pattern);
    args.add(pattern);
    args.add(pattern);
    args.add(pattern);
    if (restrictAgenceIds != null && !restrictAgenceIds.isEmpty()) {
      sql.append(" AND d.agence_id = ANY(?)");
      args.add(restrictAgenceIds.toArray(new Integer[0]));
    }
    if (scope != null && scope.isActive()) {
      PilotageGeoMatchSupport.appendDimAgenceScope(jdbc, scope, "d", sql, args);
    }
    sql.append(" ORDER BY d.code_agence LIMIT ?");
    args.add(limit);
    return jdbc.query(
        sql.toString(),
        (rs, rowNum) ->
            new AgenceRow(
                rs.getInt("agence_id"),
                rs.getString("code_agence"),
                rs.getString("nom"),
                rs.getString("categorie"),
                rs.getString("pos_id"),
                rs.getString("fp_agent")),
        args.toArray());
  }

  public List<ReseauRefRow> listRegions() {
    try {
      var commercial =
          jdbc.query(
              """
              SELECT id, code, libelle
              FROM regions
              WHERE actif = TRUE AND btrim(libelle) <> ''
              ORDER BY libelle
              """,
              (rs, rowNum) ->
                  new ReseauRefRow(rs.getInt("id"), rs.getString("code"), rs.getString("libelle")));
      if (!commercial.isEmpty()) {
        return commercial;
      }
    } catch (DataAccessException ignored) {
      // table zones absente
    }
    return jdbc.query(
        """
        SELECT r.region_id, r.code, r.libelle
        FROM pilotage.dim_region AS r
        WHERE r.region_id <> 0
        ORDER BY r.libelle
        """,
        (rs, rowNum) ->
            new ReseauRefRow(rs.getInt("region_id"), rs.getString("code"), rs.getString("libelle")));
  }

  public List<ReseauRefRow> listZones(List<String> reseauRegions) {
    List<String> regions = upperLabels(reseauRegions);
    try {
      if (!regions.isEmpty()) {
        return jdbc.query(
            """
            SELECT id, code, libelle
            FROM zones
            WHERE actif = TRUE AND upper(btrim(region)) IN (%s)
            ORDER BY libelle
            """
                .formatted(placeholders(regions.size())),
            (rs, rowNum) ->
                new ReseauRefRow(rs.getInt("id"), rs.getString("code"), rs.getString("libelle")),
            regions.toArray());
      }
      return jdbc.query(
          """
          SELECT id, code, libelle
          FROM zones
          WHERE actif = TRUE
          ORDER BY libelle
          """,
          (rs, rowNum) ->
              new ReseauRefRow(rs.getInt("id"), rs.getString("code"), rs.getString("libelle")));
    } catch (DataAccessException ignored) {
      // fallback pilotage
    }
    if (!regions.isEmpty()) {
      return jdbc.query(
          """
          SELECT z.zone_id, z.code, z.libelle
          FROM pilotage.dim_zone AS z
          INNER JOIN pilotage.dim_region AS r ON r.region_id = z.region_id
          WHERE z.zone_id <> 0
            AND upper(btrim(r.libelle)) IN (%s)
          ORDER BY z.libelle
          """
              .formatted(placeholders(regions.size())),
          (rs, rowNum) ->
              new ReseauRefRow(rs.getInt("zone_id"), rs.getString("code"), rs.getString("libelle")),
          regions.toArray());
    }
    return jdbc.query(
        """
        SELECT z.zone_id, z.code, z.libelle
        FROM pilotage.dim_zone AS z
        WHERE z.zone_id <> 0
        ORDER BY z.libelle
        """,
        (rs, rowNum) ->
            new ReseauRefRow(rs.getInt("zone_id"), rs.getString("code"), rs.getString("libelle")));
  }

  public List<AgentRow> searchAgents(
      String q,
      Integer agenceId,
      int limit,
      PilotageAgenceFilterScope scope,
      List<Integer> restrictAgenceIds) {
    String pattern = "%" + q.trim() + "%";
    boolean hasRestrict = restrictAgenceIds != null && !restrictAgenceIds.isEmpty();
    if (agenceId != null && agenceId > 0) {
      return jdbc.query(
          """
          SELECT DISTINCT a.agent_id, a.nom
          FROM pilotage.dim_agent AS a
          WHERE a.agent_id <> 0
            AND btrim(a.nom) <> ''
            AND a.nom ILIKE ?
            AND EXISTS (
              SELECT 1
              FROM pilotage.agg_agent_jour AS g
              WHERE g.agent_id = a.agent_id
                AND g.agence_id = ?
            )
          ORDER BY a.nom
          LIMIT ?
          """,
          (rs, rowNum) -> new AgentRow(rs.getInt("agent_id"), rs.getString("nom")),
          pattern,
          agenceId,
          limit);
    }
    if ((scope != null && scope.isActive()) || hasRestrict) {
      var sql =
          new StringBuilder(
              """
              SELECT DISTINCT a.agent_id, a.nom
              FROM pilotage.dim_agent AS a
              INNER JOIN pilotage.agg_agent_jour AS g ON g.agent_id = a.agent_id
              INNER JOIN pilotage.dim_agence AS d ON d.agence_id = g.agence_id
              WHERE a.agent_id <> 0
                AND btrim(a.nom) <> ''
                AND a.nom ILIKE ?
              """);
      var args = new ArrayList<Object>();
      args.add(pattern);
      if (hasRestrict) {
        sql.append(" AND d.agence_id = ANY(?)");
        args.add(restrictAgenceIds.toArray(new Integer[0]));
      }
      if (scope != null && scope.isActive()) {
        PilotageGeoMatchSupport.appendDimAgenceScope(jdbc, scope, "d", sql, args);
      }
      sql.append(" ORDER BY a.nom LIMIT ?");
      args.add(limit);
      return jdbc.query(
          sql.toString(),
          (rs, rowNum) -> new AgentRow(rs.getInt("agent_id"), rs.getString("nom")),
          args.toArray());
    }
    return jdbc.query(
        """
        SELECT agent_id, nom
        FROM pilotage.dim_agent
        WHERE agent_id <> 0
          AND btrim(nom) <> ''
          AND nom ILIKE ?
        ORDER BY nom
        LIMIT ?
        """,
        (rs, rowNum) -> new AgentRow(rs.getInt("agent_id"), rs.getString("nom")),
        pattern,
        limit);
  }

  public record ProduitRow(
      int produitId, String module, String produit, String ecran, String partenaire) {}

  public record TypeOperationRow(int typeOperationId, String libelle) {}

  public record AgenceRow(
      int agenceId,
      String codeAgence,
      String nom,
      String categorie,
      String posId,
      String fpAgent) {}

  public record AgentRow(int agentId, String nom) {}

  public record ReseauRefRow(int id, String code, String libelle) {}

  public record GeoPaysRow(short id, String codeIso, String libelle) {}

  public record GeoProvinceRow(short id, short paysId, String libelle) {}

  public record GeoVilleRow(short id, short provinceId, String libelle) {}

  public record GeoTerritoireRow(short id, short provinceId, String libelle) {}

  public record GeoCommuneRow(int id, String libelle) {}

  private List<ProduitRow> listProduitsForDomaine(String domaine) {
    if ("transfert".equals(domaine)) {
      return jdbc.query(
          """
          SELECT produit_id, module, produit, ecran, coalesce(partenaire, '') AS partenaire
          FROM pilotage.dim_produit AS p
          WHERE p.domaine = 'transfert'
            AND p.produit_id <> 0
            AND NOT (
              """
              + PilotageProductRules.SQL_MPESA_ON_P
              + """
            )
          ORDER BY module, produit, ecran
          """,
          (rs, rowNum) ->
              new ProduitRow(
                  rs.getInt("produit_id"),
                  rs.getString("module"),
                  rs.getString("produit"),
                  rs.getString("ecran"),
                  rs.getString("partenaire")));
    }
    if ("monnaie".equals(domaine)) {
      return jdbc.query(
          """
          SELECT produit_id, module, produit, ecran, coalesce(partenaire, '') AS partenaire
          FROM pilotage.dim_produit AS p
          WHERE p.produit_id <> 0
            AND (
              p.domaine = 'monnaie'
              OR (
              """
              + PilotageProductRules.SQL_MPESA_ON_P
              + """
              )
            )
          ORDER BY module, produit, ecran
          """,
          (rs, rowNum) ->
              new ProduitRow(
                  rs.getInt("produit_id"),
                  rs.getString("module"),
                  rs.getString("produit"),
                  rs.getString("ecran"),
                  rs.getString("partenaire")));
    }
    return jdbc.query(
        """
        SELECT produit_id, module, produit, ecran, coalesce(partenaire, '') AS partenaire
        FROM pilotage.dim_produit
        WHERE domaine = ?
          AND produit_id <> 0
        ORDER BY module, produit, ecran
        """,
        (rs, rowNum) ->
            new ProduitRow(
                rs.getInt("produit_id"),
                rs.getString("module"),
                rs.getString("produit"),
                rs.getString("ecran"),
                rs.getString("partenaire")),
        domaine);
  }

  public List<CouloirRow> listCouloirs(String domaine) {
    try {
      return jdbc.query(
          """
          SELECT DISTINCT
                 g.pays_origine_id::text || '|' || g.pays_destination_id::text AS code,
                 coalesce(nullif(btrim(po.libelle), ''), 'Pays ' || g.pays_origine_id::text)
                   || ' → '
                   || coalesce(nullif(btrim(pd.libelle), ''), 'Pays ' || g.pays_destination_id::text) AS label
          FROM pilotage.agg_couloir_jour AS g
          INNER JOIN pilotage.dim_pays AS po ON po.pays_id = g.pays_origine_id
          INNER JOIN pilotage.dim_pays AS pd ON pd.pays_id = g.pays_destination_id
          WHERE g.domaine = ?
            AND g.pays_origine_id <> 0
            AND g.pays_destination_id <> 0
          ORDER BY label
          """,
          (rs, rowNum) -> new CouloirRow(rs.getString("code"), rs.getString("label")),
          domaine);
    } catch (DataAccessException ex) {
      return List.of();
    }
  }

  public record CouloirRow(String code, String label) {}

  public List<GeoPaysRow> listGeoPays() {
    try {
      return jdbc.query(
          """
          SELECT id, code_iso, libelle
          FROM pays
          WHERE actif = TRUE
          ORDER BY libelle
          """,
          (rs, rowNum) ->
              new GeoPaysRow(rs.getShort("id"), rs.getString("code_iso"), rs.getString("libelle")));
    } catch (DataAccessException ex) {
      return List.of();
    }
  }

  public List<GeoProvinceRow> listGeoProvinces(short paysId) {
    try {
      return jdbc.query(
          """
          SELECT id, pays_id, libelle
          FROM provinces
          WHERE actif = TRUE AND pays_id = ?
          ORDER BY ordre_tri, libelle
          """,
          (rs, rowNum) ->
              new GeoProvinceRow(rs.getShort("id"), rs.getShort("pays_id"), rs.getString("libelle")),
          paysId);
    } catch (DataAccessException ex) {
      return List.of();
    }
  }

  public List<GeoVilleRow> listGeoVillesByPays(short paysId, List<String> reseauRegions) {
    List<String> asked = upperLabels(reseauRegions);
    try {
      List<String> provinceCodes = asked.isEmpty() ? List.of() : provinceCodesFor(reseauRegions);
      if (!asked.isEmpty() && provinceCodes.isEmpty()) {
        return List.of();
      }
      StringBuilder sql =
          new StringBuilder(
              """
              SELECT v.id, v.province_id, v.libelle
              FROM villes AS v
              INNER JOIN provinces AS p ON p.id = v.province_id
              WHERE v.actif = TRUE AND p.actif = TRUE AND p.pays_id = ?
              """);
      List<Object> args = new ArrayList<>();
      args.add(paysId);
      if (!provinceCodes.isEmpty()) {
        sql.append(" AND p.code IN (").append(placeholders(provinceCodes.size())).append(")");
        args.addAll(provinceCodes);
      }
      sql.append(" ORDER BY v.libelle");
      return jdbc.query(
          sql.toString(),
          (rs, rowNum) ->
              new GeoVilleRow(rs.getShort("id"), rs.getShort("province_id"), rs.getString("libelle")),
          args.toArray());
    } catch (DataAccessException ex) {
      return List.of();
    }
  }

  private List<String> provinceCodesFor(List<String> labels) {
    LinkedHashSet<String> provinces = new LinkedHashSet<>();
    for (String label : labels) {
      if (label == null || label.isBlank()) {
        continue;
      }
      List<String> codes;
      try {
        codes =
            jdbc.query(
                """
                SELECT code
                FROM regions
                WHERE actif = TRUE
                  AND (upper(btrim(libelle)) = upper(btrim(?)) OR upper(btrim(code)) = upper(btrim(?)))
                """,
                (rs, rowNum) -> rs.getString("code"),
                label.trim(),
                label.trim());
      } catch (DataAccessException ex) {
        codes = List.of();
      }
      if (codes.isEmpty()) {
        String folded = label.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "");
        provinces.addAll(REGION_PROVINCES.getOrDefault(folded, List.of()));
        continue;
      }
      for (String code : codes) {
        provinces.addAll(REGION_PROVINCES.getOrDefault(code, List.of()));
      }
    }
    return List.copyOf(provinces);
  }

  private static List<String> upperLabels(List<String> values) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }
    return values.stream()
        .filter(value -> value != null && !value.isBlank())
        .map(value -> value.trim().toUpperCase(Locale.ROOT))
        .distinct()
        .toList();
  }

  private static String placeholders(int count) {
    return String.join(", ", java.util.Collections.nCopies(count, "?"));
  }

  public List<GeoVilleRow> listGeoVilles(short provinceId) {
    try {
      return jdbc.query(
          """
          SELECT id, province_id, libelle
          FROM villes
          WHERE actif = TRUE AND province_id = ?
          ORDER BY libelle
          """,
          (rs, rowNum) ->
              new GeoVilleRow(rs.getShort("id"), rs.getShort("province_id"), rs.getString("libelle")),
          provinceId);
    } catch (DataAccessException ex) {
      return List.of();
    }
  }

  public List<GeoTerritoireRow> listGeoTerritoires(short provinceId) {
    try {
      return jdbc.query(
          """
          SELECT id, province_id, libelle
          FROM territoires
          WHERE actif = TRUE AND province_id = ?
          ORDER BY libelle
          """,
          (rs, rowNum) ->
              new GeoTerritoireRow(
                  rs.getShort("id"), rs.getShort("province_id"), rs.getString("libelle")),
          provinceId);
    } catch (DataAccessException ex) {
      return List.of();
    }
  }

  public List<GeoCommuneRow> listGeoCommunes(Short villeId, Short territoireId) {
    try {
      if (villeId != null && villeId > 0) {
        return jdbc.query(
            """
            SELECT id, libelle FROM communes
            WHERE actif = TRUE AND ville_id = ?
            ORDER BY libelle
            """,
            (rs, rowNum) -> new GeoCommuneRow(rs.getInt("id"), rs.getString("libelle")),
            villeId);
      }
      if (territoireId != null && territoireId > 0) {
        return jdbc.query(
            """
            SELECT id, libelle FROM communes
            WHERE actif = TRUE AND territoire_id = ?
            ORDER BY libelle
            """,
            (rs, rowNum) -> new GeoCommuneRow(rs.getInt("id"), rs.getString("libelle")),
            territoireId);
      }
      return List.of();
    } catch (DataAccessException ex) {
      return List.of();
    }
  }

  public record FiltresSnapshot(
      List<ProduitRow> produits, List<String> categories, List<TypeOperationRow> typesOperation) {}
}
