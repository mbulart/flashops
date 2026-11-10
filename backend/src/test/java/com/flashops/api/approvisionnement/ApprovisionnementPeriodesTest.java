package com.flashops.api.approvisionnement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ApprovisionnementPeriodesTest {

  @Test
  void lundi_j1VenSamDim_j2Jeudi() {
    var p = ApprovisionnementPeriodes.resolve(LocalDate.of(2026, 11, 9)); // lundi
    assertEquals(LocalDate.of(2026, 11, 6), p.j1().debut());
    assertEquals(LocalDate.of(2026, 11, 8), p.j1().fin());
    assertEquals(LocalDate.of(2026, 11, 5), p.j2().debut());
    assertEquals(LocalDate.of(2026, 11, 5), p.j2().fin());
  }

  @Test
  void mardi_j1VenSamDim_j2Lundi() {
    var p = ApprovisionnementPeriodes.resolve(LocalDate.of(2026, 11, 10)); // mardi
    assertEquals(LocalDate.of(2026, 11, 6), p.j1().debut());
    assertEquals(LocalDate.of(2026, 11, 8), p.j1().fin());
    assertEquals(LocalDate.of(2026, 11, 9), p.j2().debut());
    assertEquals(LocalDate.of(2026, 11, 9), p.j2().fin());
  }

  @Test
  void mercredi_j1Lundi_j2Mardi() {
    var p = ApprovisionnementPeriodes.resolve(LocalDate.of(2026, 11, 11));
    assertEquals(LocalDate.of(2026, 11, 9), p.j1().debut());
    assertEquals(LocalDate.of(2026, 11, 10), p.j2().debut());
  }

  @Test
  void jeudi_et_vendredi() {
    var jeudi = ApprovisionnementPeriodes.resolve(LocalDate.of(2026, 11, 12));
    assertEquals(LocalDate.of(2026, 11, 10), jeudi.j1().debut());
    assertEquals(LocalDate.of(2026, 11, 11), jeudi.j2().debut());

    // 06/11/2026 = vendredi → J-1 = 04/11, J-2 = 05/11
    var vendredi = ApprovisionnementPeriodes.resolve(LocalDate.of(2026, 11, 6));
    assertEquals(LocalDate.of(2026, 11, 4), vendredi.j1().debut());
    assertEquals(LocalDate.of(2026, 11, 5), vendredi.j2().debut());
  }

  @Test
  void weekEndRefuse() {
    assertThrows(
        ResponseStatusException.class,
        () -> ApprovisionnementPeriodes.resolve(LocalDate.of(2026, 11, 14)));
    assertThrows(
        ResponseStatusException.class,
        () -> ApprovisionnementPeriodes.resolve(LocalDate.of(2026, 11, 15)));
  }
}
