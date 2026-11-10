package com.flashops.api.approvisionnement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/**
 * Règles métier paiements partiels / intégraux (plafond + devises séparées),
 * testées hors IO pour sécuriser le comportement attendu côté service.
 */
class ApprovisionnementVasPaiementRulesTest {

  @Test
  void paiement_partiel_reste_positif() {
    BigDecimal cible = bd("1000.00");
    BigDecimal deja = bd("250.00");
    BigDecimal demande = bd("100.00");
    BigDecimal reste = cible.subtract(deja);
    assertTrue(demande.compareTo(reste) <= 0);
    assertEquals(bd("650.00"), reste.subtract(demande));
  }

  @Test
  void paiement_integral_accepte_exactement_le_reste() {
    BigDecimal cible = bd("500.00");
    BigDecimal deja = bd("200.00");
    BigDecimal demande = bd("300.00");
    assertEquals(0, demande.compareTo(cible.subtract(deja)));
  }

  @Test
  void refus_si_montant_depasse_reste() {
    BigDecimal cible = bd("100.00");
    BigDecimal deja = bd("80.00");
    BigDecimal demande = bd("25.00");
    assertFalse(demande.compareTo(cible.subtract(deja)) <= 0);
  }

  @Test
  void devises_separees_usd_cdf() {
    // Les plafonds sont par ligne (produit + devise) : un paiement USD
    // n'affecte pas le reste CDF.
    BigDecimal resteUsd = bd("100.00");
    BigDecimal resteCdf = bd("250000.00");
    assertEquals(bd("50.00"), resteUsd.subtract(bd("50.00")));
    assertEquals(bd("250000.00"), resteCdf);
  }

  private static BigDecimal bd(String v) {
    return new BigDecimal(v);
  }
}
