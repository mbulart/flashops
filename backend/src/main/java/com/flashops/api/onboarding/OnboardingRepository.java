package com.flashops.api.onboarding;

import com.flashops.api.web.dto.OnboardingDtos;
import com.flashops.api.web.dto.OnboardingDtos.Candidature;
import com.flashops.api.web.dto.OnboardingDtos.CandidatureDraft;
import com.flashops.api.web.dto.OnboardingDtos.Document;
import com.flashops.api.web.dto.OnboardingDtos.Entreprise;
import com.flashops.api.web.dto.OnboardingDtos.Option;
import com.flashops.api.web.dto.OnboardingDtos.PointVente;
import com.flashops.api.web.dto.OnboardingDtos.Representant;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class OnboardingRepository {
  private final JdbcTemplate jdbc;

  public OnboardingRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public OnboardingDtos.Referentiels referentiels() {
    return new OnboardingDtos.Referentiels(
        options("onboarding.categories_distributeur", false, false),
        options("onboarding.types_candidat", false, false),
        options("onboarding.services", true, false),
        options("onboarding.types_document", false, true),
        options("onboarding.types_piece_identite", false, false),
        options("onboarding.formes_juridiques", false, false));
  }

  private List<Option> options(String table, boolean famille, boolean obligatoire) {
    String extra =
        (famille ? ", famille" : ", NULL::varchar AS famille")
            + (obligatoire ? ", obligatoire" : ", NULL::boolean AS obligatoire");
    return jdbc.query(
        "SELECT id, code, libelle" + extra + " FROM " + table
            + " WHERE actif ORDER BY " + (table.contains("types_piece") ? "libelle" : "ordre, libelle"),
        (rs, n) ->
            new Option(
                rs.getObject("id"),
                rs.getString("code"),
                rs.getString("libelle"),
                rs.getString("famille"),
                (Boolean) rs.getObject("obligatoire")));
  }

  public long create(CandidatureDraft body) {
    String reference =
        jdbc.queryForObject(
            "SELECT 'SAG-' || to_char(CURRENT_DATE,'YYYY') || '-' || "
                + "lpad(nextval('onboarding.candidature_ref_seq')::text, 6, '0')",
            String.class);
    String token = UUID.randomUUID().toString().replace("-", "");
    Long id =
        jdbc.queryForObject(
            """
            INSERT INTO onboarding.candidatures
              (reference, jeton_suivi, email, telephone)
            VALUES (?, ?, ?, ?) RETURNING id
            """,
            Long.class,
            reference,
            token,
            clean(body.email()),
            clean(body.telephone()));
    if (id == null) throw new IllegalStateException("Candidature non créée");
    saveDraft(id, body);
    return id;
  }

  public boolean tokenMatches(long id, String token, boolean draftOnly) {
    Long count =
        jdbc.queryForObject(
            "SELECT count(*) FROM onboarding.candidatures WHERE id=? AND jeton_suivi=?"
                + (draftOnly ? " AND statut_admin='brouillon'" : ""),
            Long.class,
            id,
            clean(token));
    return count != null && count > 0;
  }

  public void saveDraft(long id, CandidatureDraft body) {
    Entreprise e = body.entreprise();
    jdbc.update(
        """
        UPDATE onboarding.candidatures SET email=?, telephone=?,
          raison_sociale=?, nom_commercial=?, forme_juridique=?, rccm=?, idnat=?,
          numero_impot=?, adresse_siege=?, ville=?, province=?, commune=?, modifie_le=NOW()
        WHERE id=?
        """,
        clean(body.email()),
        clean(body.telephone()),
        e == null ? null : clean(e.raisonSociale()),
        e == null ? null : clean(e.nomCommercial()),
        e == null ? null : clean(e.formeJuridique()),
        e == null ? null : clean(e.rccm()),
        e == null ? null : clean(e.idNat()),
        e == null ? null : clean(e.nif()),
        e == null ? null : clean(e.adresse()),
        e == null ? null : clean(e.ville()),
        e == null ? null : clean(e.province()),
        e == null ? null : clean(e.commune()),
        id);

    jdbc.update("DELETE FROM onboarding.representants WHERE candidature_id=?", id);
    Representant r = body.representant();
    if (r != null) {
      jdbc.update(
          """
          INSERT INTO onboarding.representants
            (candidature_id, nom, prenom, telephone, email, fonction, numero_piece)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          """,
          id, safe(r.nom()), safe(r.prenom()), clean(r.telephone()), clean(r.email()),
          clean(r.fonction()), clean(r.pieceIdentite()));
    }

    jdbc.update("DELETE FROM onboarding.candidature_services WHERE candidature_id=?", id);
    for (String code : safeList(body.services())) {
      jdbc.update(
          """
          INSERT INTO onboarding.candidature_services(candidature_id, service_id)
          SELECT ?, id FROM onboarding.services WHERE code=? AND actif
          ON CONFLICT DO NOTHING
          """,
          id, code);
    }

    jdbc.update("DELETE FROM onboarding.points_vente WHERE candidature_id=?", id);
    int ordre = 0;
    for (PointVente p : safeList(body.pointsVente())) {
      jdbc.update(
          """
          INSERT INTO onboarding.points_vente
            (candidature_id, est_principal, nom_commercial, adresse, ville, province, commune, telephone, ordre)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          """,
          id, p.principal(), safe(p.nom()), clean(p.adresse()), clean(p.ville()),
          clean(p.province()), clean(p.commune()), clean(p.telephone()), ordre++);
    }

    for (Document d : safeList(body.documents())) {
      if (d.typeCode() == null || d.typeCode().isBlank()) continue;
      int kept =
          jdbc.update(
              """
              UPDATE onboarding.documents d SET commentaire=?
              FROM onboarding.types_document td
              WHERE d.type_document_id=td.id AND d.candidature_id=? AND td.code=?
                AND d.chemin_stockage NOT LIKE 'pending/%'
              """,
              clean(d.note()), id, d.typeCode());
      if (kept > 0) continue;
      jdbc.update(
          """
          DELETE FROM onboarding.documents d
          USING onboarding.types_document td
          WHERE d.type_document_id=td.id AND d.candidature_id=? AND td.code=?
          """,
          id, d.typeCode());
      jdbc.update(
          """
          INSERT INTO onboarding.documents
            (candidature_id, type_document_id, nom_fichier, chemin_stockage, statut, commentaire)
          SELECT ?, td.id, ?, ?, 'non_fourni', ? FROM onboarding.types_document td WHERE td.code=?
          """,
          id, d.typeCode(), "pending/" + id + "/" + d.typeCode(), clean(d.note()), d.typeCode());
    }
  }

  public OnboardingDtos.FichierMeta fichier(long candidatureId, String typeCode) {
    return jdbc.query(
            """
            SELECT d.chemin_stockage, d.nom_fichier, d.content_type
            FROM onboarding.documents d
            JOIN onboarding.types_document td ON td.id=d.type_document_id
            WHERE d.candidature_id=? AND td.code=?
              AND d.chemin_stockage NOT LIKE 'pending/%'
            ORDER BY d.id DESC LIMIT 1
            """,
            (rs, n) ->
                new OnboardingDtos.FichierMeta(rs.getString(1), rs.getString(2), rs.getString(3)),
            candidatureId,
            typeCode)
        .stream()
        .findFirst()
        .orElse(null);
  }

  public boolean attachFichier(
      long candidatureId,
      String typeCode,
      String filename,
      String relativePath,
      String contentType,
      long size) {
    Integer typeId =
        jdbc.query(
                "SELECT id FROM onboarding.types_document WHERE code=? AND actif",
                (rs, n) -> rs.getInt(1),
                typeCode)
            .stream()
            .findFirst()
            .orElse(null);
    if (typeId == null) return false;
    jdbc.update(
        """
        DELETE FROM onboarding.documents
        WHERE candidature_id=? AND type_document_id=?
        """,
        candidatureId, typeId);
    jdbc.update(
        """
        INSERT INTO onboarding.documents
          (candidature_id, type_document_id, nom_fichier, chemin_stockage, content_type,
           taille_octets, statut, depose_par_public)
        VALUES (?, ?, ?, ?, ?, ?, 'fourni', TRUE)
        """,
        candidatureId, typeId, filename, relativePath, contentType, size);
    return true;
  }

  public String retirerFichier(long candidatureId, String typeCode) {
    OnboardingDtos.FichierMeta meta = fichier(candidatureId, typeCode);
    jdbc.update(
        """
        DELETE FROM onboarding.documents d
        USING onboarding.types_document td
        WHERE d.type_document_id=td.id AND d.candidature_id=? AND td.code=?
        """,
        candidatureId, typeCode);
    jdbc.update(
        """
        INSERT INTO onboarding.documents
          (candidature_id, type_document_id, nom_fichier, chemin_stockage, statut)
        SELECT ?, td.id, td.code, ?, 'non_fourni' FROM onboarding.types_document td WHERE td.code=?
        """,
        candidatureId, "pending/" + candidatureId + "/" + typeCode, typeCode);
    return meta == null ? null : meta.chemin();
  }

  public void markSubmitted(long id) {
    jdbc.update(
        "UPDATE onboarding.candidatures SET statut_admin='soumise', soumise_le=NOW(), modifie_le=NOW() WHERE id=?",
        id);
  }

  public void updateStatus(long id, String status) {
    jdbc.update(
        "UPDATE onboarding.candidatures SET statut_admin=?, modifie_le=NOW() WHERE id=?",
        status, id);
  }

  public Candidature get(long id, boolean includeInternal, boolean includeToken) {
    List<Candidature> rows =
        jdbc.query(
            """
            SELECT c.*, wi.id instance_id, n.code etape_code,
              coalesce(n.libelle_candidat,n.nom) etape_libelle,
              n.ordre_affichage, mx.max_ordre
            FROM onboarding.candidatures c
            LEFT JOIN workflow.instances wi ON wi.domaine='onboarding'
              AND wi.type_dossier='candidature_sag' AND wi.dossier_id=c.id
            LEFT JOIN workflow.nodes n ON n.id=wi.node_actif_id
            LEFT JOIN LATERAL (
              SELECT max(ordre_affichage) max_ordre FROM workflow.nodes
              WHERE version_id=wi.version_id
            ) mx ON TRUE
            WHERE c.id=?
            """,
            (rs, n) -> mapCandidature(rs, includeInternal, includeToken),
            id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "candidature introuvable");
    return rows.getFirst();
  }

  public Candidature track(String reference, String token) {
    Long id =
        jdbc.query(
                "SELECT id FROM onboarding.candidatures WHERE upper(reference)=upper(?) AND jeton_suivi=?",
                (rs, n) -> rs.getLong(1), clean(reference), clean(token))
            .stream()
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "suivi introuvable"));
    return get(id, false, true);
  }

  public boolean delete(long id) {
    Integer exists =
        jdbc.query(
                "SELECT 1 FROM onboarding.candidatures WHERE id=?",
                (rs, n) -> 1,
                id)
            .stream()
            .findFirst()
            .orElse(null);
    if (exists == null) {
      return false;
    }
    // Instances workflow (tasks / action_logs en cascade) — pas de FK physique vers candidatures.
    jdbc.update(
        "DELETE FROM workflow.instances WHERE domaine='onboarding' AND dossier_id=?", id);
    jdbc.update("DELETE FROM onboarding.candidatures WHERE id=?", id);
    return true;
  }

  public OnboardingDtos.CandidaturePage list(String q, String statut, int page, int size) {
    int safePage = Math.max(1, page);
    int safeSize = Math.min(200, Math.max(1, size));
    var where = new StringBuilder(" WHERE 1=1");
    var args = new ArrayList<Object>();
    if (q != null && !q.isBlank()) {
      where.append(" AND (c.reference ILIKE ? OR c.raison_sociale ILIKE ? OR c.email ILIKE ?)");
      String like = "%" + q.trim() + "%";
      args.add(like); args.add(like); args.add(like);
    }
    if (statut != null && !statut.isBlank()) {
      where.append(" AND c.statut_admin=?");
      args.add(statut.trim());
    }
    Long total = jdbc.queryForObject("SELECT count(*) FROM onboarding.candidatures c" + where,
        Long.class, args.toArray());
    var pageArgs = new ArrayList<>(args);
    pageArgs.add(safeSize);
    pageArgs.add((safePage - 1L) * safeSize);
    List<Long> ids = jdbc.query(
        "SELECT c.id FROM onboarding.candidatures c" + where
            + " ORDER BY c.cree_le DESC LIMIT ? OFFSET ?",
        (rs, n) -> rs.getLong(1), pageArgs.toArray());
    List<Candidature> items = ids.stream().map(id -> get(id, false, false)).toList();
    return new OnboardingDtos.CandidaturePage(items, total == null ? 0 : total, safePage, safeSize);
  }

  private Candidature mapCandidature(ResultSet rs, boolean internal, boolean token)
      throws SQLException {
    long id = rs.getLong("id");
    Long instanceId = (Long) rs.getObject("instance_id");
    int max = rs.getObject("max_ordre") == null ? 100 : rs.getInt("max_ordre");
    int order = rs.getObject("ordre_affichage") == null ? 0 : rs.getInt("ordre_affichage");
    int progress = Math.min(100, Math.max(0, max == 0 ? 0 : order * 100 / max));
    return new Candidature(
        id, rs.getString("reference"), token ? rs.getString("jeton_suivi") : null,
        rs.getString("statut_admin"), rs.getString("etape_libelle"), progress,
        rs.getString("email"), rs.getString("telephone"), representative(id),
        new Entreprise(rs.getString("raison_sociale"), rs.getString("nom_commercial"),
            rs.getString("forme_juridique"), rs.getString("rccm"), rs.getString("idnat"),
            rs.getString("numero_impot"), rs.getString("adresse_siege"), rs.getString("ville"),
            rs.getString("province"), rs.getString("commune")),
        services(id), outlets(id), documents(id),
        instanceId == null ? List.of() : history(instanceId, internal),
        instanceId == null ? List.of() : actions(instanceId),
        rs.getObject("cree_le", OffsetDateTime.class),
        rs.getObject("modifie_le", OffsetDateTime.class),
        rs.getObject("soumise_le", OffsetDateTime.class));
  }

  private Representant representative(long id) {
    return jdbc.query(
            """
            SELECT nom, prenom, telephone, email, fonction, numero_piece
            FROM onboarding.representants WHERE candidature_id=?
            ORDER BY est_principal DESC, id LIMIT 1
            """,
            (rs, n) -> new Representant(rs.getString(1), rs.getString(2), rs.getString(3),
                rs.getString(4), rs.getString(5), rs.getString(6)), id)
        .stream().findFirst().orElse(new Representant("", "", null, null, null, null));
  }

  private List<String> services(long id) {
    return jdbc.query(
        """
        SELECT s.code FROM onboarding.candidature_services cs
        JOIN onboarding.services s ON s.id=cs.service_id
        WHERE cs.candidature_id=? ORDER BY s.ordre
        """, (rs, n) -> rs.getString(1), id);
  }

  private List<PointVente> outlets(long id) {
    return jdbc.query(
        """
        SELECT id, nom_commercial, adresse, ville, province, commune, telephone, est_principal
        FROM onboarding.points_vente WHERE candidature_id=? ORDER BY ordre,id
        """,
        (rs, n) -> new PointVente(rs.getLong(1), rs.getString(2), rs.getString(3),
            rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7), rs.getBoolean(8)), id);
  }

  private List<Document> documents(long id) {
    return jdbc.query(
        """
        SELECT d.id, td.code, td.libelle, d.nom_fichier, d.statut, d.commentaire,
          d.content_type, d.chemin_stockage
        FROM onboarding.documents d JOIN onboarding.types_document td ON td.id=d.type_document_id
        WHERE d.candidature_id=? ORDER BY td.ordre,d.id
        """,
        (rs, n) -> {
          String path = rs.getString(8);
          boolean stored = path != null && !path.startsWith("pending/");
          return new Document(rs.getLong(1), rs.getString(2), rs.getString(3),
              stored ? rs.getString(4) : null, rs.getString(5), rs.getString(6),
              rs.getString(7), stored);
        }, id);
  }

  private List<OnboardingDtos.WorkflowHistorique> history(long instanceId, boolean internal) {
    return jdbc.query(
        """
        SELECT coalesce(na.libelle_candidat,na.nom,nb.libelle_candidat,nb.nom) etape,
          coalesce(l.action_libelle,l.action_code), l.commentaire,
          coalesce(u.nom_complet,'Système'), l.cree_le
        FROM workflow.action_logs l
        LEFT JOIN workflow.nodes na ON na.id=l.node_apres_id
        LEFT JOIN workflow.nodes nb ON nb.id=l.node_avant_id
        LEFT JOIN utilisateurs u ON u.id=l.utilisateur_id
        WHERE l.instance_id=? ORDER BY l.cree_le
        """,
        (rs, n) -> new OnboardingDtos.WorkflowHistorique(rs.getString(1), rs.getString(2),
            internal ? rs.getString(3) : null, internal ? rs.getString(4) : null,
            rs.getObject(5, OffsetDateTime.class)), instanceId);
  }

  private List<OnboardingDtos.WorkflowAction> actions(long instanceId) {
    return jdbc.query(
        """
        SELECT a.code,a.libelle,a.commentaire_obligatoire
        FROM workflow.instances i JOIN workflow.transitions t
          ON t.version_id=i.version_id AND t.node_source_id=i.node_actif_id
        JOIN workflow.actions a ON a.id=t.action_id WHERE i.id=? ORDER BY a.id
        """,
        (rs, n) -> new OnboardingDtos.WorkflowAction(rs.getString(1), rs.getString(2),
            rs.getBoolean(3)), instanceId);
  }

  private static String clean(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private static String safe(String value) {
    String clean = clean(value);
    return clean == null ? "" : clean;
  }

  private static <T> List<T> safeList(List<T> value) {
    return value == null ? List.of() : value;
  }
}
