package com.flashops.api.web;

import com.flashops.api.admin.PermissionGuard;
import com.flashops.api.approvisionnement.ApprovisionnementVasService;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ConsommationCalculView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DashboardKpiView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeListItem;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.PaiementInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.PaiementView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ProduitOption;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ReleveSoldeInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ReleveSoldeView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.SeuilAlerteInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.SeuilAlerteView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.SoldeAlerteView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.TransitionInput;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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
    requireAny(AuthSupport.currentUserId(), "approvisionnement.vas.lire");
    return Map.of("data", service.listProduits());
  }

  @GetMapping("/consommations")
  public Map<String, ConsommationCalculView> consommations(
      @RequestParam("produit_id") int produitId,
      @RequestParam String devise,
      @RequestParam("date_reference") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate dateReference) {
    requireAny(AuthSupport.currentUserId(), "approvisionnement.vas.lire");
    return Map.of("data", service.calculer(produitId, devise, dateReference));
  }

  @GetMapping("/dashboard")
  public Map<String, DashboardKpiView> dashboard() {
    requireAny(AuthSupport.currentUserId(), "approvisionnement.vas.lire");
    return Map.of("data", service.dashboard());
  }

  @GetMapping("/soldes")
  public Map<String, List<ReleveSoldeView>> soldes() {
    requireAny(
        AuthSupport.currentUserId(),
        "approvisionnement.vas.soldes.lire",
        "approvisionnement.vas.lire");
    return Map.of("data", service.derniersSoldes());
  }

  @PostMapping("/soldes")
  public Map<String, ReleveSoldeView> createSolde(@RequestBody ReleveSoldeInput body) {
    int userId = AuthSupport.currentUserId();
    requireAny(userId, "approvisionnement.vas.soldes.lire", "approvisionnement.vas.ecrire");
    return Map.of("data", service.createReleve(userId, body));
  }

  @GetMapping("/soldes/alertes")
  public Map<String, List<SoldeAlerteView>> alertes() {
    requireAny(
        AuthSupport.currentUserId(),
        "approvisionnement.vas.soldes.lire",
        "approvisionnement.vas.lire");
    return Map.of("data", service.alertesSoldes());
  }

  @GetMapping("/seuils")
  public Map<String, List<SeuilAlerteView>> seuils() {
    requireAny(
        AuthSupport.currentUserId(),
        "approvisionnement.vas.soldes.lire",
        "approvisionnement.vas.lire");
    return Map.of("data", service.listSeuils());
  }

  @PutMapping("/seuils")
  public Map<String, SeuilAlerteView> upsertSeuil(@RequestBody SeuilAlerteInput body) {
    int userId = AuthSupport.currentUserId();
    requireAny(userId, "approvisionnement.vas.seuils.ecrire", "approvisionnement.vas.ecrire");
    return Map.of("data", service.upsertSeuil(userId, body));
  }

  @DeleteMapping("/seuils/{id}")
  public Map<String, Object> deleteSeuil(@PathVariable long id) {
    int userId = AuthSupport.currentUserId();
    requireAny(userId, "approvisionnement.vas.seuils.ecrire", "approvisionnement.vas.ecrire");
    service.deleteSeuil(id);
    return Map.of("ok", true);
  }

  @DeleteMapping("/soldes/{id}")
  public Map<String, Object> deleteSolde(@PathVariable long id) {
    int userId = AuthSupport.currentUserId();
    requireAny(userId, "approvisionnement.vas.seuils.ecrire", "approvisionnement.vas.ecrire");
    service.deleteReleve(id);
    return Map.of("ok", true);
  }

  @GetMapping
  public Map<String, List<DemandeListItem>> list(
      @RequestParam(required = false) String statut,
      @RequestParam(defaultValue = "100") int limit) {
    requireAny(AuthSupport.currentUserId(), "approvisionnement.vas.lire");
    return Map.of("data", service.list(statut, limit));
  }

  @GetMapping("/{id}")
  public Map<String, DemandeView> get(@PathVariable long id) {
    requireAny(AuthSupport.currentUserId(), "approvisionnement.vas.lire");
    return Map.of("data", service.get(id));
  }

  @PostMapping
  public Map<String, DemandeView> create(@RequestBody DemandeInput body) {
    int userId = AuthSupport.currentUserId();
    requireAny(userId, "approvisionnement.vas.creer", "approvisionnement.vas.ecrire");
    return Map.of("data", service.create(userId, body));
  }

  @PutMapping("/{id}")
  public Map<String, DemandeView> update(@PathVariable long id, @RequestBody DemandeInput body) {
    int userId = AuthSupport.currentUserId();
    requireAny(userId, "approvisionnement.vas.modifier", "approvisionnement.vas.ecrire");
    return Map.of("data", service.update(id, userId, body));
  }

  @PostMapping("/{id}/transition")
  public Map<String, DemandeView> transition(
      @PathVariable long id, @RequestBody TransitionInput body) {
    int userId = AuthSupport.currentUserId();
    String statut = body == null || body.statut() == null ? "" : body.statut().trim().toLowerCase();
    switch (statut) {
      case "soumise", "en_attente_validation" ->
          requireAny(userId, "approvisionnement.vas.soumettre", "approvisionnement.vas.ecrire");
      case "validee", "en_attente_paiement" ->
          requireAny(userId, "approvisionnement.vas.valider", "approvisionnement.vas.ecrire");
      case "rejetee" ->
          requireAny(userId, "approvisionnement.vas.rejeter", "approvisionnement.vas.ecrire");
      case "annulee" ->
          requireAny(
              userId,
              "approvisionnement.vas.modifier",
              "approvisionnement.vas.ecrire",
              "approvisionnement.vas.soumettre");
      default ->
          requireAny(userId, "approvisionnement.vas.modifier", "approvisionnement.vas.ecrire");
    }
    return Map.of("data", service.transitionStatut(id, userId, body));
  }

  @GetMapping("/{id}/paiements")
  public Map<String, List<PaiementView>> paiementsDemande(@PathVariable long id) {
    requireAny(
        AuthSupport.currentUserId(),
        "approvisionnement.vas.paiements.lire",
        "approvisionnement.vas.lire");
    return Map.of("data", service.listPaiementsDemande(id));
  }

  @GetMapping("/lignes/{ligneId}/paiements")
  public Map<String, List<PaiementView>> paiementsLigne(@PathVariable long ligneId) {
    requireAny(
        AuthSupport.currentUserId(),
        "approvisionnement.vas.paiements.lire",
        "approvisionnement.vas.lire");
    return Map.of("data", service.listPaiementsLigne(ligneId));
  }

  @PostMapping("/lignes/{ligneId}/paiements")
  public Map<String, PaiementView> createPaiement(
      @PathVariable long ligneId, @RequestBody PaiementInput body) {
    int userId = AuthSupport.currentUserId();
    requireAny(userId, "approvisionnement.vas.payer", "approvisionnement.vas.ecrire");
    return Map.of("data", service.createPaiement(ligneId, userId, body));
  }

  private void requireAny(int userId, String... codes) {
    ResponseStatusException last = null;
    for (String code : codes) {
      try {
        permissions.require(userId, code);
        return;
      } catch (ResponseStatusException ex) {
        last = ex;
      }
    }
    if (last != null) {
      throw last;
    }
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "insufficient permissions");
  }
}
