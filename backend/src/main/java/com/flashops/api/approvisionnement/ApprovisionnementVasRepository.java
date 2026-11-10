package com.flashops.api.approvisionnement;

import com.flashops.api.approvisionnement.ApprovisionnementPeriodes.Periode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class ApprovisionnementVasRepository {

  private final JdbcTemplate jdbc;

  public ApprovisionnementVasRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  private static final String SQL_PRODUIT_MM =
      """
      SELECT produit_id, module, produit, ecran, coalesce(partenaire, '') AS partenaire
      FROM pilotage.dim_produit
      WHERE produit_id <> 0
        AND upper(btrim(module)) = 'TELCO'
        AND btrim(ecran) = 'MobileMoney'
        AND upper(regexp_replace(btrim(produit), '[\\s_-]+', '', 'g')) IN (
          'MPESA', 'ORANGEMONEY', 'AIRTELMONEY', 'AFRIMONEY', 'MOMO'
        )
      """;

  public List<ProduitMmRow> listProduitsMobileMoney() {
    return jdbc.query(
        SQL_PRODUIT_MM + " ORDER BY produit, partenaire",
        (rs, i) ->
            new ProduitMmRow(
                rs.getInt("produit_id"),
                rs.getString("module"),
                rs.getString("produit"),
                rs.getString("ecran"),
                rs.getString("partenaire")));
  }

  public Optional<ProduitMmRow> findProduitMobileMoney(int produitId) {
    var rows =
        jdbc.query(
            SQL_PRODUIT_MM + " AND produit_id = ?",
            (rs, i) ->
                new ProduitMmRow(
                    rs.getInt("produit_id"),
                    rs.getString("module"),
                    rs.getString("produit"),
                    rs.getString("ecran"),
                    rs.getString("partenaire")),
            produitId);
    return rows.stream().findFirst();
  }

  public TotauxPeriode totauxConsommation(int produitId, String devise, Periode periode) {
    return jdbc.query(
            """
            SELECT
              coalesce(sum(g.montant) FILTER (
                WHERE upper(btrim(coalesce(t.libelle, ''))) = 'DEPOT'
              ), 0) AS depots,
              coalesce(sum(g.montant) FILTER (
                WHERE upper(btrim(coalesce(t.libelle, ''))) = 'RETRAIT'
              ), 0) AS retraits
            FROM pilotage.agg_operation_jour AS g
            JOIN pilotage.dim_devise AS d ON d.devise_id = g.devise_id
            LEFT JOIN pilotage.dim_type_operation AS t
              ON t.type_operation_id = g.type_operation_id
            WHERE g.produit_id = ?
              AND upper(btrim(d.code)) = upper(btrim(?))
              AND g.statut_uniforme = 'Succès'
              AND g.jour BETWEEN ? AND ?
            """,
            (rs, i) -> {
              BigDecimal depots = scale(rs.getBigDecimal("depots"));
              BigDecimal retraits = scale(rs.getBigDecimal("retraits"));
              // Consommation nette métier = retraits réussis − dépôts réussis
              // (aligné sur le suivi ops : même signe que les tableaux de référence).
              return new TotauxPeriode(depots, retraits, retraits.subtract(depots));
            },
            produitId,
            devise,
            Date.valueOf(periode.debut()),
            Date.valueOf(periode.fin()))
        .stream()
        .findFirst()
        .orElse(new TotauxPeriode(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
  }

  public List<DemandeListRow> listDemandes(int limit) {
    return jdbc.query(
        """
        SELECT d.id, d.date_reference, d.statut, d.cree_le,
               (SELECT count(*)::int FROM lignes_demande_approvisionnement_vas l WHERE l.demande_id = d.id) AS nb_lignes
        FROM demandes_approvisionnement_vas d
        ORDER BY d.date_reference DESC, d.id DESC
        LIMIT ?
        """,
        (rs, i) ->
            new DemandeListRow(
                rs.getLong("id"),
                rs.getDate("date_reference").toLocalDate(),
                rs.getString("statut"),
                rs.getInt("nb_lignes"),
                rs.getTimestamp("cree_le").toInstant()),
        Math.max(1, Math.min(limit, 500)));
  }

  public Optional<DemandeHeaderRow> findDemande(long id) {
    var rows =
        jdbc.query(
            """
            SELECT id, date_reference, statut, commentaire, cree_par, cree_le, modifie_le
            FROM demandes_approvisionnement_vas
            WHERE id = ?
            """,
            DEMANDE_HEADER,
            id);
    return rows.stream().findFirst();
  }

  public List<LigneRow> listLignes(long demandeId) {
    return jdbc.query(
        """
        SELECT id, demande_id, produit_id, operateur, produit_libelle, devise, date_reference,
               j1_debut, j1_fin, j2_debut, j2_fin,
               depots_j1, retraits_j1, consommation_j1,
               depots_j2, retraits_j2, consommation_j2, moyenne,
               solde_08h, montant_propose, montant_valide, montant_paye
        FROM lignes_demande_approvisionnement_vas
        WHERE demande_id = ?
        ORDER BY id
        """,
        LIGNE_ROW,
        demandeId);
  }

  public long insertDemande(
      LocalDate dateReference, String statut, String commentaire, Integer creePar, Instant now) {
    var keys = new GeneratedKeyHolder();
    jdbc.update(
        con -> {
          PreparedStatement ps =
              con.prepareStatement(
                  """
                  INSERT INTO demandes_approvisionnement_vas
                    (date_reference, statut, commentaire, cree_par, cree_le, modifie_le)
                  VALUES (?, ?, ?, ?, ?, ?)
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          ps.setDate(1, Date.valueOf(dateReference));
          ps.setString(2, statut);
          ps.setString(3, commentaire);
          if (creePar == null) {
            ps.setObject(4, null);
          } else {
            ps.setInt(4, creePar);
          }
          ps.setTimestamp(5, Timestamp.from(now));
          ps.setTimestamp(6, Timestamp.from(now));
          return ps;
        },
        keys);
    // PostgreSQL renvoie toutes les colonnes : getKey() échoue s'il y en a plusieurs.
    var map = keys.getKeys();
    if (map == null || map.get("id") == null) {
      throw new IllegalStateException("demande id manquant");
    }
    return ((Number) map.get("id")).longValue();
  }

  public void updateDemande(
      long id, LocalDate dateReference, String statut, String commentaire, Instant now) {
    jdbc.update(
        """
        UPDATE demandes_approvisionnement_vas
        SET date_reference = ?, statut = ?, commentaire = ?, modifie_le = ?
        WHERE id = ?
        """,
        Date.valueOf(dateReference),
        statut,
        commentaire,
        Timestamp.from(now),
        id);
  }

  public void deleteLignes(long demandeId) {
    jdbc.update("DELETE FROM lignes_demande_approvisionnement_vas WHERE demande_id = ?", demandeId);
  }

  public void insertLigne(long demandeId, LigneInsert row) {
    jdbc.update(
        """
        INSERT INTO lignes_demande_approvisionnement_vas (
          demande_id, produit_id, operateur, produit_libelle, devise, date_reference,
          j1_debut, j1_fin, j2_debut, j2_fin,
          depots_j1, retraits_j1, consommation_j1,
          depots_j2, retraits_j2, consommation_j2, moyenne,
          solde_08h, montant_propose, montant_valide, montant_paye
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        demandeId,
        row.produitId(),
        row.operateur(),
        row.produitLibelle(),
        row.devise(),
        Date.valueOf(row.dateReference()),
        Date.valueOf(row.j1Debut()),
        Date.valueOf(row.j1Fin()),
        Date.valueOf(row.j2Debut()),
        Date.valueOf(row.j2Fin()),
        row.depotsJ1(),
        row.retraitsJ1(),
        row.consommationJ1(),
        row.depotsJ2(),
        row.retraitsJ2(),
        row.consommationJ2(),
        row.moyenne(),
        row.solde08h(),
        row.montantPropose(),
        row.montantValide(),
        row.montantPaye());
  }

  public static BigDecimal scale(BigDecimal v) {
    return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
  }

  public static BigDecimal moyenne(BigDecimal j1, BigDecimal j2) {
    return scale(j1.add(j2).divide(BigDecimal.valueOf(2), 6, RoundingMode.HALF_UP));
  }

  private static final RowMapper<DemandeHeaderRow> DEMANDE_HEADER =
      (rs, i) ->
          new DemandeHeaderRow(
              rs.getLong("id"),
              rs.getDate("date_reference").toLocalDate(),
              rs.getString("statut"),
              rs.getString("commentaire"),
              (Integer) rs.getObject("cree_par"),
              rs.getTimestamp("cree_le").toInstant(),
              rs.getTimestamp("modifie_le").toInstant());

  private static final RowMapper<LigneRow> LIGNE_ROW =
      (rs, i) ->
          new LigneRow(
              rs.getLong("id"),
              rs.getLong("demande_id"),
              rs.getInt("produit_id"),
              rs.getString("operateur"),
              rs.getString("produit_libelle"),
              rs.getString("devise"),
              rs.getDate("date_reference").toLocalDate(),
              rs.getDate("j1_debut").toLocalDate(),
              rs.getDate("j1_fin").toLocalDate(),
              rs.getDate("j2_debut").toLocalDate(),
              rs.getDate("j2_fin").toLocalDate(),
              rs.getBigDecimal("depots_j1"),
              rs.getBigDecimal("retraits_j1"),
              rs.getBigDecimal("consommation_j1"),
              rs.getBigDecimal("depots_j2"),
              rs.getBigDecimal("retraits_j2"),
              rs.getBigDecimal("consommation_j2"),
              rs.getBigDecimal("moyenne"),
              rs.getBigDecimal("solde_08h"),
              rs.getBigDecimal("montant_propose"),
              rs.getBigDecimal("montant_valide"),
              rs.getBigDecimal("montant_paye"));

  public record ProduitMmRow(
      int produitId, String module, String produit, String ecran, String partenaire) {}

  public record TotauxPeriode(BigDecimal depots, BigDecimal retraits, BigDecimal consommation) {}

  public record DemandeListRow(
      long id, LocalDate dateReference, String statut, int nbLignes, Instant creeLe) {}

  public record DemandeHeaderRow(
      long id,
      LocalDate dateReference,
      String statut,
      String commentaire,
      Integer creePar,
      Instant creeLe,
      Instant modifieLe) {}

  public record LigneRow(
      long id,
      long demandeId,
      int produitId,
      String operateur,
      String produitLibelle,
      String devise,
      LocalDate dateReference,
      LocalDate j1Debut,
      LocalDate j1Fin,
      LocalDate j2Debut,
      LocalDate j2Fin,
      BigDecimal depotsJ1,
      BigDecimal retraitsJ1,
      BigDecimal consommationJ1,
      BigDecimal depotsJ2,
      BigDecimal retraitsJ2,
      BigDecimal consommationJ2,
      BigDecimal moyenne,
      BigDecimal solde08h,
      BigDecimal montantPropose,
      BigDecimal montantValide,
      BigDecimal montantPaye) {}

  public record LigneInsert(
      int produitId,
      String operateur,
      String produitLibelle,
      String devise,
      LocalDate dateReference,
      LocalDate j1Debut,
      LocalDate j1Fin,
      LocalDate j2Debut,
      LocalDate j2Fin,
      BigDecimal depotsJ1,
      BigDecimal retraitsJ1,
      BigDecimal consommationJ1,
      BigDecimal depotsJ2,
      BigDecimal retraitsJ2,
      BigDecimal consommationJ2,
      BigDecimal moyenne,
      BigDecimal solde08h,
      BigDecimal montantPropose,
      BigDecimal montantValide,
      BigDecimal montantPaye) {}
}
