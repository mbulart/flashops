package com.flashops.api.admin;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flashops.api.domain.JournalAction;
import com.flashops.api.domain.Permission;
import com.flashops.api.domain.Role;
import com.flashops.api.domain.Utilisateur;
import com.flashops.api.repository.JournalActionRepository;
import com.flashops.api.repository.PermissionRepository;
import com.flashops.api.repository.RoleRepository;
import com.flashops.api.repository.UtilisateurRepository;
import com.flashops.api.web.dto.AdminDtos;
import com.flashops.api.web.dto.AdminDtos.ActionDetailRow;
import com.flashops.api.web.dto.AdminDtos.ActionRow;
import com.flashops.api.web.dto.AdminDtos.ActionUserBrief;
import com.flashops.api.web.dto.AdminDtos.AdminUserInput;
import com.flashops.api.web.dto.AdminDtos.AdminUserRow;
import com.flashops.api.web.dto.AdminDtos.AppSettingsUpdate;
import com.flashops.api.web.dto.AdminDtos.PagedActions;
import com.flashops.api.web.dto.AdminDtos.PermissionRow;
import com.flashops.api.web.dto.AdminDtos.RolePermissionsInput;
import com.flashops.api.web.dto.AdminDtos.RoleRow;
import com.flashops.api.web.dto.AuthDtos.RoleView;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdministrationService {

  private final PermissionGuard guard;
  private final UtilisateurRepository utilisateurs;
  private final RoleRepository roles;
  private final PermissionRepository permissions;
  private final RolePermissionStore rolePermissions;
  private final AppParametersService appParameters;
  private final AuditJournalService audit;
  private final JournalActionRepository journal;
  private final SmtpTestService smtpTest;
  private final PasswordEncoder passwordEncoder;
  private final ObjectMapper objectMapper;

  public AdministrationService(
      PermissionGuard guard,
      UtilisateurRepository utilisateurs,
      RoleRepository roles,
      PermissionRepository permissions,
      RolePermissionStore rolePermissions,
      AppParametersService appParameters,
      AuditJournalService audit,
      JournalActionRepository journal,
      SmtpTestService smtpTest,
      PasswordEncoder passwordEncoder,
      ObjectMapper objectMapper) {
    this.guard = guard;
    this.utilisateurs = utilisateurs;
    this.roles = roles;
    this.permissions = permissions;
    this.rolePermissions = rolePermissions;
    this.appParameters = appParameters;
    this.audit = audit;
    this.journal = journal;
    this.smtpTest = smtpTest;
    this.passwordEncoder = passwordEncoder;
    this.objectMapper = objectMapper;
  }

  @Transactional(readOnly = true)
  public List<AdminUserRow> listUsers(int actorId) {
    guard.require(actorId, "auth.utilisateurs.lire");
    return utilisateurs.findAllByOrderByNomCompletAsc().stream().map(this::toAdminUser).toList();
  }

  @Transactional
  public AdminUserRow createUser(int actorId, AdminUserInput input) {
    guard.require(actorId, "auth.utilisateurs.ecrire");
    String email = normalizeEmail(input.email());
    String name = trim(input.fullName());
    if (email.isBlank() || name.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid user");
    }
    if (input.password() == null || input.password().length() < 8) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password too short");
    }
    if (utilisateurs.findByCourrielIgnoreCase(email).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "email already used");
    }
    Role role = loadRole(input.roleId());
    assertCanAssignRole(actorId, role, null);
    Utilisateur u = new Utilisateur();
    u.setCourriel(email);
    u.setNomComplet(name);
    u.setRole(role);
    u.setActif(input.isActive());
    applyPasswordHash(u, input.password());
    u.setVersionSession(0L);
    applyScopeFields(u, role, input);
    utilisateurs.save(u);
    audit.log(actorId, "auth.utilisateur.creer", "auth", "Création utilisateur", Map.of("user_id", u.getId(), "email", email));
    return toAdminUser(u);
  }

  @Transactional
  public AdminUserRow updateUser(int actorId, int userId, AdminUserInput input) {
    guard.require(actorId, "auth.utilisateurs.ecrire");
    Utilisateur u =
        utilisateurs
            .findWithRoleById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found"));
    String email = normalizeEmail(input.email());
    String name = trim(input.fullName());
    if (email.isBlank() || name.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid user");
    }
    var existing = utilisateurs.findByCourrielIgnoreCase(email);
    if (existing.isPresent() && !existing.get().getId().equals(u.getId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "email already used");
    }
    u.setCourriel(email);
    u.setNomComplet(name);
    Role role = loadRole(input.roleId());
    assertCanAssignRole(actorId, role, u);
    u.setRole(role);
    u.setActif(input.isActive());
    applyScopeFields(u, role, input);
    if (input.password() != null && !input.password().isBlank()) {
      applyPasswordHash(u, input.password());
    }
    utilisateurs.save(u);
    audit.log(actorId, "auth.utilisateur.modifier", "auth", "Modification utilisateur", Map.of("user_id", userId));
    return toAdminUser(u);
  }

  @Transactional(readOnly = true)
  public List<RoleRow> listRoles(int actorId) {
    guard.require(actorId, "auth.roles.lire");
    return roles.findAll().stream()
        .map(
            role -> {
              List<PermissionRow> perms =
                  permissions.findByRoleId(role.getId()).stream().map(this::toPermissionRow).toList();
              return new RoleRow(role.getId(), role.getCode(), role.getLibelle(), perms);
            })
        .toList();
  }

  @Transactional
  public RoleRow setRolePermissions(int actorId, Short roleId, RolePermissionsInput input) {
    guard.require(actorId, "auth.roles.ecrire");
    Role role =
        roles.findById(roleId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "role not found"));
    if ("ADMIN".equals(role.getCode()) || "SUPER_ADMIN".equals(role.getCode())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "admin role permissions are fixed");
    }
    List<Integer> ids = input.permissionIds() == null ? List.of() : input.permissionIds();
    for (Integer pid : ids) {
      if (!permissions.existsById(pid)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid permission");
      }
    }
    rolePermissions.replaceRolePermissions(roleId, ids);
    audit.log(
        actorId,
        "auth.role.permissions",
        "auth",
        "Mise à jour permissions rôle",
        Map.of("role_id", roleId, "permission_count", ids.size()));
    List<PermissionRow> perms = permissions.findByRoleId(roleId).stream().map(this::toPermissionRow).toList();
    return new RoleRow(role.getId(), role.getCode(), role.getLibelle(), perms);
  }

  @Transactional(readOnly = true)
  public List<PermissionRow> listPermissions(int actorId) {
    guard.require(actorId, "auth.permissions.lire");
    return permissions.findAllByOrderByModuleAscCodeAsc().stream().map(this::toPermissionRow).toList();
  }

  @Transactional(readOnly = true)
  public AdminDtos.AppSettingsView getSettings(int actorId) {
    guard.require(actorId, "auth.parametres.lire");
    return appParameters.adminView();
  }

  @Transactional
  public AdminDtos.AppSettingsView updateSettings(int actorId, AppSettingsUpdate body) {
    guard.require(actorId, "auth.parametres.ecrire");
    var view = appParameters.update(body);
    audit.log(actorId, "auth.parametres.modifier", "auth", "Modification paramètres système", Map.of("section", "system"));
    return view;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> testSmtp(int actorId, String toOverride) {
    guard.require(actorId, "auth.parametres.ecrire");
    String to = appParameters.resolveSmtpTestRecipient(toOverride);
    smtpTest.sendTest(appParameters.requireRow(), to);
    audit.log(actorId, "auth.smtp.test", "auth", "Test SMTP", Map.of("to", to));
    return Map.of("data", Map.of("to", to, "status", "sent"));
  }

  @Transactional(readOnly = true)
  public PagedActions listActions(int actorId, int page, int pageSize) {
    guard.require(actorId, "audit.actions.lire");
    int safePage = Math.max(0, page);
    int safeSize = Math.min(100, Math.max(1, pageSize));
    Page<JournalAction> result = journal.findAllByOrderByCreeLeDesc(PageRequest.of(safePage, safeSize));
    List<ActionRow> items = result.getContent().stream().map(this::toActionRow).toList();
    return new PagedActions(items, result.getTotalElements(), safePage, safeSize);
  }

  @Transactional(readOnly = true)
  public ActionDetailRow getAction(int actorId, long actionId) {
    guard.require(actorId, "audit.actions.lire");
    JournalAction row =
        journal
            .findWithUserById(actionId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "action not found"));
    return toActionDetail(row);
  }

  public void logLoginSuccess(int userId, String email) {
    audit.log(userId, "auth.connexion", "auth", "Connexion réussie", Map.of("email", email));
  }

  public void logLoginFailure(String email) {
    audit.log(null, "auth.connexion.echec", "auth", "Échec de connexion", Map.of("email", email == null ? "" : email));
  }

  private AdminUserRow toAdminUser(Utilisateur u) {
    RoleView role = new RoleView(u.getRole().getId(), u.getRole().getCode(), u.getRole().getLibelle());
    return new AdminUserRow(
        u.getId(),
        u.getCourriel(),
        u.getNomComplet(),
        role,
        u.isActif(),
        u.getDerniereConnexionLe(),
        u.getAgenceId(),
        u.getResponsableZoneId());
  }

  private void applyScopeFields(Utilisateur u, Role role, AdminUserInput input) {
    String code = role.getCode();
    if ("AGENT".equals(code)) {
      Integer agenceId = input.agenceId();
      if (agenceId == null || agenceId <= 0) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "agence_id requis pour le rôle AGENT");
      }
      u.setAgenceId(agenceId);
      u.setResponsableZoneId(null);
      return;
    }
    if ("RZ".equals(code)) {
      Integer rzId = input.responsableZoneId();
      if (rzId == null || rzId <= 0) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "responsable_zone_id requis pour le rôle RZ");
      }
      u.setResponsableZoneId(rzId);
      u.setAgenceId(null);
      return;
    }
    u.setAgenceId(null);
    u.setResponsableZoneId(null);
  }

  private PermissionRow toPermissionRow(Permission p) {
    String module = p.getModule() == null ? "general" : p.getModule();
    return new PermissionRow(p.getId(), p.getCode(), p.getLibelle(), module);
  }

  private Role loadRole(Short roleId) {
    if (roleId == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "role required");
    }
    return roles.findById(roleId).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid role"));
  }

  private ActionRow toActionRow(JournalAction row) {
    return new ActionRow(
        row.getId(),
        row.getCodeAction(),
        row.getModule(),
        row.getLibelle(),
        userBrief(row),
        row.getCreeLe());
  }

  private ActionDetailRow toActionDetail(JournalAction row) {
    JsonNode details = null;
    if (row.getDetails() != null && !row.getDetails().isBlank()) {
      try {
        details = objectMapper.readTree(row.getDetails());
      } catch (Exception ignored) {
        details = objectMapper.createObjectNode().put("raw", row.getDetails());
      }
    }
    return new ActionDetailRow(
        row.getId(),
        row.getCodeAction(),
        row.getModule(),
        row.getLibelle(),
        userBrief(row),
        details,
        row.getAdresseIp(),
        row.getUserAgent(),
        row.getCreeLe());
  }

  private ActionUserBrief userBrief(JournalAction row) {
    Utilisateur u = row.getUtilisateur();
    if (u == null) {
      return null;
    }
    return new ActionUserBrief(u.getId(), u.getCourriel(), u.getNomComplet());
  }

  private void applyPasswordHash(Utilisateur u, String rawPassword) {
    String next = rawPassword == null ? "" : rawPassword.trim();
    if (next.length() < 8) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password too short");
    }
    u.setMotDePasseHash(passwordEncoder.encode(next));
    if (u.getId() != null) {
      u.setVersionSession(u.getVersionSession() + 1L);
    }
  }

  private void assertCanAssignRole(int actorId, Role role, Utilisateur target) {
    boolean actorSuper = guard.isSuperAdmin(actorId);
    boolean nextSuper = role != null && "SUPER_ADMIN".equals(role.getCode());
    boolean targetSuper =
        target != null && target.getRole() != null && "SUPER_ADMIN".equals(target.getRole().getCode());
    if ((nextSuper || targetSuper) && !actorSuper) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "insufficient permissions");
    }
  }

  private static String normalizeEmail(String email) {
    return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
  }

  private static String trim(String v) {
    return v == null ? "" : v.trim();
  }
}
