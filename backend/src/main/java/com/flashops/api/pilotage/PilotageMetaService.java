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
    var snapshot = repository.loadSnapshot();
    if (snapshot.isPresent()) {
      var s = snapshot.get();
      return new PilotageDtos.MetaResponse(
          DOMAINES, s.devises(), s.dataFrom(), s.dataTo(), true);
    }
    return new PilotageDtos.MetaResponse(
        DOMAINES, List.of("CDF", "USD"), "2022-01-01", null, false);
  }
}
