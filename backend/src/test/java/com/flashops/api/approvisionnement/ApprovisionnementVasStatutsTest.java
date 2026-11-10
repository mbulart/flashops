package com.flashops.api.approvisionnement;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ApprovisionnementVasStatutsTest {

  @Test
  void transitions_soumission_validation_paiement() {
    assertDoesNotThrow(
        () ->
            ApprovisionnementVasStatuts.assertTransition(
                ApprovisionnementVasStatuts.BROUILLON, ApprovisionnementVasStatuts.SOUMISE));
    assertDoesNotThrow(
        () ->
            ApprovisionnementVasStatuts.assertTransition(
                ApprovisionnementVasStatuts.SOUMISE,
                ApprovisionnementVasStatuts.EN_ATTENTE_VALIDATION));
    assertDoesNotThrow(
        () ->
            ApprovisionnementVasStatuts.assertTransition(
                ApprovisionnementVasStatuts.EN_ATTENTE_VALIDATION,
                ApprovisionnementVasStatuts.VALIDEE));
    assertDoesNotThrow(
        () ->
            ApprovisionnementVasStatuts.assertTransition(
                ApprovisionnementVasStatuts.VALIDEE,
                ApprovisionnementVasStatuts.EN_ATTENTE_PAIEMENT));
    assertDoesNotThrow(
        () ->
            ApprovisionnementVasStatuts.assertTransition(
                ApprovisionnementVasStatuts.EN_ATTENTE_PAIEMENT,
                ApprovisionnementVasStatuts.PARTIELLEMENT_PAYEE));
    assertDoesNotThrow(
        () ->
            ApprovisionnementVasStatuts.assertTransition(
                ApprovisionnementVasStatuts.PARTIELLEMENT_PAYEE,
                ApprovisionnementVasStatuts.PAYEE));
  }

  @Test
  void refus_transition_interdite() {
    assertThrows(
        ResponseStatusException.class,
        () ->
            ApprovisionnementVasStatuts.assertTransition(
                ApprovisionnementVasStatuts.BROUILLON, ApprovisionnementVasStatuts.PAYEE));
    assertThrows(
        ResponseStatusException.class,
        () ->
            ApprovisionnementVasStatuts.assertTransition(
                ApprovisionnementVasStatuts.PAYEE, ApprovisionnementVasStatuts.BROUILLON));
  }

  @Test
  void rejet_depuis_attente_validation() {
    assertDoesNotThrow(
        () ->
            ApprovisionnementVasStatuts.assertTransition(
                ApprovisionnementVasStatuts.EN_ATTENTE_VALIDATION,
                ApprovisionnementVasStatuts.REJETEE));
  }

  @Test
  void normalize_et_editable() {
    assertEquals("brouillon", ApprovisionnementVasStatuts.normalize(null));
    assertTrue(ApprovisionnementVasStatuts.isEditable("brouillon"));
    assertTrue(ApprovisionnementVasStatuts.isPayable("en_attente_paiement"));
  }
}
