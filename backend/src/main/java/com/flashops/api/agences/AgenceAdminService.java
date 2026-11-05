package com.flashops.api.agences;

import com.flashops.api.web.dto.AgenceAdminDtos.AgenceAdminInput;
import com.flashops.api.web.dto.AgenceAdminDtos.AgenceAdminPage;
import com.flashops.api.web.dto.AgenceAdminDtos.AgenceAdminRow;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AgenceAdminService {

  private final AgenceAdminRepository repo;

  public AgenceAdminService(AgenceAdminRepository repo) {
    this.repo = repo;
  }

  public AgenceAdminPage list(AgenceAdminQuery q) {
    return repo.list(q);
  }

  public List<AgenceAdminRow> export(AgenceAdminQuery q) {
    return repo.listForExport(q);
  }

  public AgenceAdminRow get(int agenceId) {
    return repo.findById(agenceId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Agence introuvable"));
  }

  public AgenceAdminRow create(AgenceAdminInput body) {
    validateParent(body.parentAgenceId(), null);
    int id = repo.create(body);
    return get(id);
  }

  public AgenceAdminRow update(int agenceId, AgenceAdminInput body) {
    validateParent(body.parentAgenceId(), agenceId);
    if (!repo.update(agenceId, body)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Agence introuvable");
    }
    return get(agenceId);
  }

  public List<String> categories() {
    return repo.listCategories();
  }

  private void validateParent(Integer parentId, Integer selfId) {
    if (parentId == null || parentId <= 0) return;
    if (selfId != null && parentId.equals(selfId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Une agence ne peut pas être sa propre mère");
    }
    repo.findById(parentId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agence mère introuvable"));
  }
}
