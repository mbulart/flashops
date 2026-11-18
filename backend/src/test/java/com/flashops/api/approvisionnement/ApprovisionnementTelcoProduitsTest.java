package com.flashops.api.approvisionnement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ApprovisionnementTelcoProduitsTest {

  @Test
  void prendLesTroisEcransTelco() {
    assertTrue(ApprovisionnementTelcoProduits.matches("TELCO", "AIRTEL", "RechargesUnites"));
    assertTrue(ApprovisionnementTelcoProduits.matches("TELCO", "ORANGE", "RechargesUnites"));
    assertTrue(ApprovisionnementTelcoProduits.matches("TELCO", "AIRTELDATA", "RechargesMega"));
    assertTrue(ApprovisionnementTelcoProduits.matches("TELCO", "VODACOMDATA", "MobileMoney"));
  }

  @Test
  void laisseLeMobileMoneyEtLesNumeros() {
    assertFalse(ApprovisionnementTelcoProduits.matches("TELCO", "MPESA", "MobileMoney"));
    assertFalse(ApprovisionnementTelcoProduits.matches("TELCO", "ORANGEMONEY", "MobileMoney"));
    assertFalse(ApprovisionnementTelcoProduits.matches("TELCO", "AIRTELMONEY", "MobileMoney"));
    assertFalse(ApprovisionnementTelcoProduits.matches("TELCO", "AFRIMONEY", "MobileMoney"));
    assertFalse(ApprovisionnementTelcoProduits.matches("TELCO", "0902828912", "RechargesUnites"));
    assertFalse(ApprovisionnementTelcoProduits.matches("TELCO", "0997822855", "RechargesUnites"));
    assertFalse(ApprovisionnementTelcoProduits.matches("TELCO", "TELCO", "RechargesMega"));
    assertFalse(ApprovisionnementTelcoProduits.matches("WU", "AIRTEL", "RechargesUnites"));
  }

  @Test
  void regroupeLesTroisEcransSousLeMemeOperateur() {
    assertEquals("VODACOM", ApprovisionnementTelcoProduits.operateur("VODACOM"));
    assertEquals("VODACOM", ApprovisionnementTelcoProduits.operateur("VODACOMDATA"));
    assertEquals("AIRTEL", ApprovisionnementTelcoProduits.operateur("AIRTELDATA"));
    assertEquals("AFRICELL", ApprovisionnementTelcoProduits.operateur("AFRICELL"));
    assertEquals("ORANGE", ApprovisionnementTelcoProduits.operateur("ORANGE"));
  }
}
