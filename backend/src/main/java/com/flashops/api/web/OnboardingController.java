package com.flashops.api.web;

import com.flashops.api.admin.PermissionGuard;
import com.flashops.api.onboarding.OnboardingService;
import com.flashops.api.web.dto.OnboardingDtos;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/onboarding")
public class OnboardingController {
  private final OnboardingService onboarding;
  private final PermissionGuard permissions;

  public OnboardingController(OnboardingService onboarding, PermissionGuard permissions) {
    this.onboarding = onboarding;
    this.permissions = permissions;
  }

  @GetMapping("/candidatures")
  public Map<String, OnboardingDtos.CandidaturePage> list(
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String statut,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "25") int size) {
    permissions.require(AuthSupport.currentUserId(), "onboarding.candidatures.lire");
    return Map.of("data", onboarding.list(q, statut, page, size));
  }

  @GetMapping("/candidatures/{id}")
  public Map<String, OnboardingDtos.Candidature> detail(@PathVariable long id) {
    permissions.require(AuthSupport.currentUserId(), "onboarding.candidatures.lire");
    return Map.of("data", onboarding.detail(id));
  }

  @DeleteMapping("/candidatures/{id}")
  public Map<String, Object> delete(@PathVariable long id) {
    int userId = AuthSupport.currentUserId();
    if (!permissions.isSuperAdmin(userId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "réservé au SUPER_ADMIN");
    }
    onboarding.delete(id);
    return Map.of("ok", true);
  }

  @GetMapping("/taches")
  public Map<String, List<OnboardingDtos.Task>> tasks() {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "onboarding.taches.lire");
    return Map.of("data", onboarding.tasks(userId));
  }

  @PostMapping("/taches/{id}/actions")
  public Map<String, OnboardingDtos.Candidature> act(
      @PathVariable long id, @RequestBody OnboardingDtos.TaskActionInput body) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "onboarding.taches.agir");
    return Map.of("data", onboarding.act(id, userId, body));
  }
}
