package com.flashops.api.pilotage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class PilotageMontantCompareTest {

  @Test
  void augmentation() {
    var v = PilotageMontantCompare.variation(new BigDecimal("120"), new BigDecimal("100"));
    assertEquals(PilotageMontantCompare.OK, v.statut());
    assertEquals(new BigDecimal("20.00000000"), v.pct());
    assertEquals(new BigDecimal("20"), v.ecart());
  }

  @Test
  void diminution_exempleMetier() {
    var v =
        PilotageMontantCompare.variation(new BigDecimal("850000"), new BigDecimal("1574074"));
    assertEquals(0, v.pct().setScale(1, RoundingMode.HALF_UP).compareTo(new BigDecimal("-46.0")));
    assertEquals(new BigDecimal("-724074"), v.ecart());
  }

  @Test
  void variationNulle() {
    var v = PilotageMontantCompare.variation(new BigDecimal("40"), new BigDecimal("40"));
    assertEquals(PilotageMontantCompare.OK, v.statut());
    assertEquals(0, v.pct().compareTo(BigDecimal.ZERO));
    assertEquals(0, v.ecart().compareTo(BigDecimal.ZERO));
  }

  @Test
  void referenceNulle_actuelPositif_nouveau() {
    var v = PilotageMontantCompare.variation(new BigDecimal("15"), BigDecimal.ZERO);
    assertEquals(PilotageMontantCompare.NOUVEAU, v.statut());
    assertNull(v.pct());
    assertEquals(new BigDecimal("15"), v.ecart());
  }

  @Test
  void deuxZeros_zeroPourcent() {
    var v = PilotageMontantCompare.variation(BigDecimal.ZERO, BigDecimal.ZERO);
    assertEquals(PilotageMontantCompare.OK, v.statut());
    assertEquals(0, v.pct().compareTo(BigDecimal.ZERO));
  }

  @Test
  void referenceAbsente_insuffisant() {
    var v = PilotageMontantCompare.variation(new BigDecimal("10"), null);
    assertEquals(PilotageMontantCompare.INSUFFISANT, v.statut());
    assertNull(v.pct());
    assertNull(v.ecart());
  }

  @Test
  void moisPartiel_aligneLesJours() {
    var from = LocalDate.of(2026, 11, 1);
    var to = LocalDate.of(2026, 11, 18);
    var mom = PilotageMontantCompare.mom(from, to);
    var yoy = PilotageMontantCompare.yoy(from, to);
    assertEquals(LocalDate.of(2026, 10, 1), mom.from());
    assertEquals(LocalDate.of(2026, 10, 18), mom.to());
    assertEquals(LocalDate.of(2025, 11, 1), yoy.from());
    assertEquals(LocalDate.of(2025, 11, 18), yoy.to());
  }

  @Test
  void comparaisonAnnuelle_exempleMetier() {
    var v = PilotageMontantCompare.variation(new BigDecimal("850000"), new BigDecimal("975900"));
    assertEquals(0, v.pct().setScale(1, RoundingMode.HALF_UP).compareTo(new BigDecimal("-12.9")));
    assertEquals(new BigDecimal("-125900"), v.ecart());
    var yoy = PilotageMontantCompare.yoy(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31));
    assertEquals(LocalDate.of(2025, 3, 1), yoy.from());
    assertEquals(LocalDate.of(2025, 3, 31), yoy.to());
  }

  @Test
  void plusieursMoisComplets_blocPrecedent() {
    var mom = PilotageMontantCompare.mom(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31));
    assertEquals(LocalDate.of(2025, 10, 1), mom.from());
    assertEquals(LocalDate.of(2025, 12, 31), mom.to());
  }

  @Test
  void moisCompletCourt_compareLeMoisCivilPrecedent() {
    var mom = PilotageMontantCompare.mom(LocalDate.of(2026, 2, 1), LocalDate.of(2026, 2, 28));
    assertEquals(LocalDate.of(2026, 1, 1), mom.from());
    assertEquals(LocalDate.of(2026, 1, 31), mom.to());
  }

  @Test
  void plagePersonnalisee_decaleDUnMoisEtDUnAn() {
    var from = LocalDate.of(2026, 3, 10);
    var to = LocalDate.of(2026, 4, 2);
    var mom = PilotageMontantCompare.mom(from, to);
    var yoy = PilotageMontantCompare.yoy(from, to);
    assertEquals(LocalDate.of(2026, 2, 10), mom.from());
    assertEquals(LocalDate.of(2026, 3, 2), mom.to());
    assertEquals(LocalDate.of(2025, 3, 10), yoy.from());
    assertEquals(LocalDate.of(2025, 4, 2), yoy.to());
  }

  @Test
  void filtresConservesQuandLaFenetreChange() {
    var scope =
        new PilotageAgenceFilterScope(
            List.of("Katanga"), List.of(7), null, 3, List.of(), null, List.of());
    var q =
        new PilotageBundleQuery(
            "transfert",
            "USD",
            "2026-11-01",
            "2026-11-18",
            List.of(11),
            null,
            List.of("Succès"),
            List.of("SAG"),
            List.of(42),
            List.of(),
            List.of(5),
            null,
            List.of(),
            scope,
            List.of("transfert"));
    var shifted = q.withPeriod("2026-10-01", "2026-10-18");
    assertEquals("2026-10-01", shifted.from());
    assertEquals("2026-10-18", shifted.to());
    assertEquals(List.of(42), shifted.agenceIds());
    assertEquals(List.of(7), shifted.geoScope().zoneIds());
    assertEquals(List.of("Katanga"), shifted.geoScope().reseauRegions());
    assertEquals(Integer.valueOf(3), shifted.geoScope().provinceId());
    assertEquals(List.of(11), shifted.produitIds());
    assertEquals(List.of(5), shifted.typeOperationIds());
    assertEquals(List.of("Succès"), shifted.statutUniformes());
    assertTrue(shifted.agenceIds() == q.agenceIds());
  }
}
