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

  public BigDecimal delaiTraitementHeures() {
    BigDecimal v =
        jdbc.query(
                "SELECT delai_traitement_heures FROM parametres_application WHERE id = 1",
                (rs, i) -> rs.getBigDecimal("delai_traitement_heures"))
            .stream()
            .findFirst()
            .orElse(BigDecimal.valueOf(2));
    return v == null ? BigDecimal.valueOf(2) : v;
  }

  public List<DemandeListRow> listDemandes(String statut, int limit) {
    // Filtre optionnel côté Java : Postgres ne peut pas typer "? IS NULL" si le bind est null.
    String sql =
        """
        SELECT d.id, d.date_reference, d.statut, d.cree_le, d.soumise_le,
               (SELECT count(*)::int FROM lignes_demande_approvisionnement_vas l WHERE l.demande_id = d.id) AS nb_lignes,
               coalesce((SELECT sum(l.montant_propose) FROM lignes_demande_approvisionnement_vas l
                         WHERE l.demande_id = d.id AND l.devise = 'USD'), 0) AS total_propose_usd,
               coalesce((SELECT sum(l.montant_propose) FROM lignes_demande_approvisionnement_vas l
                         WHERE l.demande_id = d.id AND l.devise = 'CDF'), 0) AS total_propose_cdf
        FROM demandes_approvisionnement_vas d
        """
            + (statut == null ? "" : " WHERE d.statut = ? ")
            + """
        ORDER BY d.date_reference DESC, d.id DESC
        LIMIT ?
        """;
    int lim = Math.max(1, Math.min(limit, 500));
    if (statut == null) {
      return jdbc.query(sql, DEMANDE_LIST_ROW, lim);
    }
    return jdbc.query(sql, DEMANDE_LIST_ROW, statut, lim);
  }

  public Optional<DemandeHeaderRow> findDemande(long id) {
    var rows =
        jdbc.query(
            """
            SELECT id, date_reference, statut, commentaire, motif_rejet,
                   cree_par, cree_le, modifie_par, modifie_le,
                   soumise_par, soumise_le, validee_par, validee_le,
                   rejetee_par, rejetee_le
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
               libelle_solde, solde_08h, montant_propose, montant_valide,
               coalesce(montant_paye, 0) AS montant_paye
        FROM lignes_demande_approvisionnement_vas
        WHERE demande_id = ?
        ORDER BY id
        """,
        LIGNE_ROW,
        demandeId);
  }

  public Optional<LigneRow> findLigne(long ligneId) {
    var rows =
        jdbc.query(
            """
            SELECT id, demande_id, produit_id, operateur, produit_libelle, devise, date_reference,
                   j1_debut, j1_fin, j2_debut, j2_fin,
                   depots_j1, retraits_j1, consommation_j1,
                   depots_j2, retraits_j2, consommation_j2, moyenne,
                   libelle_solde, solde_08h, montant_propose, montant_valide,
                   coalesce(montant_paye, 0) AS montant_paye
            FROM lignes_demande_approvisionnement_vas
            WHERE id = ?
            """,
            LIGNE_ROW,
            ligneId);
    return rows.stream().findFirst();
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
                    (date_reference, statut, commentaire, cree_par, cree_le, modifie_par, modifie_le)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          ps.setDate(1, Date.valueOf(dateReference));
          ps.setString(2, statut);
          ps.setString(3, commentaire);
          setNullableInt(ps, 4, creePar);
          ps.setTimestamp(5, Timestamp.from(now));
          setNullableInt(ps, 6, creePar);
          ps.setTimestamp(7, Timestamp.from(now));
          return ps;
        },
        keys);
    var map = keys.getKeys();
    if (map == null || map.get("id") == null) {
      throw new IllegalStateException("demande id manquant");
    }
    return ((Number) map.get("id")).longValue();
  }

  public void updateDemandeContent(
      long id,
      LocalDate dateReference,
      String commentaire,
      Integer modifiePar,
      Instant now) {
    jdbc.update(
        """
        UPDATE demandes_approvisionnement_vas
        SET date_reference = ?, commentaire = ?, modifie_par = ?, modifie_le = ?
        WHERE id = ?
        """,
        Date.valueOf(dateReference),
        commentaire,
        modifiePar,
        Timestamp.from(now),
        id);
  }

  public void updateStatut(
      long id,
      String statut,
      Integer modifiePar,
      Instant now,
      Integer soumisePar,
      Instant soumiseLe,
      Integer valideePar,
      Instant valideeLe,
      Integer rejeteePar,
      Instant rejeteeLe,
      String motifRejet) {
    jdbc.update(
        """
        UPDATE demandes_approvisionnement_vas
        SET statut = ?,
            modifie_par = ?,
            modifie_le = ?,
            soumise_par = coalesce(?, soumise_par),
            soumise_le = coalesce(?, soumise_le),
            validee_par = coalesce(?, validee_par),
            validee_le = coalesce(?, validee_le),
            rejetee_par = coalesce(?, rejetee_par),
            rejetee_le = coalesce(?, rejetee_le),
            motif_rejet = coalesce(?, motif_rejet)
        WHERE id = ?
        """,
        statut,
        modifiePar,
        Timestamp.from(now),
        soumisePar,
        soumiseLe == null ? null : Timestamp.from(soumiseLe),
        valideePar,
        valideeLe == null ? null : Timestamp.from(valideeLe),
        rejeteePar,
        rejeteeLe == null ? null : Timestamp.from(rejeteeLe),
        motifRejet,
        id);
  }

  public void insertHistorique(
      long demandeId,
      String ancienStatut,
      String nouveauStatut,
      Integer utilisateurId,
      String commentaire,
      Instant now) {
    jdbc.update(
        """
        INSERT INTO historique_statuts_approvisionnement
          (demande_id, ancien_statut, nouveau_statut, utilisateur_id, commentaire, cree_le)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        demandeId,
        ancienStatut,
        nouveauStatut,
        utilisateurId,
        commentaire,
        Timestamp.from(now));
  }

  public List<HistoriqueRow> listHistorique(long demandeId) {
    return jdbc.query(
        """
        SELECT id, demande_id, ancien_statut, nouveau_statut, utilisateur_id, commentaire, cree_le
        FROM historique_statuts_approvisionnement
        WHERE demande_id = ?
        ORDER BY cree_le ASC, id ASC
        """,
        (rs, i) ->
            new HistoriqueRow(
                rs.getLong("id"),
                rs.getLong("demande_id"),
                rs.getString("ancien_statut"),
                rs.getString("nouveau_statut"),
                (Integer) rs.getObject("utilisateur_id"),
                rs.getString("commentaire"),
                rs.getTimestamp("cree_le").toInstant()),
        demandeId);
  }

  public void deleteLignes(long demandeId) {
    jdbc.update("DELETE FROM lignes_demande_approvisionnement_vas WHERE demande_id = ?", demandeId);
  }

  public long insertLigne(long demandeId, LigneInsert row) {
    var keys = new GeneratedKeyHolder();
    jdbc.update(
        con -> {
          PreparedStatement ps =
              con.prepareStatement(
                  """
                  INSERT INTO lignes_demande_approvisionnement_vas (
                    demande_id, produit_id, operateur, produit_libelle, devise, date_reference,
                    j1_debut, j1_fin, j2_debut, j2_fin,
                    depots_j1, retraits_j1, consommation_j1,
                    depots_j2, retraits_j2, consommation_j2, moyenne,
                    libelle_solde, solde_08h, montant_propose, montant_valide, montant_paye
                  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          int i = 1;
          ps.setLong(i++, demandeId);
          ps.setInt(i++, row.produitId());
          ps.setString(i++, row.operateur());
          ps.setString(i++, row.produitLibelle());
          ps.setString(i++, row.devise());
          ps.setDate(i++, Date.valueOf(row.dateReference()));
          ps.setDate(i++, Date.valueOf(row.j1Debut()));
          ps.setDate(i++, Date.valueOf(row.j1Fin()));
          ps.setDate(i++, Date.valueOf(row.j2Debut()));
          ps.setDate(i++, Date.valueOf(row.j2Fin()));
          ps.setBigDecimal(i++, row.depotsJ1());
          ps.setBigDecimal(i++, row.retraitsJ1());
          ps.setBigDecimal(i++, row.consommationJ1());
          ps.setBigDecimal(i++, row.depotsJ2());
          ps.setBigDecimal(i++, row.retraitsJ2());
          ps.setBigDecimal(i++, row.consommationJ2());
          ps.setBigDecimal(i++, row.moyenne());
          ps.setString(i++, row.libelleSolde());
          ps.setBigDecimal(i++, row.solde08h());
          ps.setBigDecimal(i++, row.montantPropose());
          ps.setBigDecimal(i++, row.montantValide());
          ps.setBigDecimal(i++, row.montantPaye());
          return ps;
        },
        keys);
    var map = keys.getKeys();
    if (map == null || map.get("id") == null) {
      throw new IllegalStateException("ligne id manquant");
    }
    return ((Number) map.get("id")).longValue();
  }

  public long insertPaiement(
      long ligneId,
      BigDecimal montant,
      String devise,
      LocalDate datePaiement,
      String modePaiement,
      String reference,
      String commentaire,
      Integer utilisateurId,
      Instant now) {
    var keys = new GeneratedKeyHolder();
    jdbc.update(
        con -> {
          PreparedStatement ps =
              con.prepareStatement(
                  """
                  INSERT INTO paiements_recharge
                    (ligne_id, montant, devise, date_paiement, mode_paiement,
                     reference_paiement, commentaire, utilisateur_id, cree_le, modifie_le)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          ps.setLong(1, ligneId);
          ps.setBigDecimal(2, montant);
          ps.setString(3, devise);
          ps.setDate(4, Date.valueOf(datePaiement));
          ps.setString(5, modePaiement);
          ps.setString(6, reference);
          ps.setString(7, commentaire);
          setNullableInt(ps, 8, utilisateurId);
          ps.setTimestamp(9, Timestamp.from(now));
          ps.setTimestamp(10, Timestamp.from(now));
          return ps;
        },
        keys);
    var map = keys.getKeys();
    if (map == null || map.get("id") == null) {
      throw new IllegalStateException("paiement id manquant");
    }
    return ((Number) map.get("id")).longValue();
  }

  public List<PaiementRow> listPaiementsByLigne(long ligneId) {
    return jdbc.query(
        """
        SELECT id, ligne_id, montant, devise, date_paiement, mode_paiement,
               reference_paiement, commentaire, utilisateur_id, cree_le
        FROM paiements_recharge
        WHERE ligne_id = ?
        ORDER BY date_paiement DESC, id DESC
        """,
        PAIEMENT_ROW,
        ligneId);
  }

  public List<PaiementRow> listPaiementsByDemande(long demandeId) {
    return jdbc.query(
        """
        SELECT p.id, p.ligne_id, p.montant, p.devise, p.date_paiement, p.mode_paiement,
               p.reference_paiement, p.commentaire, p.utilisateur_id, p.cree_le
        FROM paiements_recharge p
        JOIN lignes_demande_approvisionnement_vas l ON l.id = p.ligne_id
        WHERE l.demande_id = ?
        ORDER BY p.date_paiement DESC, p.id DESC
        """,
        PAIEMENT_ROW,
        demandeId);
  }

  public BigDecimal sumPaiementsLigne(long ligneId) {
    BigDecimal v =
        jdbc.query(
                "SELECT coalesce(sum(montant), 0) AS s FROM paiements_recharge WHERE ligne_id = ?",
                (rs, i) -> rs.getBigDecimal("s"),
                ligneId)
            .stream()
            .findFirst()
            .orElse(BigDecimal.ZERO);
    return scale(v);
  }

  public void refreshMontantPayeLigne(long ligneId) {
    jdbc.update(
        """
        UPDATE lignes_demande_approvisionnement_vas
        SET montant_paye = (
          SELECT coalesce(sum(montant), 0) FROM paiements_recharge WHERE ligne_id = ?
        )
        WHERE id = ?
        """,
        ligneId,
        ligneId);
  }

  public long insertReleveSolde(
      int produitId,
      String operateur,
      String produitLibelle,
      String devise,
      BigDecimal solde,
      Instant releveLe,
      Integer utilisateurId,
      String commentaire,
      Instant now) {
    var keys = new GeneratedKeyHolder();
    jdbc.update(
        con -> {
          PreparedStatement ps =
              con.prepareStatement(
                  """
                  INSERT INTO releves_soldes_vas
                    (produit_id, operateur, produit_libelle, devise, solde, releve_le,
                     utilisateur_id, commentaire, cree_le)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          ps.setInt(1, produitId);
          ps.setString(2, operateur);
          ps.setString(3, produitLibelle);
          ps.setString(4, devise);
          ps.setBigDecimal(5, solde);
          ps.setTimestamp(6, Timestamp.from(releveLe));
          setNullableInt(ps, 7, utilisateurId);
          ps.setString(8, commentaire);
          ps.setTimestamp(9, Timestamp.from(now));
          return ps;
        },
        keys);
    var map = keys.getKeys();
    if (map == null || map.get("id") == null) {
      throw new IllegalStateException("releve id manquant");
    }
    return ((Number) map.get("id")).longValue();
  }

  public List<ReleveRow> listDerniersSoldes() {
    return jdbc.query(
        """
        SELECT DISTINCT ON (produit_id, devise)
               id, produit_id, operateur, produit_libelle, devise, solde,
               releve_le, utilisateur_id, commentaire, cree_le
        FROM releves_soldes_vas
        ORDER BY produit_id, devise, releve_le DESC, id DESC
        """,
        RELEVE_ROW);
  }

  public void upsertSeuil(
      int produitId,
      String operateur,
      String produitLibelle,
      String devise,
      BigDecimal attention,
      BigDecimal critique,
      Integer modifiePar,
      Instant now) {
    jdbc.update(
        """
        INSERT INTO seuils_alerte_soldes_vas
          (produit_id, operateur, produit_libelle, devise, seuil_attention, seuil_critique, modifie_par, modifie_le)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (produit_id, devise) DO UPDATE SET
          operateur = EXCLUDED.operateur,
          produit_libelle = EXCLUDED.produit_libelle,
          seuil_attention = EXCLUDED.seuil_attention,
          seuil_critique = EXCLUDED.seuil_critique,
          modifie_par = EXCLUDED.modifie_par,
          modifie_le = EXCLUDED.modifie_le
        """,
        produitId,
        operateur,
        produitLibelle,
        devise,
        attention,
        critique,
        modifiePar,
        Timestamp.from(now));
  }

  public List<SeuilRow> listSeuils() {
    return jdbc.query(
        """
        SELECT id, produit_id, operateur, produit_libelle, devise,
               seuil_attention, seuil_critique, modifie_le
        FROM seuils_alerte_soldes_vas
        ORDER BY operateur, devise
        """,
        (rs, i) ->
            new SeuilRow(
                rs.getLong("id"),
                rs.getInt("produit_id"),
                rs.getString("operateur"),
                rs.getString("produit_libelle"),
                rs.getString("devise"),
                scale(rs.getBigDecimal("seuil_attention")),
                scale(rs.getBigDecimal("seuil_critique")),
                rs.getTimestamp("modifie_le").toInstant()));
  }

  public DashboardAggRow dashboardAgg() {
    return jdbc.query(
            """
            SELECT
              coalesce(sum(l.montant_propose) FILTER (WHERE l.devise = 'USD'), 0) AS propose_usd,
              coalesce(sum(l.montant_propose) FILTER (WHERE l.devise = 'CDF'), 0) AS propose_cdf,
              coalesce(sum(l.montant_valide) FILTER (WHERE l.devise = 'USD'), 0) AS valide_usd,
              coalesce(sum(l.montant_valide) FILTER (WHERE l.devise = 'CDF'), 0) AS valide_cdf,
              coalesce(sum(l.montant_paye) FILTER (WHERE l.devise = 'USD'), 0) AS paye_usd,
              coalesce(sum(l.montant_paye) FILTER (WHERE l.devise = 'CDF'), 0) AS paye_cdf
            FROM lignes_demande_approvisionnement_vas l
            JOIN demandes_approvisionnement_vas d ON d.id = l.demande_id
            WHERE d.statut <> 'annulee'
            """,
            (rs, i) ->
                new DashboardAggRow(
                    scale(rs.getBigDecimal("propose_usd")),
                    scale(rs.getBigDecimal("propose_cdf")),
                    scale(rs.getBigDecimal("valide_usd")),
                    scale(rs.getBigDecimal("valide_cdf")),
                    scale(rs.getBigDecimal("paye_usd")),
                    scale(rs.getBigDecimal("paye_cdf"))))
        .stream()
        .findFirst()
        .orElse(
            new DashboardAggRow(
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO));
  }

  public int countByStatut(String statut) {
    Integer n =
        jdbc.queryForObject(
            "SELECT count(*)::int FROM demandes_approvisionnement_vas WHERE statut = ?",
            Integer.class,
            statut);
    return n == null ? 0 : n;
  }

  public int countStatutsIn(List<String> statuts) {
    if (statuts == null || statuts.isEmpty()) {
      return 0;
    }
    String placeholders = String.join(",", statuts.stream().map(s -> "?").toList());
    Object[] args = statuts.toArray();
    Integer n =
        jdbc.queryForObject(
            "SELECT count(*)::int FROM demandes_approvisionnement_vas WHERE statut IN ("
                + placeholders
                + ")",
            Integer.class,
            args);
    return n == null ? 0 : n;
  }

  public List<DemandeHeaderRow> listOuvertesPourDelai() {
    return jdbc.query(
        """
        SELECT id, date_reference, statut, commentaire, motif_rejet,
               cree_par, cree_le, modifie_par, modifie_le,
               soumise_par, soumise_le, validee_par, validee_le,
               rejetee_par, rejetee_le
        FROM demandes_approvisionnement_vas
        WHERE statut IN ('soumise', 'en_attente_validation', 'validee', 'en_attente_paiement', 'partiellement_payee')
        """,
        DEMANDE_HEADER);
  }

  public static BigDecimal scale(BigDecimal v) {
    return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
  }

  public static BigDecimal moyenne(BigDecimal j1, BigDecimal j2) {
    return scale(j1.add(j2).divide(BigDecimal.valueOf(2), 6, RoundingMode.HALF_UP));
  }

  private static void setNullableInt(PreparedStatement ps, int idx, Integer value)
      throws java.sql.SQLException {
    if (value == null) {
      ps.setObject(idx, null);
    } else {
      ps.setInt(idx, value);
    }
  }

  private static final RowMapper<DemandeListRow> DEMANDE_LIST_ROW =
      (rs, i) ->
          new DemandeListRow(
              rs.getLong("id"),
              rs.getDate("date_reference").toLocalDate(),
              rs.getString("statut"),
              rs.getInt("nb_lignes"),
              rs.getTimestamp("cree_le").toInstant(),
              rs.getTimestamp("soumise_le") == null
                  ? null
                  : rs.getTimestamp("soumise_le").toInstant(),
              scale(rs.getBigDecimal("total_propose_usd")),
              scale(rs.getBigDecimal("total_propose_cdf")));

  private static final RowMapper<DemandeHeaderRow> DEMANDE_HEADER =
      (rs, i) ->
          new DemandeHeaderRow(
              rs.getLong("id"),
              rs.getDate("date_reference").toLocalDate(),
              rs.getString("statut"),
              rs.getString("commentaire"),
              rs.getString("motif_rejet"),
              (Integer) rs.getObject("cree_par"),
              rs.getTimestamp("cree_le").toInstant(),
              (Integer) rs.getObject("modifie_par"),
              rs.getTimestamp("modifie_le").toInstant(),
              (Integer) rs.getObject("soumise_par"),
              rs.getTimestamp("soumise_le") == null
                  ? null
                  : rs.getTimestamp("soumise_le").toInstant(),
              (Integer) rs.getObject("validee_par"),
              rs.getTimestamp("validee_le") == null
                  ? null
                  : rs.getTimestamp("validee_le").toInstant(),
              (Integer) rs.getObject("rejetee_par"),
              rs.getTimestamp("rejetee_le") == null
                  ? null
                  : rs.getTimestamp("rejetee_le").toInstant());

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
              rs.getString("libelle_solde"),
              rs.getBigDecimal("solde_08h"),
              rs.getBigDecimal("montant_propose"),
              rs.getBigDecimal("montant_valide"),
              rs.getBigDecimal("montant_paye"));

  private static final RowMapper<PaiementRow> PAIEMENT_ROW =
      (rs, i) ->
          new PaiementRow(
              rs.getLong("id"),
              rs.getLong("ligne_id"),
              scale(rs.getBigDecimal("montant")),
              rs.getString("devise"),
              rs.getDate("date_paiement").toLocalDate(),
              rs.getString("mode_paiement"),
              rs.getString("reference_paiement"),
              rs.getString("commentaire"),
              (Integer) rs.getObject("utilisateur_id"),
              rs.getTimestamp("cree_le").toInstant());

  private static final RowMapper<ReleveRow> RELEVE_ROW =
      (rs, i) ->
          new ReleveRow(
              rs.getLong("id"),
              rs.getInt("produit_id"),
              rs.getString("operateur"),
              rs.getString("produit_libelle"),
              rs.getString("devise"),
              scale(rs.getBigDecimal("solde")),
              rs.getTimestamp("releve_le").toInstant(),
              (Integer) rs.getObject("utilisateur_id"),
              rs.getString("commentaire"),
              rs.getTimestamp("cree_le").toInstant());

  public record ProduitMmRow(
      int produitId, String module, String produit, String ecran, String partenaire) {}

  public record TotauxPeriode(BigDecimal depots, BigDecimal retraits, BigDecimal consommation) {}

  public record DemandeListRow(
      long id,
      LocalDate dateReference,
      String statut,
      int nbLignes,
      Instant creeLe,
      Instant soumiseLe,
      BigDecimal totalProposeUsd,
      BigDecimal totalProposeCdf) {}

  public record DemandeHeaderRow(
      long id,
      LocalDate dateReference,
      String statut,
      String commentaire,
      String motifRejet,
      Integer creePar,
      Instant creeLe,
      Integer modifiePar,
      Instant modifieLe,
      Integer soumisePar,
      Instant soumiseLe,
      Integer valideePar,
      Instant valideeLe,
      Integer rejeteePar,
      Instant rejeteeLe) {}

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
      String libelleSolde,
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
      String libelleSolde,
      BigDecimal solde08h,
      BigDecimal montantPropose,
      BigDecimal montantValide,
      BigDecimal montantPaye) {}

  public record HistoriqueRow(
      long id,
      long demandeId,
      String ancienStatut,
      String nouveauStatut,
      Integer utilisateurId,
      String commentaire,
      Instant creeLe) {}

  public record PaiementRow(
      long id,
      long ligneId,
      BigDecimal montant,
      String devise,
      LocalDate datePaiement,
      String modePaiement,
      String referencePaiement,
      String commentaire,
      Integer utilisateurId,
      Instant creeLe) {}

  public record ReleveRow(
      long id,
      int produitId,
      String operateur,
      String produitLibelle,
      String devise,
      BigDecimal solde,
      Instant releveLe,
      Integer utilisateurId,
      String commentaire,
      Instant creeLe) {}

  public record SeuilRow(
      long id,
      int produitId,
      String operateur,
      String produitLibelle,
      String devise,
      BigDecimal seuilAttention,
      BigDecimal seuilCritique,
      Instant modifieLe) {}

  public record DashboardAggRow(
      BigDecimal proposeUsd,
      BigDecimal proposeCdf,
      BigDecimal valideUsd,
      BigDecimal valideCdf,
      BigDecimal payeUsd,
      BigDecimal payeCdf) {}
}
