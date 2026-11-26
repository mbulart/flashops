package com.flashops.api.onboarding;

import com.flashops.api.web.dto.OnboardingDtos;
import com.flashops.api.workflow.WorkflowEngine;
import com.flashops.api.workflow.WorkflowRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OnboardingService {
  private final OnboardingRepository onboarding;
  private final WorkflowRepository workflows;
  private final WorkflowEngine engine;

  public OnboardingService(
      OnboardingRepository onboarding, WorkflowRepository workflows, WorkflowEngine engine) {
    this.onboarding = onboarding;
    this.workflows = workflows;
    this.engine = engine;
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

  private static String token(String query, String header) {
    if (header != null && !header.isBlank()) return header.trim();
    return query == null || query.isBlank() ? null : query.trim();
  }
}
