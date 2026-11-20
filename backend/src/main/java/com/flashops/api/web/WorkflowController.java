package com.flashops.api.web;

import com.flashops.api.web.dto.WorkflowDtos;
import com.flashops.api.workflow.WorkflowService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workflow")
public class WorkflowController {
  private final WorkflowService workflows;

  public WorkflowController(WorkflowService workflows) {
    this.workflows = workflows;
  }

  @GetMapping("/definitions")
  public Map<String, List<WorkflowDtos.Definition>> definitions() {
    return Map.of("data", workflows.definitions(AuthSupport.currentUserId()));
  }

  @PutMapping("/definitions/{id}")
  public Map<String, WorkflowDtos.Definition> update(
      @PathVariable long id, @RequestBody WorkflowDtos.DefinitionUpdate body) {
    return Map.of("data", workflows.update(id, AuthSupport.currentUserId(), body));
  }
}
