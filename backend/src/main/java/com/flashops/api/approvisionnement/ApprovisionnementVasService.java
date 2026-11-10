package com.flashops.api.approvisionnement;

import com.flashops.api.approvisionnement.ApprovisionnementVasRepository.LigneInsert;
import com.flashops.api.approvisionnement.ApprovisionnementVasRepository.ProduitMmRow;
import com.flashops.api.approvisionnement.ApprovisionnementVasRepository.TotauxPeriode;
import com.flashops.api.web.dto.ApprovisionnementVasDtos;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ConsommationCalculView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ConsommationPeriodeView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeListItem;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.DemandeView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.LigneInput;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.LigneView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.PeriodeView;
import com.flashops.api.web.dto.ApprovisionnementVasDtos.ProduitOption;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ApprovisionnementVasService {

  private static final Set<String> STATUTS =
      Set.of("brouillon", "soumise", "validee", "payee", "annulee");
  private static final Set<String> DEVISES = Set.of("USD", "CDF");

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
  public List<DemandeListItem> list(int limit) {
    return repo.listDemandes(limit).stream()
        .map(
            r ->
                new DemandeListItem(
                    r.id(), r.dateReference(), r.statut(), r.nbLignes(), r.creeLe()))
        .toList();
  }

  @Transactional(readOnly = true)
  public DemandeView get(long id) {
    var header =
        repo.findDemande(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "demande introuvable"));
    return toDemandeView(header, repo.listLignes(id));
  }

  @Transactional
  public DemandeView create(int actorId, DemandeInput input) {
    LocalDate dateRef = requireDate(input);
    String statut = normalizeStatut(input.statut());
    List<LigneInput> lignes = requireLignes(input);
    Instant now = Instant.now();
    long id =
        repo.insertDemande(dateRef, statut, trimToNull(input.commentaire()), actorId, now);
    persistLignes(id, dateRef, lignes);
    return get(id);
  }

  @Transactional
  public DemandeView update(long id, DemandeInput input) {
    var existing =
        repo.findDemande(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "demande introuvable"));
    LocalDate dateRef = requireDate(input);
    String statut = normalizeStatut(input.statut() == null ? existing.statut() : input.statut());
    List<LigneInput> lignes = requireLignes(input);
    Instant now = Instant.now();
    repo.updateDemande(id, dateRef, statut, trimToNull(input.commentaire()), now);
    repo.deleteLignes(id);
    persistLignes(id, dateRef, lignes);
    return get(id);
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
              nullableScale(line.solde08h()),
              nullableScale(line.montantPropose()),
              nullableScale(line.montantValide()),
              nullableScale(line.montantPaye())));
    }
  }

  private DemandeView toDemandeView(
      ApprovisionnementVasRepository.DemandeHeaderRow header,
      List<ApprovisionnementVasRepository.LigneRow> lignes) {
    return new DemandeView(
        header.id(),
        header.dateReference(),
        header.statut(),
        header.commentaire(),
        header.creePar(),
        header.creeLe(),
        header.modifieLe(),
        lignes.stream().map(this::toLigneView).toList());
  }

  private LigneView toLigneView(ApprovisionnementVasRepository.LigneRow r) {
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
        r.solde08h(),
        r.montantPropose(),
        r.montantValide(),
        r.montantPaye());
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

  private static String normalizeStatut(String statut) {
    String v =
        (statut == null || statut.isBlank() ? "brouillon" : statut.trim().toLowerCase(Locale.ROOT));
    if (!STATUTS.contains(v)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "statut invalide");
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
