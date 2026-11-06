package com.flashops.api.auth;

import com.flashops.api.config.FlashOpsProperties;
import com.flashops.api.domain.JetonActualisation;
import com.flashops.api.domain.Permission;
import com.flashops.api.domain.Utilisateur;
import com.flashops.api.repository.JetonActualisationRepository;
import com.flashops.api.repository.PermissionRepository;
import com.flashops.api.repository.UtilisateurRepository;
import com.flashops.api.scope.UserDataScope;
import com.flashops.api.scope.UserDataScopeService;
import com.flashops.api.web.dto.AuthDtos;
import com.flashops.api.web.dto.AuthDtos.PermissionView;
import com.flashops.api.web.dto.AuthDtos.RoleView;
import com.flashops.api.web.dto.AuthDtos.TokenPair;
import com.flashops.api.web.dto.AuthDtos.UserView;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

  private final UtilisateurRepository utilisateurs;
  private final JetonActualisationRepository jetons;
  private final PermissionRepository permissions;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final FlashOpsProperties props;
  private final ProfilePhotoStorage profilePhotoStorage;
  private final UserDataScopeService dataScope;
  private final SecureRandom random = new SecureRandom();

  public AuthService(
      UtilisateurRepository utilisateurs,
      JetonActualisationRepository jetons,
      PermissionRepository permissions,
      PasswordEncoder passwordEncoder,
      JwtService jwtService,
      FlashOpsProperties props,
      ProfilePhotoStorage profilePhotoStorage,
      UserDataScopeService dataScope) {
    this.utilisateurs = utilisateurs;
    this.jetons = jetons;
    this.permissions = permissions;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
    this.props = props;
    this.profilePhotoStorage = profilePhotoStorage;
    this.dataScope = dataScope;
  }

  @Transactional
  public AuthDtos.LoginResponse login(String email, String password) {
    Utilisateur u =
        utilisateurs
            .findByCourrielIgnoreCase(email.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials"));
    if (!u.isActif()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "inactive user");
    }
    if (!passwordMatches(password, u.getMotDePasseHash())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials");
    }
    u.setDerniereConnexionLe(Instant.now());
    TokenPair tokens = issueTokens(u);
    return new AuthDtos.LoginResponse(toUserView(u), tokens);
  }

  @Transactional
  public TokenPair refresh(String refreshToken) {
    String hash = sha256(refreshToken);
    JetonActualisation row =
        jetons
            .findByEmpreinteJetonAndRevoqueLeIsNull(hash)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid refresh token"));
    if (row.getExpireLe().isBefore(Instant.now())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "expired refresh token");
    }
    row.setRevoqueLe(Instant.now());
    Utilisateur u = row.getUtilisateur();
    if (!u.isActif()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "inactive user");
    }
    return issueTokens(u);
  }

  @Transactional
  public void changePassword(int userId, String currentPassword, String newPassword) {
    String next = newPassword == null ? "" : newPassword.trim();
    if (next.length() < 8) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password too short");
    }
    Utilisateur u =
        utilisateurs
            .findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found"));
    if (!u.isActif()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "inactive user");
    }
    if (!passwordMatches(currentPassword, u.getMotDePasseHash())) {
      // 400 : l'utilisateur est déjà authentifié. Un 401 ferait relancer
      // le refresh de session côté front et masquerait l'erreur métier.
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid current password");
    }
    applyPasswordHash(u, next);
    utilisateurs.saveAndFlush(u);
    jetons.revokeAllActiveByUtilisateurId(userId, Instant.now());
  }

  @Transactional
  public UserView updateProfile(int userId, String email, String fullName) {
    String nextEmail = email == null ? "" : email.trim().toLowerCase();
    String nextName = fullName == null ? "" : fullName.trim();
    if (nextEmail.isBlank() || !nextEmail.contains("@")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid email");
    }
    if (nextName.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid full name");
    }
    Utilisateur u =
        utilisateurs
            .findWithRoleById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found"));
    if (!u.isActif()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "inactive user");
    }
    var existing = utilisateurs.findByCourrielIgnoreCase(nextEmail);
    if (existing.isPresent() && !existing.get().getId().equals(u.getId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "email already used");
    }
    u.setCourriel(nextEmail);
    u.setNomComplet(nextName);
    utilisateurs.save(u);
    return toUserView(u);
  }

  @Transactional
  public UserView uploadProfilePhoto(int userId, MultipartFile file) {
    Utilisateur u =
        utilisateurs
            .findWithRoleById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found"));
    if (!u.isActif()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "inactive user");
    }
    String previous = u.getPhotoFichier();
    ProfilePhotoStorage.StoredPhoto stored = profilePhotoStorage.store(userId, file);
    if (previous != null && !previous.isBlank() && !previous.equals(stored.filename())) {
      profilePhotoStorage.deleteIfExists(previous);
    }
    u.setPhotoFichier(stored.filename());
    u.setPhotoModifieLe(stored.updatedAt());
    utilisateurs.save(u);
    return toUserView(u);
  }

  @Transactional
  public UserView deleteProfilePhoto(int userId) {
    Utilisateur u =
        utilisateurs
            .findWithRoleById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found"));
    profilePhotoStorage.deleteIfExists(u.getPhotoFichier());
    u.setPhotoFichier(null);
    u.setPhotoModifieLe(null);
    utilisateurs.save(u);
    return toUserView(u);
  }

  @Transactional(readOnly = true)
  public byte[] readProfilePhoto(int requesterId, int targetUserId) {
    if (requesterId != targetUserId) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "forbidden");
    }
    Utilisateur u =
        utilisateurs
            .findById(targetUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found"));
    return profilePhotoStorage.read(u.getPhotoFichier());
  }

  @Transactional(readOnly = true)
  public UserView me(int userId) {
    Utilisateur u =
        utilisateurs
            .findWithRoleById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found"));
    return toUserView(u);
  }

  private boolean passwordMatches(String raw, String hash) {
    if (raw == null || hash == null || hash.isBlank()) {
      return false;
    }
    if (passwordEncoder.matches(raw, hash)) {
      return true;
    }
    String trimmed = raw.trim();
    return !trimmed.isEmpty() && !trimmed.equals(raw) && passwordEncoder.matches(trimmed, hash);
  }

  private void applyPasswordHash(Utilisateur u, String rawPassword) {
    u.setMotDePasseHash(passwordEncoder.encode(rawPassword));
    u.setVersionSession(u.getVersionSession() + 1L);
  }

  private TokenPair issueTokens(Utilisateur u) {
    String access =
        jwtService.createAccessToken(
            u.getId(), u.getCourriel(), u.getRole().getCode(), u.getVersionSession());
    String refreshRaw = randomToken();
    JetonActualisation j = new JetonActualisation();
    j.setUtilisateur(u);
    j.setEmpreinteJeton(sha256(refreshRaw));
    j.setExpireLe(Instant.now().plusSeconds(props.jwt().refreshTtlHours() * 3600L));
    jetons.save(j);
    return new TokenPair(access, refreshRaw);
  }

  private UserView toUserView(Utilisateur u) {
    List<String> codes = permissions.findCodesForUser(u.getId());
    List<Permission> rolePerms = permissions.findByRoleId(u.getRole().getId());
    Map<String, Permission> byCode = new LinkedHashMap<>();
    for (Permission p : rolePerms) {
      byCode.put(p.getCode(), p);
    }
    List<PermissionView> permViews = new java.util.ArrayList<>();
    for (String code : codes) {
      Permission p = byCode.get(code);
      if (p != null) {
        permViews.add(
            new PermissionView(
                p.getId(),
                p.getCode(),
                p.getLibelle(),
                p.getModule() == null ? "general" : p.getModule()));
      } else {
        permViews.add(new PermissionView(null, code, code, "pilotage"));
      }
    }
    RoleView role = new RoleView(u.getRole().getId(), u.getRole().getCode(), u.getRole().getLibelle());
    boolean hasPhoto = u.getPhotoFichier() != null && !u.getPhotoFichier().isBlank();
    UserDataScope scope = dataScope.resolve(u.getId());
    List<Integer> allowedAgences = scope.unrestricted() ? List.of() : scope.allowedAgenceIds();
    List<Integer> allowedZones = scope.unrestricted() ? List.of() : scope.allowedZoneIds();
    return new UserView(
        u.getId(),
        u.getCourriel(),
        u.getNomComplet(),
        role,
        permViews,
        codes,
        u.isActif(),
        u.getDerniereConnexionLe(),
        hasPhoto,
        u.getPhotoModifieLe(),
        u.getAgenceId(),
        u.getResponsableZoneId(),
        allowedAgences,
        allowedZones);
  }

  private static String randomToken() {
    byte[] buf = new byte[32];
    new SecureRandom().nextBytes(buf);
    return HexFormat.of().formatHex(buf);
  }

  private static String sha256(String value) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
