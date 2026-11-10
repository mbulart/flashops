package com.flashops.api.web;

import com.flashops.api.admin.PermissionGuard;
import com.flashops.api.approvisionnement.ApprovisionnementVasService;
import com.flashops.api.web.dto.ApprovisionnementVasDtos;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ConsommationCalculView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeListItem;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ProduitOption;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/approvisionnement-vas")
public class ApprovisionnementVasController {

  private final ApprovisionnementVasService service;
  private final PermissionGuard permissions;

  public ApprovisionnementVasController(
      ApprovisionnementVasService service, PermissionGuard permissions) {
    this.service = service;
    this.permissions = permissions;
  }

  @GetMapping("/produits")
  public Map<String, List<ProduitOption>> produits() {
    permissions.require(AuthSupport.currentUserId(), "approvisionnement.vas.lire");
    return Map.of("data", service.listProduits());
  }

  @GetMapping("/consommations")
  public Map<String, ConsommationCalculView> consommations(
      @RequestParam("produit_id") int produitId,
      @RequestParam String devise,
      @RequestParam("date_reference") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate dateReference) {
    permissions.require(AuthSupport.currentUserId(), "approvisionnement.vas.lire");
    return Map.of("data", service.calculer(produitId, devise, dateReference));
  }

  @GetMapping
  public Map<String, List<DemandeListItem>> list(
      @RequestParam(defaultValue = "100") int limit) {
    permissions.require(AuthSupport.currentUserId(), "approvisionnement.vas.lire");
    return Map.of("data", service.list(limit));
  }

  @GetMapping("/{id}")
  public Map<String, DemandeView> get(@PathVariable long id) {
    permissions.require(AuthSupport.currentUserId(), "approvisionnement.vas.lire");
    return Map.of("data", service.get(id));
  }

  @PostMapping
  public Map<String, DemandeView> create(@RequestBody DemandeInput body) {
    int userId = AuthSupport.currentUserId();
    permissions.require(userId, "approvisionnement.vas.ecrire");
    return Map.of("data", service.create(userId, body));
  }

  @PutMapping("/{id}")
  public Map<String, DemandeView> update(@PathVariable long id, @RequestBody DemandeInput body) {
    permissions.require(AuthSupport.currentUserId(), "approvisionnement.vas.ecrire");
    return Map.of("data", service.update(id, body));
  }
}
