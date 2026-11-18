package com.flashops.api.pilotage;

import com.flashops.api.admin.AppParametersService;
import com.flashops.api.web.dto.PilotageDtos;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PilotageAnalyticsService {

  private static final java.util.Set<String> DOMAINES =
      java.util.Set.of("transfert", "monnaie", "service");

  private final PilotageAnalyticsRepository repository;
  private final AppParametersService appParameters;

  public PilotageAnalyticsService(
      PilotageAnalyticsRepository repository, AppParametersService appParameters) {
    this.repository = repository;
    this.appParameters = appParameters;
  }

  public List<PilotageDtos.ZoneActivite> zoneActivite(PilotageBundleQuery q) {
    q = withMoneyContext(q);
    validate(q);
    return repository.loadZoneActivite(q).stream()
        .map(r -> new PilotageDtos.ZoneActivite(r.code(), r.nb(), r.montant()))
        .toList();
  }

  public PilotageDtos.BundleResponse bundle(PilotageBundleQuery q) {
    q = withMoneyContext(q);
    validate(q);
    var totals =
        repository
            .loadPeriodTotals(q)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "pilotage indisponible"));

    double ticket =
        totals.nbMontant() > 0
            ? totals.montant().doubleValue() / totals.nbMontant()
            : 0d;

    LocalDate end;
    try {
      end = LocalDate.parse(q.to());
    } catch (DateTimeParseException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date fin invalide");
    }
    LocalDate refMonth = end.withDayOfMonth(1);
    var currentM = repository.loadMonthCompare(q, refMonth.toString()).orElse(null);
    var prevM = repository.loadMonthCompare(q, refMonth.minusMonths(1).toString()).orElse(null);
    var yoyM = repository.loadMonthCompare(q, refMonth.minusYears(1).toString()).orElse(null);

    var series =
        repository.loadTimeseries(q).stream()
            .map(r -> new PilotageDtos.TimeseriesPoint(r.jour(), r.nb(), r.montant()))
            .toList();
    var products =
        repository.loadProductBreakdown(q).stream()
            .map(
                r ->
                    new PilotageDtos.ProductSlice(
                        r.produitId(),
                        r.module(),
                        r.produit(),
                        r.ecran(),
                        r.partenaire(),
                        r.nb(),
                        r.montant()))
            .toList();
    // Top montant + top volume pour que le toggle Volume/Montant côté front ait les bonnes séries.
    var topByMontant =
        products.stream().limit(8).map(PilotageDtos.ProductSlice::produitId).toList();
    var topByVolume =
        products.stream()
            .sorted((a, b) -> Long.compare(b.volume(), a.volume()))
            .limit(8)
            .map(PilotageDtos.ProductSlice::produitId)
            .toList();
    var topProduitIds =
        java.util.stream.Stream.concat(topByMontant.stream(), topByVolume.stream())
            .distinct()
            .toList();
    var productTimeseries =
        repository.loadProductTimeseries(q, topProduitIds).stream()
            .map(
                r ->
                    new PilotageDtos.ProductTimeseriesPoint(
                        r.jour(),
                        r.produitId(),
                        r.module(),
                        r.produit(),
                        r.ecran(),
                        r.partenaire(),
                        r.nb(),
                        r.montant()))
            .toList();
    var agencies = toAgenceRanks(repository.loadTopAgences(q, 10));
    var geoPoints =
        repository.loadGeoAgences(q, 2000).stream()
            .map(
                r ->
                    new PilotageDtos.AgenceGeoPoint(
                        r.agenceId(),
                        r.codeAgence(),
                        r.nom(),
                        r.latitude(),
                        r.longitude(),
                        r.nb(),
                        r.montant()))
            .toList();

    boolean couloirIgnored = false;
    var sagWuCommission = repository.loadSagWuCommission(q);
    var totalsForKpi = totals.withCommission(sagWuCommission);

    return new PilotageDtos.BundleResponse(
        q.from(),
        q.to(),
        String.join(",", q.resolvedDomaines()),
        q.devise(),
        new PilotageDtos.KpiBlock(
            totalsForKpi.nb(),
            totalsForKpi.montant(),
            ticket,
            totalsForKpi.nbSucces(),
            growthPct(currentM != null ? currentM.montant() : null, prevM != null ? prevM.montant() : null),
            growthPct(currentM != null ? currentM.montant() : null, yoyM != null ? yoyM.montant() : null),
            refMonth.toString(),
            totalsForKpi.commission(),
            totalsForKpi.commissionFcn(),
            totalsForKpi.commissionAgent(),
            totalsForKpi.commissionFcnAgent()),
        series,
        products,
        productTimeseries,
        agencies,
        geoPoints,
        couloirIgnored);
  }

  public List<PilotageDtos.AgenceGeoPoint> allLocatedAgences(List<Integer> restrictAgenceIds) {
    return repository.loadAllLocatedAgences(restrictAgenceIds).stream()
        .map(
            r ->
                new PilotageDtos.AgenceGeoPoint(
                    r.agenceId(),
                    r.codeAgence(),
                    r.nom(),
                    r.latitude(),
                    r.longitude(),
                    r.nb(),
                    r.montant()))
        .toList();
  }

  public PilotageDtos.AgenceFiche agenceFiche(int agenceId) {
    if (agenceId <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "agence invalide");
    }
    try {
      return repository
          .loadAgenceFiche(agenceId)
          .map(
              r ->
                  new PilotageDtos.AgenceFiche(
                      r.agenceId(),
                      r.codeAgence(),
                      r.nom(),
                      r.categorie(),
                      r.posId(),
                      r.region(),
                      r.zone(),
                      r.ville(),
                      r.commune(),
                      r.province(),
                      r.pays(),
                      r.latitude(),
                      r.longitude()))
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "agence introuvable"));
    } catch (DataAccessException ex) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "pilotage indisponible");
    }
  }

  public PilotageDtos.AgenceTransactionsPage agenceTransactions(
      PilotageBundleQuery q, int agenceId, int page, int size, String partyQuery) {
    return agenceTransactions(q, agenceId, page, size, partyQuery, false);
  }

  public PilotageDtos.AgenceTransactionsPage agenceTransactions(
      PilotageBundleQuery q,
      int agenceId,
      int page,
      int size,
      String partyQuery,
      boolean export) {
    q = withMoneyContext(q);
    validate(q);
    if (agenceId <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "agence invalide");
    }
    try {
      var pageData = repository.loadAgenceTransactions(q, agenceId, page, size, partyQuery, export);
      var lignes =
          pageData.rows().stream()
              .map(
                  r ->
                      new PilotageDtos.AgenceTransaction(
                          r.operationId(),
                          r.jour(),
                          r.heure(),
                          r.produit(),
                          r.ecran(),
                          r.operateur(),
                          r.expediteur(),
                          r.beneficiaire(),
                          r.statut(),
                          r.montant()))
              .toList();
      return new PilotageDtos.AgenceTransactionsPage(
          pageData.total(),
          pageData.page(),
          pageData.size(),
          pageData.moyenne(),
          pageData.montantTotal(),
          lignes);
    } catch (DataAccessException ex) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "pilotage indisponible");
    }
  }

  public PilotageDtos.TransactionsPage transactions(
      PilotageBundleQuery q, int page, int size, String partyQuery) {
    q = withMoneyContext(q);
    validate(q);
    try {
      var pageData = repository.loadTransactions(q, page, size, partyQuery);
      var lignes =
          pageData.rows().stream()
              .map(
                  r ->
                      new PilotageDtos.TransactionListItem(
                          r.operationId(),
                          r.jour(),
                          r.heure(),
                          r.agenceId(),
                          r.codeAgence(),
                          r.agenceNom(),
                          r.produit(),
                          r.ecran(),
                          r.operateur(),
                          r.expediteur(),
                          r.beneficiaire(),
                          r.statut(),
                          r.devise(),
                          r.montant()))
              .toList();
      return new PilotageDtos.TransactionsPage(
          pageData.total(),
          pageData.page(),
          pageData.size(),
          pageData.moyenne(),
          pageData.montantTotal(),
          lignes);
    } catch (DataAccessException ex) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "pilotage indisponible");
    }
  }

  public PilotageDtos.TransactionDetail transactionDetail(
      long operationId, List<Integer> restrictAgenceIds) {
    if (operationId <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "opération invalide");
    }
    try {
      return repository
          .loadTransactionDetail(operationId, restrictAgenceIds)
          .map(
              r ->
                  new PilotageDtos.TransactionDetail(
                      r.operationId(),
                      r.jour(),
                      r.heure(),
                      r.dateOperation(),
                      r.reference(),
                      r.sourceId(),
                      r.idExterne(),
                      r.cleMetier(),
                      r.agenceId(),
                      r.codeAgence(),
                      r.agenceNom(),
                      r.posId(),
                      r.fpAgent(),
                      r.produit(),
                      r.module(),
                      r.ecran(),
                      r.partenaire(),
                      r.operateur(),
                      r.expediteur(),
                      r.beneficiaire(),
                      r.telephone(),
                      r.telephoneExpediteur(),
                      r.numeroAbonnement(),
                      r.numeroId(),
                      r.commentaire(),
                      r.statut(),
                      r.devise(),
                      r.deviseReception(),
                      r.typeOperation(),
                      r.paysOrigine(),
                      r.paysDestination(),
                      r.villeOrigine(),
                      r.montant(),
                      r.montantTotal(),
                      r.montantCaisse(),
                      r.montantPaye(),
                      r.frais(),
                      r.taxes(),
                      r.marge(),
                      r.commission(),
                      r.commissionFcn(),
                      r.commissionAgent(),
                      r.commissionFcnAgent(),
                      r.taux(),
                      r.montantReception(),
                      r.tauxChange()))
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "transaction introuvable"));
    } catch (DataAccessException ex) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "pilotage indisponible");
    }
  }

  public PilotageDtos.AgenceClassementPage classementAgences(
      PilotageBundleQuery q, boolean worst, int page, int size) {
    return classementAgences(q, worst, page, size, false);
  }

  public PilotageDtos.AgenceClassementPage classementAgences(
      PilotageBundleQuery q, boolean worst, int page, int size, boolean byVolume) {
    q = withMoneyContext(q);
    validate(q);
    var raw = repository.loadTopAgencesPage(q, page, size, worst, byVolume);
    return new PilotageDtos.AgenceClassementPage(
        raw.total(), raw.page(), raw.size(), toAgenceRanks(raw.rows()));
  }

  public PilotageDtos.CouloirClassementPage classementCouloirs(
      PilotageBundleQuery q, boolean worst, int page, int size) {
    q = withMoneyContext(q);
    validate(q);
    var raw = repository.loadTopCorridorsPage(q, page, size, worst);
    var items =
        raw.rows().stream()
            .map(
                r ->
                    new PilotageDtos.CouloirRank(
                        r.code(), r.label(), r.nb(), r.montant() == null ? BigDecimal.ZERO : r.montant()))
            .toList();
    return new PilotageDtos.CouloirClassementPage(raw.total(), raw.page(), raw.size(), items);
  }

  public PilotageDtos.ExportResponse export(PilotageBundleQuery q) {
    q = withMoneyContext(q);
    validate(q);
    var agencies = toAgenceRanks(repository.loadTopAgences(q, 5000));
    var lignes = repository.loadLignes(q, 20000);
    var rows =
        lignes.rows().stream()
            .map(
                r ->
                    new PilotageDtos.LigneExport(
                        r.agence(),
                        r.codeAgence(),
                        r.posId(),
                        r.nom(),
                        r.expediteur(),
                        r.beneficiaire(),
                        r.telephone(),
                        r.telephoneExpediteur(),
                        r.numero(),
                        r.jour(),
                        r.montant(),
                        r.statut()))
            .toList();
    return new PilotageDtos.ExportResponse(agencies, rows, lignes.truncated(), lignes.limit());
  }

  public PilotageDtos.ProduitsMensuelExport exportProduitsMensuel(PilotageBundleQuery q) {
    q = withMoneyContext(q);
    validate(q);
    var rows =
        repository.loadProductMonthly(q).stream()
            .map(
                r ->
                    new PilotageDtos.ProductMonthlyPoint(
                        r.mois(),
                        r.produitId(),
                        r.module(),
                        r.produit(),
                        r.ecran(),
                        r.partenaire(),
                        r.nb(),
                        r.montant()))
            .toList();
    return new PilotageDtos.ProduitsMensuelExport(
        q.from(), q.to(), String.join(",", q.resolvedDomaines()), q.devise(), rows);
  }

  public PilotageDtos.AgencesPeriodiqueExport exportAgencesPeriodique(
      PilotageBundleQuery q, String grain, boolean worst, boolean byVolume) {
    q = withMoneyContext(q);
    validate(q);
    String resolved = "week".equalsIgnoreCase(grain) ? "week" : "month";
    var flat = repository.loadAgencesPeriodiques(q, resolved, worst, byVolume);
    var byPeriod = new java.util.LinkedHashMap<String, java.util.List<PilotageAnalyticsRepository.AgencePeriodiqueRow>>();
    for (var row : flat) {
      byPeriod.computeIfAbsent(row.periode(), k -> new java.util.ArrayList<>()).add(row);
    }
    var periods = new java.util.ArrayList<PilotageDtos.AgencePeriodeBucket>();
    for (var entry : byPeriod.entrySet()) {
      var rows = entry.getValue();
      if (rows.isEmpty()) {
        continue;
      }
      var first = rows.get(0);
      long volume = 0L;
      java.math.BigDecimal montant = java.math.BigDecimal.ZERO;
      java.math.BigDecimal commission = java.math.BigDecimal.ZERO;
      java.math.BigDecimal commissionFcn = java.math.BigDecimal.ZERO;
      java.math.BigDecimal commissionAgent = java.math.BigDecimal.ZERO;
      java.math.BigDecimal commissionFcnAgent = java.math.BigDecimal.ZERO;
      var agencies = new java.util.ArrayList<PilotageDtos.AgenceRank>();
      for (var r : rows) {
        volume += r.nb();
        montant = montant.add(nullToZero(r.montant()));
        commission = commission.add(nullToZero(r.commission()));
        commissionFcn = commissionFcn.add(nullToZero(r.commissionFcn()));
        commissionAgent = commissionAgent.add(nullToZero(r.commissionAgent()));
        commissionFcnAgent = commissionFcnAgent.add(nullToZero(r.commissionFcnAgent()));
        agencies.add(
            new PilotageDtos.AgenceRank(
                r.agenceId(),
                r.codeAgence(),
                r.nom(),
                r.categorie(),
                r.posId(),
                r.region(),
                r.zone(),
                r.nb(),
                r.montant(),
                r.commission(),
                r.commissionFcn(),
                r.commissionAgent(),
                r.commissionFcnAgent()));
      }
      periods.add(
          new PilotageDtos.AgencePeriodeBucket(
              first.periode(),
              periodLabel(resolved, first.periode(), first.periodeDebut(), first.periodeFin()),
              first.periodeDebut(),
              first.periodeFin(),
              volume,
              montant,
              commission,
              commissionFcn,
              commissionAgent,
              commissionFcnAgent,
              agencies));
    }
    return new PilotageDtos.AgencesPeriodiqueExport(
        resolved,
        q.from(),
        q.to(),
        String.join(",", q.resolvedDomaines()),
        q.devise(),
        periods);
  }

  private static java.math.BigDecimal nullToZero(java.math.BigDecimal value) {
    return value == null ? java.math.BigDecimal.ZERO : value;
  }

  private static String periodLabel(String grain, String periode, String debut, String fin) {
    try {
      if ("week".equals(grain)) {
        var start = java.time.LocalDate.parse(debut);
        var end = java.time.LocalDate.parse(fin);
        int week = start.get(java.time.temporal.IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        var fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
        return "Semaine " + week + " · " + start.format(fmt) + " – " + end.format(fmt);
      }
      var start = java.time.LocalDate.parse(debut);
      var fmt =
          java.time.format.DateTimeFormatter.ofPattern("MMMM yyyy", java.util.Locale.FRENCH);
      String label = start.format(fmt);
      return label.isEmpty() ? periode : Character.toUpperCase(label.charAt(0)) + label.substring(1);
    } catch (RuntimeException ex) {
      return periode == null ? "" : periode;
    }
  }

  private static java.util.List<PilotageDtos.AgenceRank> toAgenceRanks(
      java.util.List<PilotageAnalyticsRepository.AgenceRankRow> rows) {
    return rows.stream()
        .map(
            r ->
                new PilotageDtos.AgenceRank(
                    r.agenceId(),
                    r.codeAgence(),
                    r.nom(),
                    r.categorie(),
                    r.posId(),
                    r.region(),
                    r.zone(),
                    r.nb(),
                    r.montant(),
                    r.commission(),
                    r.commissionFcn(),
                    r.commissionAgent(),
                    r.commissionFcnAgent()))
        .toList();
  }

  private static Double growthPct(BigDecimal current, BigDecimal previous) {
    if (current == null || previous == null) {
      return null;
    }
    if (previous.compareTo(BigDecimal.ZERO) == 0) {
      return current.compareTo(BigDecimal.ZERO) == 0 ? 0d : null;
    }
    var diff = current.subtract(previous);
    return diff
        .multiply(BigDecimal.valueOf(100))
        .divide(previous, 4, RoundingMode.HALF_UP)
        .doubleValue();
  }

  private PilotageBundleQuery withMoneyContext(PilotageBundleQuery q) {
    List<String> devises = PilotageMoneySql.ensureNonEmpty(q.devises(), q.devise());
    var params = appParameters.requireRow();
    BigDecimal tauxCdf = params.getTauxChangeUsdCdf();
    if (tauxCdf == null) {
      tauxCdf = BigDecimal.ZERO;
    }
    BigDecimal tauxFcn = params.getTauxChangeUsdFcn();
    if (tauxFcn == null) {
      tauxFcn = BigDecimal.ZERO;
    }
    String display = PilotageMoneySql.displayDevise(devises, tauxCdf, tauxFcn);
    if (display.isBlank() && !devises.isEmpty()) {
      display = devises.get(0);
    }
    return q.withMoney(devises, display, tauxCdf, tauxFcn);
  }

  private static void validate(PilotageBundleQuery q) {
    var domaines = q.resolvedDomaines();
    if (domaines.isEmpty() || domaines.stream().anyMatch(d -> !DOMAINES.contains(d))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "domaine invalide");
    }
    if (q.resolvedDevises().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "devise requise");
    }
    if (q.from() == null || q.to() == null || q.from().compareTo(q.to()) > 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "période invalide");
    }
  }
}
