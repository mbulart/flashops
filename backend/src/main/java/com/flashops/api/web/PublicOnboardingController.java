package com.flashops.api.web;

import com.flashops.api.onboarding.OnboardingCaptchaService;
import com.flashops.api.onboarding.OnboardingService;
import com.flashops.api.web.dto.OnboardingDtos;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/public/onboarding")
public class PublicOnboardingController {
  private final OnboardingService onboarding;
  private final OnboardingCaptchaService captcha;

  public PublicOnboardingController(OnboardingService onboarding, OnboardingCaptchaService captcha) {
    this.onboarding = onboarding;
    this.captcha = captcha;
  }

  @GetMapping("/captcha")
  public Map<String, Object> captcha(HttpServletRequest request) {
    return captcha.challenge(clientIp(request));
  }

  @PostMapping("/captcha/valider")
  public Map<String, String> validerCaptcha(@RequestBody(required = false) Map<String, String> body) {
    String payload = body == null ? null : body.get("payload");
    return Map.of("grant", captcha.issueGrant(payload));
  }

  @GetMapping("/referentiels")
  public Map<String, OnboardingDtos.Referentiels> referentiels() {
    return Map.of("data", onboarding.referentiels());
  }

  @GetMapping("/geo/provinces")
  public Map<String, List<OnboardingDtos.Lieu>> provinces() {
    return Map.of("data", onboarding.provinces());
  }

  @GetMapping("/geo/villes")
  public Map<String, List<OnboardingDtos.Lieu>> villes(@RequestParam("province_id") short provinceId) {
    return Map.of("data", onboarding.villes(provinceId));
  }

  @GetMapping("/geo/communes")
  public Map<String, List<OnboardingDtos.Lieu>> communes(@RequestParam("ville_id") short villeId) {
    return Map.of("data", onboarding.communes(villeId));
  }

  @PostMapping("/candidatures")
  public Map<String, OnboardingDtos.Candidature> create(
      @RequestHeader(value = "X-Onboarding-Grant", required = false) String grant,
      @RequestBody OnboardingDtos.CandidatureDraft body) {
    captcha.authorizeCreate(grant);
    OnboardingDtos.Candidature created = onboarding.create(body);
    Long createdId = created.id();
    if (createdId == null) {
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "enregistrement impossible");
    }
    captcha.bind(grant, createdId);
    return Map.of("data", created);
  }

  @PutMapping("/candidatures/{id}")
  public Map<String, OnboardingDtos.Candidature> update(
      @PathVariable long id,
      @RequestParam(required = false) String jeton,
      @RequestHeader(value = "X-Candidature-Jeton", required = false) String headerToken,
      @RequestHeader(value = "X-Onboarding-Grant", required = false) String grant,
      @RequestBody OnboardingDtos.CandidatureDraft body) {
    captcha.authorize(grant, id);
    return Map.of("data", onboarding.update(id, jeton, headerToken, body));
  }

  @PostMapping("/candidatures/{id}/soumettre")
  public Map<String, OnboardingDtos.Candidature> submit(
      @PathVariable long id,
      @RequestParam(required = false) String jeton,
      @RequestHeader(value = "X-Candidature-Jeton", required = false) String headerToken,
      @RequestHeader(value = "X-Onboarding-Grant", required = false) String grant,
      @RequestBody(required = false) Map<String, String> body) {
    captcha.authorize(grant, id);
    String bodyToken = body == null ? null : body.get("jeton");
    return Map.of(
        "data",
        onboarding.submit(id, jeton == null ? bodyToken : jeton, headerToken));
  }

  @GetMapping("/suivi")
  public Map<String, OnboardingDtos.Candidature> track(
      @RequestParam String reference, @RequestParam String jeton) {
    return Map.of("data", onboarding.track(reference, jeton));
  }

  @PostMapping(value = "/candidatures/{id}/documents/{typeCode}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public Map<String, OnboardingDtos.Document> uploadDocument(
      @PathVariable long id,
      @PathVariable String typeCode,
      @RequestParam(required = false) String jeton,
      @RequestHeader(value = "X-Candidature-Jeton", required = false) String headerToken,
      @RequestHeader(value = "X-Onboarding-Grant", required = false) String grant,
      @RequestPart("file") MultipartFile file) {
    captcha.authorize(grant, id);
    return Map.of("data", onboarding.uploadDocument(id, jeton, headerToken, typeCode, file));
  }

  @DeleteMapping("/candidatures/{id}/documents/{typeCode}")
  public Map<String, Object> deleteDocument(
      @PathVariable long id,
      @PathVariable String typeCode,
      @RequestParam(required = false) String jeton,
      @RequestHeader(value = "X-Candidature-Jeton", required = false) String headerToken,
      @RequestHeader(value = "X-Onboarding-Grant", required = false) String grant) {
    captcha.authorize(grant, id);
    onboarding.deleteDocument(id, jeton, headerToken, typeCode);
    return Map.of("ok", true);
  }

  @GetMapping("/candidatures/{id}/documents/{typeCode}/fichier")
  public ResponseEntity<Resource> downloadDocument(
      @PathVariable long id,
      @PathVariable String typeCode,
      @RequestParam(required = false) String jeton,
      @RequestHeader(value = "X-Candidature-Jeton", required = false) String headerToken) {
    OnboardingService.StoredFile file = onboarding.openDocument(id, jeton, headerToken, typeCode);
    String filename = file.filename().replace("\"", "");
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(file.contentType()))
        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
        .body(new FileSystemResource(file.path()));
  }

  private static String clientIp(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",")[0].trim();
    }
    return request.getRemoteAddr();
  }
}
