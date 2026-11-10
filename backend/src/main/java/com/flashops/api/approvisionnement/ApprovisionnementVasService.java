package com.flashops.api.approvisionnement;

import com.flashops.api.approvisionnement.ApprovisionnementVasRepository.DashboardAggRow;
import com.flashops.api.approvisionnement.ApprovisionnementVasRepository.DemandeHeaderRow;
import com.flashops.api.approvisionnement.ApprovisionnementVasRepository.LigneInsert;
import com.flashops.api.approvisionnement.ApprovisionnementVasRepository.LigneRow;
import com.flashops.api.approvisionnement.ApprovisionnementVasRepository.ProduitMmRow;
import com.flashops.api.approvisionnement.ApprovisionnementVasRepository.TotauxPeriode;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ConsommationCalculView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ConsommationPeriodeView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DashboardKpiView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeListItem;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.HistoriqueStatutView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.LigneInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.LigneView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.PaiementInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.PaiementView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.PeriodeView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ProduitOption;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ReleveSoldeInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ReleveSoldeView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.SeuilAlerteInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.SeuilAlerteView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.SoldeAlerteView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.TransitionInput;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ApprovisionnementVasService {

  private static final Set<String> DEVISES = Set.of("USD", "CDF");
  private static final Set<String> MODES_PAIEMENT = Set.of("banque", "transfert_interne", "autre");

  private final ApprovisionnementVasRepository repo;

  public ApprovisionnementVasService(ApprovisionnementVasRepository repo) {
    this.repo = repo;
  }

  @Transactional(readOnly = true)
  public List<ProduitOption> listProduits() {
    return repo.listProduitsMobileMoney().stream().map(this::toProduitOption).toList();
  }

  @Transactional(readOnly = true)
  public ConsommationCalculView calculer(int produitId, String devise, LocalDate dateReference) {
    String devisenorm = normalizeDevise(devise);
    ProduitMmRow produit =
        repo.findProduitMobileMoney(produitId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "produit invalide"));
    var periodes = ApprovisionnementPeriodes.resolve(dateReference);
    TotauxPeriode j1 = repo.totauxConsommation(produitId, devisenorm, periodes.j1());
    TotauxPeriode j2 = repo.totauxConsommation(produitId, devisenorm, periodes.j2());
    BigDecimal moyenne = ApprovisionnementVasRepository.moyenne(j1.consommation(), j2.consommation());
    return new ConsommationCalculView(
        dateReference,
        produit.produitId(),
        produit.produit(),
        produitLibelle(produit),
        devisenorm,
        toPeriodeView(periodes.j1(), j1),
        toPeriodeView(periodes.j2(), j2),
        moyenne);
  }

  @Transactional(readOnly = true)
  public List<DemandeListItem> list(String statut, int limit) {
    BigDecimal delai = repo.delaiTraitementHeures();
    Instant now = Instant.now();
    String statutFilter =
        statut == null || statut.isBlank() ? null : ApprovisionnementVasStatuts.normalize(statut);
    return repo.listDemandes(statutFilter, limit).stream()
        .map(
            r ->
                new DemandeListItem(
                    r.id(),
                    r.dateReference(),
                    r.statut(),
                    r.nbLignes(),
                    r.creeLe(),
                    r.soumiseLe(),
                    isEnRetard(r.statut(), r.soumiseLe(), r.creeLe(), delai, now),
                    r.totalProposeUsd(),
                    r.totalProposeCdf()))
        .toList();
  }

  @Transactional(readOnly = true)
  public DemandeView get(long id) {
    DemandeHeaderRow header =
        repo.findDemande(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "demande introuvable"));
    return toDemandeView(header, repo.listLignes(id), repo.listHistorique(id));
  }

  @Transactional
  public DemandeView create(int actorId, DemandeInput input) {
    LocalDate dateRef = requireDate(input);
    String statut = ApprovisionnementVasStatuts.normalize(input.statut());
    if (!ApprovisionnementVasStatuts.BROUILLON.equals(statut)
        && !ApprovisionnementVasStatuts.SOUMISE.equals(statut)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "création limitée à brouillon ou soumise");
    }
    List<LigneInput> lignes = requireLignes(input);
    Instant now = Instant.now();
    long id =
        repo.insertDemande(dateRef, ApprovisionnementVasStatuts.BROUILLON, trimToNull(input.commentaire()), actorId, now);
    repo.insertHistorique(id, null, ApprovisionnementVasStatuts.BROUILLON, actorId, "Création", now);
    persistLignes(id, dateRef, lignes);
    if (ApprovisionnementVasStatuts.SOUMISE.equals(statut)) {
      transitionStatut(
          id,
          actorId,
          new TransitionInput(ApprovisionnementVasStatuts.SOUMISE, "Soumission", null));
    }
    return get(id);
  }

  @Transactional
  public DemandeView update(long id, int actorId, DemandeInput input) {
    DemandeHeaderRow existing =
        repo.findDemande(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "demande introuvable"));
    if (!ApprovisionnementVasStatuts.isEditable(existing.statut())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "demande non modifiable dans ce statut");
    }
    LocalDate dateRef = requireDate(input);
    List<LigneInput> lignes = requireLignes(input);
    Instant now = Instant.now();
    repo.updateDemandeContent(id, dateRef, trimToNull(input.commentaire()), actorId, now);
    repo.deleteLignes(id);
    persistLignes(id, dateRef, lignes);
    if (input.statut() != null
        && !input.statut().isBlank()
        && !ApprovisionnementVasStatuts.normalize(input.statut()).equals(existing.statut())) {
      transitionStatut(id, actorId, new TransitionInput(input.statut(), null, null));
    }
    return get(id);
  }

  @Transactional
  public DemandeView transitionStatut(long id, int actorId, TransitionInput input) {
    DemandeHeaderRow existing =
        repo.findDemande(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "demande introuvable"));
    String target = ApprovisionnementVasStatuts.normalize(input.statut());
    ApprovisionnementVasStatuts.assertTransition(existing.statut(), target);
    Instant now = Instant.now();
    Integer soumisePar = null;
    Instant soumiseLe = null;
    Integer valideePar = null;
    Instant valideeLe = null;
    Integer rejeteePar = null;
    Instant rejeteeLe = null;
    String motif = trimToNull(input.motifRejet());
    String commentaire = trimToNull(input.commentaire());

    if (ApprovisionnementVasStatuts.SOUMISE.equals(target)
        || ApprovisionnementVasStatuts.EN_ATTENTE_VALIDATION.equals(target)) {
      soumisePar = actorId;
      soumiseLe = now;
      if (ApprovisionnementVasStatuts.SOUMISE.equals(target)
          && ApprovisionnementVasStatuts.BROUILLON.equals(existing.statut())) {
        // soumise puis enchaîne vers en_attente_validation
        repo.updateStatut(
            id,
            ApprovisionnementVasStatuts.SOUMISE,
            actorId,
            now,
            soumisePar,
            soumiseLe,
            null,
            null,
            null,
            null,
            null);
        repo.insertHistorique(
            id, existing.statut(), ApprovisionnementVasStatuts.SOUMISE, actorId, commentaire, now);
        ApprovisionnementVasStatuts.assertTransition(
            ApprovisionnementVasStatuts.SOUMISE, ApprovisionnementVasStatuts.EN_ATTENTE_VALIDATION);
        repo.updateStatut(
            id,
            ApprovisionnementVasStatuts.EN_ATTENTE_VALIDATION,
            actorId,
            now,
            null,
            null,
            null,
            null,
            null,
            null,
            null);
        repo.insertHistorique(
            id,
            ApprovisionnementVasStatuts.SOUMISE,
            ApprovisionnementVasStatuts.EN_ATTENTE_VALIDATION,
            actorId,
            "Mise en attente de validation",
            now);
        return get(id);
      }
    }
    if (ApprovisionnementVasStatuts.VALIDEE.equals(target)) {
      valideePar = actorId;
      valideeLe = now;
    }
    if (ApprovisionnementVasStatuts.REJETEE.equals(target)) {
      rejeteePar = actorId;
      rejeteeLe = now;
      if (motif == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "motif_rejet requis");
      }
    }
    if (ApprovisionnementVasStatuts.VALIDEE.equals(target)) {
      // auto: validee → en_attente_paiement
      repo.updateStatut(
          id, ApprovisionnementVasStatuts.VALIDEE, actorId, now, null, null, valideePar, valideeLe, null, null, null);
      repo.insertHistorique(id, existing.statut(), ApprovisionnementVasStatuts.VALIDEE, actorId, commentaire, now);
      repo.updateStatut(
          id,
          ApprovisionnementVasStatuts.EN_ATTENTE_PAIEMENT,
          actorId,
          now,
          null,
          null,
          null,
          null,
          null,
          null,
          null);
      repo.insertHistorique(
          id,
          ApprovisionnementVasStatuts.VALIDEE,
          ApprovisionnementVasStatuts.EN_ATTENTE_PAIEMENT,
          actorId,
          "Mise en attente de paiement",
          now);
      return get(id);
    }

    repo.updateStatut(
        id, target, actorId, now, soumisePar, soumiseLe, valideePar, valideeLe, rejeteePar, rejeteeLe, motif);
    repo.insertHistorique(
        id, existing.statut(), target, actorId, commentaire != null ? commentaire : motif, now);
    return get(id);
  }

  @Transactional
  public PaiementView createPaiement(long ligneId, int actorId, PaiementInput input) {
    LigneRow ligne =
        repo.findLigne(ligneId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ligne introuvable"));
    DemandeHeaderRow demande =
        repo.findDemande(ligne.demandeId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "demande introuvable"));
    if (!ApprovisionnementVasStatuts.isPayable(demande.statut())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "demande non payable dans ce statut");
    }
    if (ApprovisionnementVasStatuts.VALIDEE.equals(demande.statut())) {
      transitionStatut(
          demande.id(),
          actorId,
          new TransitionInput(ApprovisionnementVasStatuts.EN_ATTENTE_PAIEMENT, null, null));
      demande = repo.findDemande(ligne.demandeId()).orElseThrow();
    }
    String devise = normalizeDevise(input.devise() == null ? ligne.devise() : input.devise());
    if (!devise.equals(ligne.devise())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "devise incompatible avec la ligne");
    }
    BigDecimal montant = nullableScale(input.montant());
    if (montant == null || montant.compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "montant invalide");
    }
    BigDecimal cible =
        ligne.montantValide() != null
            ? ApprovisionnementVasRepository.scale(ligne.montantValide())
            : (ligne.montantPropose() != null
                ? ApprovisionnementVasRepository.scale(ligne.montantPropose())
                : BigDecimal.ZERO);
    BigDecimal dejaPaye = repo.sumPaiementsLigne(ligneId);
    BigDecimal reste = cible.subtract(dejaPaye);
    if (montant.compareTo(reste) > 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "montant supérieur au solde restant (" + reste + ")");
    }
    String mode = normalizeMode(input.modePaiement());
    LocalDate datePaiement = input.datePaiement() == null ? LocalDate.now() : input.datePaiement();
    Instant now = Instant.now();
    long pid =
        repo.insertPaiement(
            ligneId,
            montant,
            devise,
            datePaiement,
            mode,
            trimToNull(input.referencePaiement()),
            trimToNull(input.commentaire()),
            actorId,
            now);
    repo.refreshMontantPayeLigne(ligneId);
    refreshStatutPaiement(demande.id(), actorId, now);
    return repo.listPaiementsByLigne(ligneId).stream()
        .filter(p -> p.id() == pid)
        .findFirst()
        .map(this::toPaiementView)
        .orElseThrow();
  }

  @Transactional(readOnly = true)
  public List<PaiementView> listPaiementsLigne(long ligneId) {
    repo.findLigne(ligneId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ligne introuvable"));
    return repo.listPaiementsByLigne(ligneId).stream().map(this::toPaiementView).toList();
  }

  @Transactional(readOnly = true)
  public List<PaiementView> listPaiementsDemande(long demandeId) {
    repo.findDemande(demandeId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "demande introuvable"));
    return repo.listPaiementsByDemande(demandeId).stream().map(this::toPaiementView).toList();
  }

  @Transactional
  public ReleveSoldeView createReleve(int actorId, ReleveSoldeInput input) {
    String devise = normalizeDevise(input.devise());
    ProduitMmRow produit =
        repo.findProduitMobileMoney(input.produitId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "produit invalide"));
    BigDecimal solde = nullableScale(input.solde());
    if (solde == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "solde requis");
    }
    Instant now = Instant.now();
    Instant releveLe = input.releveLe() == null ? now : input.releveLe();
    long id =
        repo.insertReleveSolde(
            produit.produitId(),
            produit.produit(),
            produitLibelle(produit),
            devise,
            solde,
            releveLe,
            actorId,
            trimToNull(input.commentaire()),
            now);
    return repo.listDerniersSoldes().stream()
        .filter(r -> r.id() == id)
        .findFirst()
        .map(this::toReleveView)
        .orElseGet(
            () ->
                new ReleveSoldeView(
                    id,
                    produit.produitId(),
                    produit.produit(),
                    produitLibelle(produit),
                    devise,
                    solde,
                    releveLe,
                    actorId,
                    trimToNull(input.commentaire()),
                    now));
  }

  @Transactional(readOnly = true)
  public List<ReleveSoldeView> derniersSoldes() {
    return repo.listDerniersSoldes().stream().map(this::toReleveView).toList();
  }

  @Transactional
  public SeuilAlerteView upsertSeuil(int actorId, SeuilAlerteInput input) {
    String devise = normalizeDevise(input.devise());
    ProduitMmRow produit =
        repo.findProduitMobileMoney(input.produitId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "produit invalide"));
    BigDecimal attention = nullableScale(input.seuilAttention());
    BigDecimal critique = nullableScale(input.seuilCritique());
    if (attention == null || critique == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "seuils requis");
    }
    Instant now = Instant.now();
    repo.upsertSeuil(
        produit.produitId(),
        produit.produit(),
        produitLibelle(produit),
        devise,
        attention,
        critique,
        actorId,
        now);
    return repo.listSeuils().stream()
        .filter(s -> s.produitId() == produit.produitId() && s.devise().equals(devise))
        .findFirst()
        .map(
            s ->
                new SeuilAlerteView(
                    s.id(),
                    s.produitId(),
                    s.operateur(),
                    s.produitLibelle(),
                    s.devise(),
                    s.seuilAttention(),
                    s.seuilCritique(),
                    s.modifieLe()))
        .orElseThrow();
  }

  @Transactional(readOnly = true)
  public List<SeuilAlerteView> listSeuils() {
    return repo.listSeuils().stream()
        .map(
            s ->
                new SeuilAlerteView(
                    s.id(),
                    s.produitId(),
                    s.operateur(),
                    s.produitLibelle(),
                    s.devise(),
                    s.seuilAttention(),
                    s.seuilCritique(),
                    s.modifieLe()))
        .toList();
  }

  @Transactional
  public void deleteSeuil(long id) {
    repo.findSeuil(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "seuil introuvable"));
    repo.deleteSeuil(id);
  }

  @Transactional
  public void deleteReleve(long id) {
    repo.findReleve(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "relevé introuvable"));
    repo.deleteReleve(id);
  }

  @Transactional(readOnly = true)
  public List<SoldeAlerteView> alertesSoldes() {
    Map<String, ApprovisionnementVasRepository.SeuilRow> seuils = new HashMap<>();
    for (var s : repo.listSeuils()) {
      seuils.put(s.produitId() + "|" + s.devise(), s);
    }
    return repo.listDerniersSoldes().stream()
        .map(
            r -> {
              var seuil = seuils.get(r.produitId() + "|" + r.devise());
              BigDecimal attention = seuil == null ? null : seuil.seuilAttention();
              BigDecimal critique = seuil == null ? null : seuil.seuilCritique();
              String niveau = "ok";
              if (critique != null && r.solde().compareTo(critique) <= 0) {
                niveau = "critique";
              } else if (attention != null && r.solde().compareTo(attention) <= 0) {
                niveau = "attention";
              }
              return new SoldeAlerteView(
                  r.produitId(),
                  r.operateur(),
                  r.produitLibelle(),
                  r.devise(),
                  r.solde(),
                  attention,
                  critique,
                  niveau,
                  r.releveLe());
            })
        .filter(a -> !"ok".equals(a.niveau()))
        .toList();
  }

  @Transactional(readOnly = true)
  public DashboardKpiView dashboard() {
    DashboardAggRow agg = repo.dashboardAgg();
    BigDecimal delai = repo.delaiTraitementHeures();
    Instant now = Instant.now();
    int nbRetard = 0;
    for (DemandeHeaderRow d : repo.listOuvertesPourDelai()) {
      if (isEnRetard(d.statut(), d.soumiseLe(), d.creeLe(), delai, now)) {
        nbRetard++;
      }
    }
    return new DashboardKpiView(
        agg.proposeUsd(),
        agg.proposeCdf(),
        agg.valideUsd(),
        agg.valideCdf(),
        agg.payeUsd(),
        agg.payeCdf(),
        repo.countByStatut(ApprovisionnementVasStatuts.BROUILLON),
        repo.countStatutsIn(
            List.of(
                ApprovisionnementVasStatuts.SOUMISE,
                ApprovisionnementVasStatuts.EN_ATTENTE_VALIDATION,
                ApprovisionnementVasStatuts.VALIDEE,
                ApprovisionnementVasStatuts.EN_ATTENTE_PAIEMENT,
                ApprovisionnementVasStatuts.PARTIELLEMENT_PAYEE)),
        nbRetard,
        repo.countByStatut(ApprovisionnementVasStatuts.PAYEE),
        delai);
  }

  private void refreshStatutPaiement(long demandeId, int actorId, Instant now) {
    DemandeHeaderRow demande = repo.findDemande(demandeId).orElseThrow();
    List<LigneRow> lignes = repo.listLignes(demandeId);
    boolean anyPaye = false;
    boolean allPaye = !lignes.isEmpty();
    for (LigneRow l : lignes) {
      BigDecimal cible =
          l.montantValide() != null
              ? ApprovisionnementVasRepository.scale(l.montantValide())
              : (l.montantPropose() != null
                  ? ApprovisionnementVasRepository.scale(l.montantPropose())
                  : BigDecimal.ZERO);
      BigDecimal paye =
          l.montantPaye() == null
              ? BigDecimal.ZERO
              : ApprovisionnementVasRepository.scale(l.montantPaye());
      if (paye.compareTo(BigDecimal.ZERO) > 0) {
        anyPaye = true;
      }
      if (cible.compareTo(BigDecimal.ZERO) <= 0 || paye.compareTo(cible) < 0) {
        allPaye = false;
      }
    }
    String target;
    if (allPaye) {
      target = ApprovisionnementVasStatuts.PAYEE;
    } else if (anyPaye) {
      target = ApprovisionnementVasStatuts.PARTIELLEMENT_PAYEE;
    } else {
      target = ApprovisionnementVasStatuts.EN_ATTENTE_PAIEMENT;
    }
    if (!target.equals(demande.statut())) {
      ApprovisionnementVasStatuts.assertTransition(demande.statut(), target);
      repo.updateStatut(demandeId, target, actorId, now, null, null, null, null, null, null, null);
      repo.insertHistorique(demandeId, demande.statut(), target, actorId, "Mise à jour paiements", now);
    }
  }

  private void persistLignes(long demandeId, LocalDate dateRef, List<LigneInput> lignes) {
    Set<String> seen = new HashSet<>();
    var periodes = ApprovisionnementPeriodes.resolve(dateRef);
    for (LigneInput line : lignes) {
      if (line == null) {
        continue;
      }
      String devise = normalizeDevise(line.devise());
      String key = line.produitId() + "|" + devise;
      if (!seen.add(key)) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "produit et devise déjà présents dans la demande");
      }
      ProduitMmRow produit =
          repo.findProduitMobileMoney(line.produitId())
              .orElseThrow(
                  () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "produit invalide"));
      TotauxPeriode j1 = repo.totauxConsommation(line.produitId(), devise, periodes.j1());
      TotauxPeriode j2 = repo.totauxConsommation(line.produitId(), devise, periodes.j2());
      BigDecimal moyenne =
          ApprovisionnementVasRepository.moyenne(j1.consommation(), j2.consommation());
      String libelle =
          line.libelleSolde() == null || line.libelleSolde().isBlank()
              ? "Solde à 08h"
              : line.libelleSolde().trim();
      repo.insertLigne(
          demandeId,
          new LigneInsert(
              produit.produitId(),
              produit.produit(),
              produitLibelle(produit),
              devise,
              dateRef,
              periodes.j1().debut(),
              periodes.j1().fin(),
              periodes.j2().debut(),
              periodes.j2().fin(),
              ApprovisionnementVasRepository.scale(j1.depots()),
              ApprovisionnementVasRepository.scale(j1.retraits()),
              ApprovisionnementVasRepository.scale(j1.consommation()),
              ApprovisionnementVasRepository.scale(j2.depots()),
              ApprovisionnementVasRepository.scale(j2.retraits()),
              ApprovisionnementVasRepository.scale(j2.consommation()),
              moyenne,
              libelle,
              nullableScale(line.solde08h()),
              nullableScale(line.montantPropose()),
              nullableScale(line.montantValide()),
              BigDecimal.ZERO));
    }
  }

  private DemandeView toDemandeView(
      DemandeHeaderRow header,
      List<LigneRow> lignes,
      List<ApprovisionnementVasRepository.HistoriqueRow> historique) {
    BigDecimal delai = repo.delaiTraitementHeures();
    boolean retard =
        isEnRetard(header.statut(), header.soumiseLe(), header.creeLe(), delai, Instant.now());
    return new DemandeView(
        header.id(),
        header.dateReference(),
        header.statut(),
        header.commentaire(),
        header.motifRejet(),
        header.creePar(),
        header.creeLe(),
        header.modifiePar(),
        header.modifieLe(),
        header.soumisePar(),
        header.soumiseLe(),
        header.valideePar(),
        header.valideeLe(),
        header.rejeteePar(),
        header.rejeteeLe(),
        retard,
        delai,
        lignes.stream().map(this::toLigneView).toList(),
        historique.stream()
            .map(
                h ->
                    new HistoriqueStatutView(
                        h.id(),
                        h.demandeId(),
                        h.ancienStatut(),
                        h.nouveauStatut(),
                        h.utilisateurId(),
                        h.commentaire(),
                        h.creeLe()))
            .toList());
  }

  private LigneView toLigneView(LigneRow r) {
    BigDecimal paye =
        r.montantPaye() == null ? BigDecimal.ZERO : ApprovisionnementVasRepository.scale(r.montantPaye());
    BigDecimal cible =
        r.montantValide() != null
            ? ApprovisionnementVasRepository.scale(r.montantValide())
            : (r.montantPropose() != null
                ? ApprovisionnementVasRepository.scale(r.montantPropose())
                : BigDecimal.ZERO);
    BigDecimal reste = cible.subtract(paye);
    if (reste.compareTo(BigDecimal.ZERO) < 0) {
      reste = BigDecimal.ZERO;
    }
    return new LigneView(
        r.id(),
        r.produitId(),
        r.operateur(),
        r.produitLibelle(),
        r.devise(),
        r.dateReference(),
        r.j1Debut(),
        r.j1Fin(),
        r.j2Debut(),
        r.j2Fin(),
        r.depotsJ1(),
        r.retraitsJ1(),
        r.consommationJ1(),
        r.depotsJ2(),
        r.retraitsJ2(),
        r.consommationJ2(),
        r.moyenne(),
        r.libelleSolde() == null ? "Solde à 08h" : r.libelleSolde(),
        r.solde08h(),
        r.montantPropose(),
        r.montantValide(),
        paye,
        reste);
  }

  private PaiementView toPaiementView(ApprovisionnementVasRepository.PaiementRow p) {
    return new PaiementView(
        p.id(),
        p.ligneId(),
        p.montant(),
        p.devise(),
        p.datePaiement(),
        p.modePaiement(),
        p.referencePaiement(),
        p.commentaire(),
        p.utilisateurId(),
        p.creeLe());
  }

  private ReleveSoldeView toReleveView(ApprovisionnementVasRepository.ReleveRow r) {
    return new ReleveSoldeView(
        r.id(),
        r.produitId(),
        r.operateur(),
        r.produitLibelle(),
        r.devise(),
        r.solde(),
        r.releveLe(),
        r.utilisateurId(),
        r.commentaire(),
        r.creeLe());
  }

  private ProduitOption toProduitOption(ProduitMmRow p) {
    return new ProduitOption(
        p.produitId(), p.produit(), produitLibelle(p), p.module(), p.ecran(), p.partenaire());
  }

  private static ConsommationPeriodeView toPeriodeView(
      ApprovisionnementPeriodes.Periode periode, TotauxPeriode totaux) {
    return new ConsommationPeriodeView(
        new PeriodeView(periode.debut(), periode.fin()),
        ApprovisionnementVasRepository.scale(totaux.depots()),
        ApprovisionnementVasRepository.scale(totaux.retraits()),
        ApprovisionnementVasRepository.scale(totaux.consommation()));
  }

  private static boolean isEnRetard(
      String statut, Instant soumiseLe, Instant creeLe, BigDecimal delaiHeures, Instant now) {
    if (ApprovisionnementVasStatuts.PAYEE.equals(statut)
        || ApprovisionnementVasStatuts.REJETEE.equals(statut)
        || ApprovisionnementVasStatuts.ANNULEE.equals(statut)
        || ApprovisionnementVasStatuts.BROUILLON.equals(statut)) {
      return false;
    }
    Instant start = soumiseLe != null ? soumiseLe : creeLe;
    if (start == null || delaiHeures == null) {
      return false;
    }
    long minutes = delaiHeures.multiply(BigDecimal.valueOf(60)).longValue();
    return Duration.between(start, now).toMinutes() > minutes;
  }

  private static String produitLibelle(ProduitMmRow p) {
    String base = p.produit() == null ? "" : p.produit().trim();
    String partenaire = p.partenaire() == null ? "" : p.partenaire().trim();
    if (partenaire.isBlank() || partenaire.equalsIgnoreCase(base)) {
      return base;
    }
    return base + " (" + partenaire + ")";
  }

  private static LocalDate requireDate(DemandeInput input) {
    if (input == null || input.dateReference() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date_reference requise");
    }
    ApprovisionnementPeriodes.resolve(input.dateReference());
    return input.dateReference();
  }

  private static List<LigneInput> requireLignes(DemandeInput input) {
    if (input.lignes() == null || input.lignes().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "au moins une ligne requise");
    }
    return input.lignes();
  }

  private static String normalizeDevise(String devise) {
    String v = devise == null ? "" : devise.trim().toUpperCase(Locale.ROOT);
    if (!DEVISES.contains(v)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "devise invalide");
    }
    return v;
  }

  private static String normalizeMode(String mode) {
    String v = mode == null ? "" : mode.trim().toLowerCase(Locale.ROOT);
    if (!MODES_PAIEMENT.contains(v)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mode_paiement invalide");
    }
    return v;
  }

  private static BigDecimal nullableScale(BigDecimal v) {
    return v == null ? null : ApprovisionnementVasRepository.scale(v);
  }

  private static String trimToNull(String v) {
    if (v == null) {
      return null;
    }
    String t = v.trim();
    return t.isEmpty() ? null : t;
  }
}
