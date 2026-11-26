package com.flashops.api.onboarding;

import com.flashops.api.referentiel.geo.GeoReferentielService;
import com.flashops.api.web.dto.GeoDtos;
import com.flashops.api.web.dto.OnboardingDtos;
import com.flashops.api.workflow.WorkflowEngine;
import com.flashops.api.workflow.WorkflowRepository;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OnboardingService {
  private static final long MAX_BYTES = 8L * 1024 * 1024;
  private static final Set<String> EXTENSIONS = Set.of("pdf", "jpg", "jpeg", "png", "webp", "gif");

  private final OnboardingRepository onboarding;
  private final WorkflowRepository workflows;
  private final WorkflowEngine engine;
  private final GeoReferentielService geo;
  private final OnboardingDocumentStorage storage;

  public OnboardingService(
      OnboardingRepository onboarding,
      WorkflowRepository workflows,
      WorkflowEngine engine,
      GeoReferentielService geo,
      OnboardingDocumentStorage storage) {
    this.onboarding = onboarding;
    this.workflows = workflows;
    this.engine = engine;
    this.geo = geo;
    this.storage = storage;
  }

  public List<OnboardingDtos.Lieu> provinces() {
    Short paysId =
        geo.listPays().stream()
            .filter(p -> p.codeIso() != null && "CD".equalsIgnoreCase(p.codeIso()))
            .map(GeoDtos.PaysRow::id)
            .findFirst()
            .orElse(null);
    if (paysId == null) return List.of();
    return geo.listProvinces(paysId).stream()
        .map(p -> new OnboardingDtos.Lieu(p.id(), p.libelle()))
        .toList();
  }

  public List<OnboardingDtos.Lieu> villes(short provinceId) {
    return geo.listVilles(provinceId).stream()
        .map(v -> new OnboardingDtos.Lieu(v.id(), v.libelle()))
        .toList();
  }

  public List<OnboardingDtos.Lieu> communes(short villeId) {
    return geo.listCommunes(villeId, null, null).stream()
        .map(c -> new OnboardingDtos.Lieu(c.id(), c.libelle()))
        .toList();
  }

  public OnboardingDtos.Referentiels referentiels() {
    return onboarding.referentiels();
  }

  @Transactional
  public OnboardingDtos.Candidature create(OnboardingDtos.CandidatureDraft body) {
    long id = onboarding.create(body == null ? OnboardingDtos.emptyDraft() : body);
    return onboarding.get(id, false, true);
  }

  @Transactional
  public OnboardingDtos.Candidature update(
      long id, String queryToken, String headerToken, OnboardingDtos.CandidatureDraft body) {
    String token = token(queryToken, headerToken);
    requireToken(id, token, true);
    onboarding.saveDraft(id, body == null ? OnboardingDtos.emptyDraft() : body);
    return onboarding.get(id, false, true);
  }

  public OnboardingDtos.Candidature submit(long id, String queryToken, String headerToken) {
    String token = token(queryToken, headerToken);
    requireToken(id, token, true);
    engine.submit(id);
    return onboarding.get(id, false, true);
  }

  public OnboardingDtos.Candidature track(String reference, String token) {
    return onboarding.track(reference, token);
  }

  public OnboardingDtos.CandidaturePage list(String q, String status, int page, int size) {
    return onboarding.list(q, status, page, size);
  }

  public OnboardingDtos.Candidature detail(long id) {
    return onboarding.get(id, true, false);
  }

  @Transactional
  public void delete(long id) {
    if (!onboarding.delete(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "candidature introuvable");
    }
  }

  @Transactional
  public OnboardingDtos.Document uploadDocument(
      long id, String queryToken, String headerToken, String typeCode, MultipartFile file) {
    String code = safeType(typeCode);
    requireToken(id, token(queryToken, headerToken), true);
    if (file == null || file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fichier manquant");
    }
    if (file.getSize() > MAX_BYTES) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fichier trop volumineux (8 Mo max)");
    }
    String ext = extension(file.getOriginalFilename(), file.getContentType());
    if (ext == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "format accepté : PDF ou image");
    }
    OnboardingDtos.FichierMeta previous = onboarding.fichier(id, code);
    String relative;
    try {
      relative = storage.save(id, code, ext, file.getInputStream());
    } catch (IOException ex) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "enregistrement impossible");
    }
    String name = cleanName(file.getOriginalFilename(), code, ext);
    try {
      if (!onboarding.attachFichier(id, code, name, relative, contentType(ext), file.getSize())) {
        storage.deleteQuietly(relative);
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "type de document inconnu");
      }
    } catch (RuntimeException ex) {
      storage.deleteQuietly(relative);
      throw ex;
    }
    if (previous != null) storage.deleteQuietly(previous.chemin());
    return documentOf(id, code);
  }

  @Transactional
  public void deleteDocument(long id, String queryToken, String headerToken, String typeCode) {
    String code = safeType(typeCode);
    requireToken(id, token(queryToken, headerToken), true);
    String path = onboarding.retirerFichier(id, code);
    storage.deleteQuietly(path);
  }

  public StoredFile openDocument(long id, String queryToken, String headerToken, String typeCode) {
    String code = safeType(typeCode);
    requireToken(id, token(queryToken, headerToken), false);
    OnboardingDtos.FichierMeta meta = onboarding.fichier(id, code);
    if (meta == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "fichier introuvable");
    }
    Path path =
        storage
            .resolveExisting(meta.chemin())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "fichier introuvable"));
    String type = meta.contentType() == null || meta.contentType().isBlank()
        ? "application/octet-stream"
        : meta.contentType();
    return new StoredFile(path, meta.nom() == null ? code : meta.nom(), type);
  }

  public record StoredFile(Path path, String filename, String contentType) {}

  public List<OnboardingDtos.Task> tasks(int userId) {
    return workflows.tasks(userId);
  }

  public OnboardingDtos.Candidature act(
      long taskId, int userId, OnboardingDtos.TaskActionInput input) {
    long candidatureId = engine.act(taskId, userId, input);
    return onboarding.get(candidatureId, true, false);
  }

  private void requireToken(long id, String token, boolean draftOnly) {
    if (token == null || !onboarding.tokenMatches(id, token, draftOnly)) {
      throw new ResponseStatusException(
          draftOnly ? HttpStatus.CONFLICT : HttpStatus.FORBIDDEN,
          draftOnly ? "brouillon ou jeton invalide" : "jeton invalide");
    }
  }

  private OnboardingDtos.Document documentOf(long id, String typeCode) {
    return onboarding.get(id, false, false).documents().stream()
        .filter(d -> typeCode.equals(d.typeCode()))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "document introuvable"));
  }

  private static String token(String query, String header) {
    if (header != null && !header.isBlank()) return header.trim();
    return query == null || query.isBlank() ? null : query.trim();
  }

  private static String safeType(String typeCode) {
    if (typeCode == null || !typeCode.matches("[A-Z0-9_]{1,40}")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "type de document invalide");
    }
    return typeCode;
  }

  private static String extension(String filename, String contentType) {
    String ext = "";
    if (filename != null) {
      int dot = filename.lastIndexOf('.');
      if (dot >= 0 && dot < filename.length() - 1) {
        ext = filename.substring(dot + 1).toLowerCase(Locale.ROOT);
      }
    }
    if (!EXTENSIONS.contains(ext)) {
      ext = switch (contentType == null ? "" : contentType.toLowerCase(Locale.ROOT)) {
        case "application/pdf" -> "pdf";
        case "image/jpeg" -> "jpg";
        case "image/png" -> "png";
        case "image/webp" -> "webp";
        case "image/gif" -> "gif";
        default -> "";
      };
    }
    return EXTENSIONS.contains(ext) ? ext : null;
  }

  private static String contentType(String ext) {
    return switch (ext) {
      case "pdf" -> "application/pdf";
      case "png" -> "image/png";
      case "webp" -> "image/webp";
      case "gif" -> "image/gif";
      default -> "image/jpeg";
    };
  }

  private static String cleanName(String original, String typeCode, String ext) {
    String name = original == null ? "" : original.trim();
    if (name.isBlank() || name.contains("/") || name.contains("\\")) {
      return typeCode + "." + ext;
    }
    return name.length() > 240 ? name.substring(name.length() - 240) : name;
  }
}
