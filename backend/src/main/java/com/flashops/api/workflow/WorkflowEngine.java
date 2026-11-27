package com.flashops.api.workflow;

import com.flashops.api.onboarding.OnboardingMailService;
import com.flashops.api.onboarding.OnboardingRepository;
import com.flashops.api.web.dto.OnboardingDtos;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkflowEngine {
  private final WorkflowRepository workflows;
  private final OnboardingRepository onboarding;

  public WorkflowEngine(WorkflowRepository workflows, OnboardingRepository onboarding) {
    this.workflows = workflows;
    this.onboarding = onboarding;
  }

  @Transactional
  public void submit(long candidatureId) {
    OnboardingDtos.Candidature candidature = onboarding.get(candidatureId, false, true);
    WorkflowRepository.Version version = workflows.activeVersion("CANDIDATURE_SAG");
    onboarding.markSubmitted(candidatureId);
    long instanceId =
        workflows.createInstance(version, candidatureId, candidature.reference());
    WorkflowRepository.Transition transition =
        workflows.transition(version.id(), version.startNodeId(), "SOUMETTRE");
    workflows.move(instanceId, transition);
    workflows.openTask(instanceId, transition.destinationId());
    workflows.log(instanceId, null, transition, version.startNodeId(), null, null);
    onboarding.updateStatus(candidatureId, "en_cours");
  }

  @Transactional
  public long act(long taskId, int userId, OnboardingDtos.TaskActionInput input) {
    if (input == null || input.action() == null || input.action().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "action requise");
    }
    WorkflowRepository.TaskContext task = workflows.lockOpenTask(taskId);
    requireActor(userId);
    WorkflowRepository.Transition transition =
        workflows.transition(task.versionId(), task.currentNodeId(), input.action());
    if (transition.commentRequired()
        && (input.commentaire() == null || input.commentaire().isBlank())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "commentaire requis");
    }

    workflows.closeTask(taskId, userId);
    workflows.move(task.instanceId(), transition);
    if (isTaskNode(transition.destinationType())) {
      workflows.openTask(task.instanceId(), transition.destinationId());
    }
    workflows.log(task.instanceId(), taskId, transition, task.currentNodeId(), userId,
        input.commentaire());
    switch (transition.destinationType()) {
      case "fin_ok" -> onboarding.updateStatus(task.candidatureId(), "approuvee");
      case "fin_ko" -> onboarding.updateStatus(task.candidatureId(), "rejetee");
      case "attente" -> onboarding.updateStatus(task.candidatureId(), "complement");
      default -> onboarding.updateStatus(task.candidatureId(), "en_cours");
    }
    return task.candidatureId();
  }

  private void requireActor(int userId) {
    WorkflowRepository.UserAccess access = workflows.access(userId);
    String email = access.email() == null ? "" : access.email().trim();
    if ("SUPER_ADMIN".equals(access.role())
        || OnboardingMailService.PROCESSOR_EMAIL.equalsIgnoreCase(email)) {
      return;
    }
    throw new ResponseStatusException(
        HttpStatus.FORBIDDEN, "traitement réservé au responsable onboarding");
  }

  private static boolean isTaskNode(String type) {
    return "etape".equals(type) || "decision".equals(type) || "attente".equals(type);
  }
}
