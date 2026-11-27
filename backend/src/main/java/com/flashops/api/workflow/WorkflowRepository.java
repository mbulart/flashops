package com.flashops.api.workflow;

import com.flashops.api.web.dto.OnboardingDtos;
import com.flashops.api.web.dto.WorkflowDtos;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class WorkflowRepository {
  public record Version(long id, long startNodeId) {}
  public record Transition(
      long id, long destinationId, String destinationCode, String destinationName,
      String destinationType, String actionCode, String actionLabel, boolean commentRequired) {}
  public record TaskContext(
      long taskId, long instanceId, long candidatureId, long versionId, long currentNodeId,
      String assignedRole, Integer assignedUserId) {}
  public record ActorRule(String mode, String role, String permission, Integer userId) {}
  public record UserAccess(String role, String email, List<String> permissions) {}

  private final JdbcTemplate jdbc;

  public WorkflowRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Version activeVersion(String definitionCode) {
    return jdbc.query(
            """
            SELECT v.id,n.id FROM workflow.definitions d
            JOIN workflow.versions v ON v.definition_id=d.id AND v.statut='publie'
            JOIN workflow.nodes n ON n.version_id=v.id AND n.type_node='debut'
            WHERE d.code=? AND d.statut='actif'
            ORDER BY v.numero DESC LIMIT 1
            """,
            (rs, n) -> new Version(rs.getLong(1), rs.getLong(2)), definitionCode)
        .stream().findFirst()
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.CONFLICT, "aucun workflow publié actif"));
  }

  public long createInstance(Version version, long candidatureId, String reference) {
    Long id = jdbc.queryForObject(
        """
        INSERT INTO workflow.instances
          (version_id,domaine,type_dossier,dossier_ref,dossier_id,node_actif_id)
        VALUES (?,'onboarding','candidature_sag',?,?,?) RETURNING id
        """, Long.class, version.id(), reference, candidatureId, version.startNodeId());
    if (id == null) throw new IllegalStateException("Instance workflow non créée");
    return id;
  }

  public Transition transition(long versionId, long nodeId, String actionCode) {
    return jdbc.query(
            """
            SELECT t.id,nd.id,nd.code,coalesce(nd.libelle_candidat,nd.nom),nd.type_node,
              a.code,a.libelle,a.commentaire_obligatoire
            FROM workflow.transitions t JOIN workflow.nodes nd ON nd.id=t.node_dest_id
            JOIN workflow.actions a ON a.id=t.action_id
            WHERE t.version_id=? AND t.node_source_id=? AND upper(a.code)=upper(?)
            """,
            (rs, n) -> new Transition(rs.getLong(1), rs.getLong(2), rs.getString(3),
                rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7),
                rs.getBoolean(8)), versionId, nodeId, actionCode)
        .stream().findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "action indisponible"));
  }

  public void move(long instanceId, Transition transition) {
    String status = switch (transition.destinationType()) {
      case "fin_ok" -> "termine_ok";
      case "fin_ko" -> "termine_ko";
      case "attente" -> "en_attente";
      default -> "en_cours";
    };
    jdbc.update(
        """
        UPDATE workflow.instances SET node_actif_id=?, statut=?,
          termine_le=CASE WHEN ? LIKE 'termine_%' THEN NOW() ELSE NULL END
        WHERE id=?
        """, transition.destinationId(), status, status, instanceId);
  }

  public long openTask(long instanceId, long nodeId) {
    ActorRule rule = actorRule(nodeId);
    Long id = jdbc.queryForObject(
        """
        INSERT INTO workflow.tasks
          (instance_id,node_id,affecte_role,affecte_utilisateur_id)
        VALUES (?,?,?,?) RETURNING id
        """, Long.class, instanceId, nodeId, rule.role(), rule.userId());
    return id == null ? 0 : id;
  }

  private ActorRule actorRule(long nodeId) {
    return jdbc.query(
            """
            SELECT mode_affectation,role_code,permission_code,utilisateur_id
            FROM workflow.actor_rules WHERE node_id=? ORDER BY id LIMIT 1
            """,
            (rs, n) -> new ActorRule(rs.getString(1), rs.getString(2), rs.getString(3),
                (Integer) rs.getObject(4)), nodeId)
        .stream().findFirst().orElse(new ActorRule("role", "ONBOARDING", null, null));
  }

  public void log(long instanceId, Long taskId, Transition t, long beforeNodeId,
      Integer userId, String comment) {
    jdbc.update(
        """
        INSERT INTO workflow.action_logs
          (instance_id,task_id,action_code,action_libelle,node_avant_id,node_apres_id,
           utilisateur_id,commentaire)
        VALUES (?,?,?,?,?,?,?,?)
        """, instanceId, taskId, t.actionCode(), t.actionLabel(), beforeNodeId,
        t.destinationId(), userId, comment);
  }

  public TaskContext lockOpenTask(long taskId) {
    return jdbc.query(
            """
            SELECT t.id,t.instance_id,i.dossier_id,i.version_id,i.node_actif_id,
              t.affecte_role,t.affecte_utilisateur_id
            FROM workflow.tasks t JOIN workflow.instances i ON i.id=t.instance_id
            WHERE t.id=? AND t.statut IN ('ouverte','en_cours') FOR UPDATE
            """,
            (rs, n) -> new TaskContext(rs.getLong(1), rs.getLong(2), rs.getLong(3),
                rs.getLong(4), rs.getLong(5), rs.getString(6), (Integer) rs.getObject(7)), taskId)
        .stream().findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "tâche ouverte introuvable"));
  }

  public void closeTask(long taskId, int userId) {
    jdbc.update(
        "UPDATE workflow.tasks SET statut='terminee',terminee_le=NOW(),terminee_par=? WHERE id=?",
        userId, taskId);
  }

  public UserAccess access(int userId) {
    return jdbc.query(
            """
            SELECT r.code, u.courriel FROM utilisateurs u
            JOIN roles r ON r.id=u.role_id WHERE u.id=? AND u.actif
            """, (rs, n) -> new String[] {rs.getString(1), rs.getString(2)}, userId)
        .stream().findFirst()
        .map(row -> new UserAccess(row[0], row[1], jdbc.query(
            """
            SELECT p.code FROM roles_permissions rp JOIN permissions p ON p.id=rp.permission_id
            JOIN utilisateurs u ON u.role_id=rp.role_id WHERE u.id=?
            UNION
            SELECT p.code FROM utilisateurs_permissions up JOIN permissions p ON p.id=up.permission_id
            WHERE up.utilisateur_id=?
            """, (rs, n) -> rs.getString(1), userId, userId)))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthorized"));
  }

  public ActorRule actorRuleForTask(long nodeId) {
    return actorRule(nodeId);
  }

  public List<OnboardingDtos.Task> tasks(int userId) {
    UserAccess access = access(userId);
    boolean all =
        "SUPER_ADMIN".equals(access.role())
            || access.permissions().contains("onboarding.taches.lire");
    return jdbc.query(
        """
        SELECT t.id,i.dossier_id,c.reference,n.nom,n.code,t.statut,t.affecte_role,
          t.echeance_le,i.id instance_id
        FROM workflow.tasks t JOIN workflow.instances i ON i.id=t.instance_id
        JOIN workflow.nodes n ON n.id=t.node_id
        JOIN onboarding.candidatures c ON c.id=i.dossier_id
        WHERE t.statut IN ('ouverte','en_cours')
          AND (? OR t.affecte_utilisateur_id=? OR t.affecte_role=?)
        ORDER BY t.priorite,t.cree_le
        """,
        (rs, n) -> new OnboardingDtos.Task(
            rs.getLong("id"), rs.getLong("dossier_id"), rs.getString("reference"),
            rs.getString("nom"), rs.getString("code"), rs.getString("statut"),
            rs.getString("affecte_role"),
            rs.getObject("echeance_le") == null ? null
                : rs.getObject("echeance_le", OffsetDateTime.class).toString(),
            availableActions(rs.getLong("instance_id"))),
        all, userId, access.role());
  }

  private List<OnboardingDtos.WorkflowAction> availableActions(long instanceId) {
    return jdbc.query(
        """
        SELECT a.code,a.libelle,a.commentaire_obligatoire FROM workflow.instances i
        JOIN workflow.transitions tr ON tr.version_id=i.version_id
          AND tr.node_source_id=i.node_actif_id
        JOIN workflow.actions a ON a.id=tr.action_id WHERE i.id=? ORDER BY a.id
        """, (rs, n) -> new OnboardingDtos.WorkflowAction(
            rs.getString(1), rs.getString(2), rs.getBoolean(3)), instanceId);
  }

  public List<WorkflowDtos.Definition> definitions() {
    return jdbc.query(
        """
        SELECT d.id,d.code,d.nom,d.description,d.statut,d.modifie_le,
          v.id version_id,v.numero
        FROM workflow.definitions d
        LEFT JOIN LATERAL (
          SELECT id,numero FROM workflow.versions WHERE definition_id=d.id
          ORDER BY numero DESC LIMIT 1
        ) v ON TRUE ORDER BY d.nom
        """,
        (rs, n) -> new WorkflowDtos.Definition(
            rs.getLong("id"), rs.getString("code"), rs.getString("nom"),
            rs.getString("description"), (Integer) rs.getObject("numero"),
            rs.getString("statut"), nodes((Long) rs.getObject("version_id")),
            rs.getObject("modifie_le", OffsetDateTime.class)));
  }

  private List<WorkflowDtos.Node> nodes(Long versionId) {
    if (versionId == null) return List.of();
    return jdbc.query(
        """
        SELECT id,code,nom,type_node FROM workflow.nodes
        WHERE version_id=? ORDER BY ordre_affichage,id
        """, (rs, n) -> new WorkflowDtos.Node(
            rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)), versionId);
  }

  public void updateDefinition(long id, WorkflowDtos.DefinitionUpdate body) {
    int count = jdbc.update(
        """
        UPDATE workflow.definitions SET
          nom=coalesce(?,nom), description=coalesce(?,description),
          statut=coalesce(?,statut), modifie_le=NOW() WHERE id=?
        """,
        first(body.nom(), body.libelle()), body.description(), body.statut(), id);
    if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "workflow introuvable");
  }

  private static String first(String a, String b) {
    return a != null && !a.isBlank() ? a.trim() : b != null && !b.isBlank() ? b.trim() : null;
  }
}
