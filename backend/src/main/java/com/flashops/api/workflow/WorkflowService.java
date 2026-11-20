package com.flashops.api.workflow;

import com.flashops.api.web.dto.WorkflowDtos;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkflowService {
  private final WorkflowRepository workflows;

  public WorkflowService(WorkflowRepository workflows) {
    this.workflows = workflows;
  }

  public List<WorkflowDtos.Definition> definitions(int userId) {
    requireAny(userId, "workflow.lire", "workflow.admin");
    return workflows.definitions();
  }

  @Transactional
  public WorkflowDtos.Definition update(
      long id, int userId, WorkflowDtos.DefinitionUpdate body) {
    requireAny(userId, "workflow.admin");
    workflows.updateDefinition(id, body);
    return workflows.definitions().stream()
        .filter(item -> item.id() == id)
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  }

  private void requireAny(int userId, String... expected) {
    WorkflowRepository.UserAccess access = workflows.access(userId);
    if ("SUPER_ADMIN".equals(access.role())) return;
    for (String permission : expected) {
      if (access.permissions().contains(permission)) return;
    }
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "insufficient permissions");
  }
}
