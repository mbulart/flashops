package com.flashops.api.referentiel.geo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class GeoReferentielBootstrap implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(GeoReferentielBootstrap.class);

  private final GeoReferentielService geo;

  public GeoReferentielBootstrap(GeoReferentielService geo) {
    this.geo = geo;
  }

  @Override
  public void run(ApplicationArguments args) {
    var result = geo.seedPaysIfEmpty();
    if (!result.skipped()) {
      log.info("Référentiel geo : {} pays amorcés depuis le seed JSON", result.pays());
    }
    var local = geo.seedLocalHierarchiesIfMissing();
    if (!local.skipped() && local.provinces() > 0) {
      log.info(
          "Référentiel geo : seed local — {} provinces, {} villes, {} territoires, {} communes",
          local.provinces(),
          local.villes(),
          local.territoires(),
          local.communes());
    }
  }
}
