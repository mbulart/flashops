package com.flashops.api.agences;

import com.flashops.api.web.dto.AgenceAdminDtos.AgenceAdminInput;
import com.flashops.api.web.dto.AgenceAdminDtos.AgenceAdminPage;
import com.flashops.api.web.dto.AgenceAdminDtos.AgenceAdminRow;
import com.flashops.api.web.dto.PublicAgencesDtos;
import java.math.BigDecimal;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AgenceAdminRepository {

  private static final String SELECT_LIST =
      """
      SELECT d.agence_id,
             coalesce(nullif(btrim(d.code_agence), ''), '') AS code_agence,
             coalesce(nullif(btrim(d.nom), ''), '') AS nom,
             coalesce(nullif(btrim(d.categorie), ''), '') AS categorie,
             coalesce(nullif(btrim(d.pos_id), ''), '') AS pos_id,
             coalesce(nullif(btrim(d.fp_agent), ''), '') AS fp_agent,
             coalesce(nullif(btrim(d.ville), ''), '') AS ville,
             coalesce(nullif(btrim(d.commune), ''), '') AS commune,
             coalesce(nullif(btrim(d.province), ''), '') AS province,
             coalesce(nullif(btrim(d.pays), ''), '') AS pays,
             coalesce(nullif(btrim(d.adresse), ''), '') AS adresse,
             d.latitude,
             d.longitude,
             d.region_id,
             d.zone_id,
             coalesce(nullif(nullif(btrim(rg.libelle), ''), 'Non renseigné'), '') AS region,
             coalesce(nullif(nullif(btrim(zn.libelle), ''), 'Non renseigné'), '') AS zone,
             coalesce(nullif(btrim(rz.nom), ''), '') AS responsable_zone,
             d.parent_agence_id,
             coalesce(nullif(btrim(mere.code_agence), ''), '') AS mere_code,
             coalesce(nullif(btrim(mere.nom), ''), '') AS mere_nom,
             to_char(last_tx.derniere_tx, 'YYYY-MM-DD') AS derniere_transaction
      FROM pilotage.dim_agence AS d
      LEFT JOIN pilotage.dim_region AS rg ON rg.region_id = d.region_id
      LEFT JOIN pilotage.dim_zone AS zn ON zn.zone_id = d.zone_id
      LEFT JOIN public.zones AS az ON lower(btrim(az.libelle)) = lower(btrim(zn.libelle))
      LEFT JOIN public.responsables_zone AS rz ON rz.id = az.responsable_zone_id
      LEFT JOIN pilotage.dim_agence AS mere ON mere.agence_id = d.parent_agence_id
      LEFT JOIN (
        SELECT agence_id, MAX(jour)::date AS derniere_tx
        FROM pilotage.agg_operation_agence_jour
        GROUP BY agence_id
      ) last_tx ON last_tx.agence_id = d.agence_id
      """;

  private final JdbcTemplate jdbc;

  public AgenceAdminRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public AgenceAdminPage list(AgenceAdminQuery q) {
    int size = Math.min(Math.max(q.size(), 1), 200);
    int page = Math.max(q.page(), 1);
    long offset = (long) (page - 1) * size;

    var where = new StringBuilder(" WHERE d.agence_id <> 0 ");
    var args = new ArrayList<Object>();
    appendFilters(where, args, q);

    Long total =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM pilotage.dim_agence AS d "
                + "LEFT JOIN ("
                + "  SELECT agence_id, MAX(jour)::date AS derniere_tx "
                + "  FROM pilotage.agg_operation_agence_jour GROUP BY agence_id"
                + ") last_tx ON last_tx.agence_id = d.agence_id "
                + where,
            Long.class,
            args.toArray());

    var pageArgs = new ArrayList<>(args);
    pageArgs.add(size);
    pageArgs.add(offset);
    List<AgenceAdminRow> items =
        jdbc.query(
            SELECT_LIST
                + where
                + " ORDER BY d.nom NULLS LAST, d.code_agence NULLS LAST, d.agence_id "
                + " LIMIT ? OFFSET ? ",
            this::mapRow,
            pageArgs.toArray());
    return new AgenceAdminPage(total == null ? 0L : total, page, size, items);
  }

  public Optional<AgenceAdminRow> findById(int agenceId) {
    var sql =
        """
        SELECT d.agence_id,
               coalesce(nullif(btrim(d.code_agence), ''), '') AS code_agence,
               coalesce(nullif(btrim(d.nom), ''), '') AS nom,
               coalesce(nullif(btrim(d.categorie), ''), '') AS categorie,
               coalesce(nullif(btrim(d.pos_id), ''), '') AS pos_id,
               coalesce(nullif(btrim(d.fp_agent), ''), '') AS fp_agent,
               coalesce(nullif(btrim(d.ville), ''), '') AS ville,
               coalesce(nullif(btrim(d.commune), ''), '') AS commune,
               coalesce(nullif(btrim(d.province), ''), '') AS province,
               coalesce(nullif(btrim(d.pays), ''), '') AS pays,
               coalesce(nullif(btrim(d.adresse), ''), '') AS adresse,
               d.latitude,
               d.longitude,
               d.region_id,
               d.zone_id,
               coalesce(nullif(nullif(btrim(rg.libelle), ''), 'Non renseigné'), '') AS region,
               coalesce(nullif(nullif(btrim(zn.libelle), ''), 'Non renseigné'), '') AS zone,
               coalesce(nullif(btrim(rz.nom), ''), '') AS responsable_zone,
               d.parent_agence_id,
               coalesce(nullif(btrim(mere.code_agence), ''), '') AS mere_code,
               coalesce(nullif(btrim(mere.nom), ''), '') AS mere_nom,
               to_char(last_tx.derniere_tx, 'YYYY-MM-DD') AS derniere_transaction
        FROM pilotage.dim_agence AS d
        LEFT JOIN pilotage.dim_region AS rg ON rg.region_id = d.region_id
        LEFT JOIN pilotage.dim_zone AS zn ON zn.zone_id = d.zone_id
        LEFT JOIN public.zones AS az ON lower(btrim(az.libelle)) = lower(btrim(zn.libelle))
        LEFT JOIN public.responsables_zone AS rz ON rz.id = az.responsable_zone_id
        LEFT JOIN pilotage.dim_agence AS mere ON mere.agence_id = d.parent_agence_id
        LEFT JOIN (
          SELECT agence_id, MAX(jour)::date AS derniere_tx
          FROM pilotage.agg_operation_agence_jour
          GROUP BY agence_id
        ) last_tx ON last_tx.agence_id = d.agence_id
        WHERE d.agence_id = ? AND d.agence_id <> 0
        """;
    try {
      return Optional.ofNullable(jdbc.queryForObject(sql, this::mapRow, agenceId));
    } catch (EmptyResultDataAccessException ex) {
      return Optional.empty();
    }
  }

  /** Export : tous les résultats filtrés, sans plafond de pagination. */
  public List<AgenceAdminRow> listForExport(AgenceAdminQuery q) {
    var where = new StringBuilder(" WHERE d.agence_id <> 0 ");
    var args = new ArrayList<Object>();
    appendFilters(where, args, q);
    return jdbc.query(
        SELECT_LIST
            + where
            + " ORDER BY d.nom NULLS LAST, d.code_agence NULLS LAST, d.agence_id ",
        this::mapRow,
        args.toArray());
  }

  public int create(AgenceAdminInput body) {
    Integer id =
        jdbc.queryForObject(
            """
            INSERT INTO pilotage.dim_agence (
              code_agence, nom, categorie, pos_id, fp_agent,
              ville, commune, province, pays, adresse,
              latitude, longitude, region_id, zone_id, parent_agence_id
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            RETURNING agence_id
            """,
            Integer.class,
            blankToNull(body.codeAgence()),
            blankToNull(body.nom()),
            blankToNull(body.categorie()),
            blankToNull(body.posId()),
            blankToNull(body.fpAgent()),
            blankToNull(body.ville()),
            blankToNull(body.commune()),
            blankToNull(body.province()),
            blankToNull(body.pays()),
            blankToNull(body.adresse()),
            body.latitude(),
            body.longitude(),
            body.regionId(),
            body.zoneId(),
            body.parentAgenceId());
    return id == null ? 0 : id;
  }

  public boolean update(int agenceId, AgenceAdminInput body) {
    int n =
        jdbc.update(
            """
            UPDATE pilotage.dim_agence SET
              code_agence = ?,
              nom = ?,
              categorie = ?,
              pos_id = ?,
              fp_agent = ?,
              ville = ?,
              commune = ?,
              province = ?,
              pays = ?,
              adresse = ?,
              latitude = ?,
              longitude = ?,
              region_id = ?,
              zone_id = ?,
              parent_agence_id = ?
            WHERE agence_id = ? AND agence_id <> 0
            """,
            blankToNull(body.codeAgence()),
            blankToNull(body.nom()),
            blankToNull(body.categorie()),
            blankToNull(body.posId()),
            blankToNull(body.fpAgent()),
            blankToNull(body.ville()),
            blankToNull(body.commune()),
            blankToNull(body.province()),
            blankToNull(body.pays()),
            blankToNull(body.adresse()),
            body.latitude(),
            body.longitude(),
            body.regionId(),
            body.zoneId(),
            body.parentAgenceId(),
            agenceId);
    return n > 0;
  }

  public List<String> listCategories() {
    return jdbc.query(
        """
        SELECT DISTINCT btrim(categorie) AS categorie
        FROM pilotage.dim_agence
        WHERE agence_id <> 0 AND nullif(btrim(categorie), '') IS NOT NULL
        ORDER BY 1
        """,
        (rs, i) -> rs.getString(1));
  }

  private void appendFilters(StringBuilder where, List<Object> args, AgenceAdminQuery q) {
    if (notBlank(q.q())) {
      String like = "%" + q.q().trim() + "%";
      where.append(
          """
           AND (
             d.nom ILIKE ?
             OR d.code_agence ILIKE ?
             OR coalesce(d.pos_id, '') ILIKE ?
             OR coalesce(d.fp_agent, '') ILIKE ?
             OR coalesce(d.ville, '') ILIKE ?
             OR coalesce(d.commune, '') ILIKE ?
             OR CAST(d.agence_id AS text) ILIKE ?
           )
          """);
      args.add(like);
      args.add(like);
      args.add(like);
      args.add(like);
      args.add(like);
      args.add(like);
      args.add(like);
    }
    if (notBlank(q.identifiant())) {
      String id = q.identifiant().trim();
      where.append(
          """
           AND (
             CAST(d.agence_id AS text) = ?
             OR lower(btrim(d.code_agence)) = lower(?)
             OR lower(btrim(coalesce(d.pos_id, ''))) = lower(?)
             OR lower(btrim(coalesce(d.fp_agent, ''))) = lower(?)
           )
          """);
      args.add(id);
      args.add(id);
      args.add(id);
      args.add(id);
    }
    if (q.regionId() != null && q.regionId() > 0) {
      where.append(" AND d.region_id = ? ");
      args.add(q.regionId());
    }
    if (q.zoneId() != null && q.zoneId() > 0) {
      where.append(" AND d.zone_id = ? ");
      args.add(q.zoneId());
    }
    if (notBlank(q.ville())) {
      where.append(" AND d.ville ILIKE ? ");
      args.add(q.ville().trim());
    }
    if (notBlank(q.commune())) {
      where.append(" AND d.commune ILIKE ? ");
      args.add(q.commune().trim());
    }
    if (notBlank(q.province())) {
      where.append(" AND d.province ILIKE ? ");
      args.add(q.province().trim());
    }
    if (notBlank(q.pays())) {
      where.append(" AND d.pays ILIKE ? ");
      args.add(q.pays().trim());
    }
    if (notBlank(q.categorie())) {
      where.append(" AND lower(btrim(d.categorie)) = lower(?) ");
      args.add(q.categorie().trim());
    }
    if (q.parentAgenceId() != null && q.parentAgenceId() > 0) {
      where.append(" AND d.parent_agence_id = ? ");
      args.add(q.parentAgenceId());
    }
    if (q.restrictAgenceIds() != null && !q.restrictAgenceIds().isEmpty()) {
      where.append(" AND d.agence_id = ANY(?) ");
      args.add(q.restrictAgenceIds().toArray(new Integer[0]));
    }
    if (Boolean.TRUE.equals(q.sansCoords())) {
      where.append(
          " AND (d.latitude IS NULL OR d.longitude IS NULL OR (d.latitude = 0 AND d.longitude = 0)) ");
    }
    if (q.activityDays() != null && q.activityDays() > 0) {
      where.append(" AND last_tx.derniere_tx >= (CURRENT_DATE - ?::int) ");
      args.add(q.activityDays());
    }
    if (notBlank(q.from()) && notBlank(q.to())) {
      where.append(
          """
           AND EXISTS (
             SELECT 1 FROM pilotage.agg_operation_agence_jour g
             WHERE g.agence_id = d.agence_id
               AND g.jour::date BETWEEN ?::date AND ?::date
           )
          """);
      args.add(Date.valueOf(q.from().trim()));
      args.add(Date.valueOf(q.to().trim()));
    }
  }

  /** Agences géolocalisées, hors périmètre utilisateur — page publique. */
  public List<PublicAgencesDtos.AgenceGeo> loadLocatedPublic() {
    String sql =
        """
        SELECT d.agence_id,
               coalesce(nullif(btrim(d.code_agence), ''), '') AS code,
               coalesce(nullif(btrim(d.nom), ''), '') AS nom,
               coalesce(
                 nullif(btrim(d.adresse), ''),
                 nullif(
                   concat_ws(
                     ', ',
                     nullif(btrim(d.commune), ''),
                     nullif(btrim(d.ville), '')
                   ),
                   ''
                 ),
                 ''
               ) AS adresse,
               d.latitude,
               d.longitude
        FROM pilotage.dim_agence AS d
        WHERE d.agence_id <> 0
          AND d.latitude IS NOT NULL
          AND d.longitude IS NOT NULL
          AND d.latitude <> 0
          AND d.longitude <> 0
        ORDER BY d.nom, d.code_agence
        LIMIT 5000
        """;
    return jdbc.query(sql, this::mapPublicGeo);
  }

  private PublicAgencesDtos.AgenceGeo mapPublicGeo(ResultSet rs, int rowNum) throws SQLException {
    BigDecimal lat = (BigDecimal) rs.getObject("latitude");
    BigDecimal lng = (BigDecimal) rs.getObject("longitude");
    return new PublicAgencesDtos.AgenceGeo(
        rs.getInt("agence_id"),
        rs.getString("code"),
        rs.getString("nom"),
        rs.getString("adresse"),
        lat == null ? 0d : lat.doubleValue(),
        lng == null ? 0d : lng.doubleValue());
  }

  private AgenceAdminRow mapRow(ResultSet rs, int rowNum) throws SQLException {
    return new AgenceAdminRow(
        rs.getInt("agence_id"),
        rs.getString("code_agence"),
        rs.getString("nom"),
        rs.getString("categorie"),
        rs.getString("pos_id"),
        rs.getString("fp_agent"),
        rs.getString("ville"),
        rs.getString("commune"),
        rs.getString("province"),
        rs.getString("pays"),
        rs.getString("adresse"),
        (BigDecimal) rs.getObject("latitude"),
        (BigDecimal) rs.getObject("longitude"),
        (Integer) rs.getObject("region_id"),
        (Integer) rs.getObject("zone_id"),
        rs.getString("region"),
        rs.getString("zone"),
        rs.getString("responsable_zone"),
        (Integer) rs.getObject("parent_agence_id"),
        rs.getString("mere_code"),
        rs.getString("mere_nom"),
        rs.getString("derniere_transaction"));
  }

  private static boolean notBlank(String v) {
    return v != null && !v.isBlank();
  }

  private static String blankToNull(String v) {
    if (v == null) return null;
    String t = v.trim();
    return t.isEmpty() ? null : t;
  }
}
