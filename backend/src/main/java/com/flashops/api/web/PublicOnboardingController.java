package com.flashops.api.web;

import com.flashops.api.onboarding.OnboardingService;
import com.flashops.api.web.dto.OnboardingDtos;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/onboarding")
public class PublicOnboardingController {
  private final OnboardingService onboarding;

  public PublicOnboardingController(OnboardingService onboarding) {
    this.onboarding = onboarding;
  }

  @GetMapping("/referentiels")
  public Map<String, OnboardingDtos.Referentiels> referentiels() {
    return Map.of("data", onboarding.referentiels());
  }

  @PostMapping("/candidatures")
  public Map<String, OnboardingDtos.Candidature> create(
      @RequestBody OnboardingDtos.CandidatureDraft body) {
    return Map.of("data", onboarding.create(body));
  }

  @PutMapping("/candidatures/{id}")
  public Map<String, OnboardingDtos.Candidature> update(
      @PathVariable long id,
      @RequestParam(required = false) String jeton,
      @RequestHeader(value = "X-Candidature-Jeton", required = false) String headerToken,
      @RequestBody OnboardingDtos.CandidatureDraft body) {
    return Map.of("data", onboarding.update(id, jeton, headerToken, body));
  }

  @PostMapping("/candidatures/{id}/soumettre")
  public Map<String, OnboardingDtos.Candidature> submit(
      @PathVariable long id,
      @RequestParam(required = false) String jeton,
      @RequestHeader(value = "X-Candidature-Jeton", required = false) String headerToken,
      @RequestBody(required = false) Map<String, String> body) {
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
}
