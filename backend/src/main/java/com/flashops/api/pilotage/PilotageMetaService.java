package com.flashops.api.pilotage;

import com.flashops.api.web.dto.PilotageDtos;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class PilotageMetaService {

  private static final List<PilotageDtos.DomaineOption> DOMAINES =
      List.of(
          new PilotageDtos.DomaineOption("transfert", "Transferts internationaux"),
          new PilotageDtos.DomaineOption("monnaie", "Monnaie électronique"),
          new PilotageDtos.DomaineOption("service", "Services (VAS, TV, recharges)"));

  private final PilotageMetaRepository repository;

  public PilotageMetaService(PilotageMetaRepository repository) {
    this.repository = repository;
  }

  public PilotageDtos.MetaResponse meta() {
    return meta(PilotageDomainScope.ALL);
  }

  public PilotageDtos.MetaResponse meta(List<String> allowedDomaines) {
    var domaines =
        DOMAINES.stream()
            .filter(d -> allowedDomaines == null || allowedDomaines.isEmpty() || allowedDomaines.contains(d.code()))
            .toList();
    if (domaines.isEmpty()) {
      domaines = DOMAINES;
    }
    var snapshot = repository.loadSnapshot();
    if (snapshot.isPresent()) {
      var s = snapshot.get();
      return new PilotageDtos.MetaResponse(
          domaines, s.devises(), s.dataFrom(), s.dataTo(), true);
    }
    return new PilotageDtos.MetaResponse(
        domaines, List.of("CDF", "USD"), "2022-01-01", null, false);
  }
}
