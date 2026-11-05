package com.flashops.api.web;

import com.flashops.api.agences.AgenceAdminRepository;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicAgencesController {

  private final AgenceAdminRepository agences;

  public PublicAgencesController(AgenceAdminRepository agences) {
    this.agences = agences;
  }

  @GetMapping("/agences")
  public Map<String, Object> locatedAgences() {
    return Map.of("data", agences.loadLocatedPublic());
  }
}
