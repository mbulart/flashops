package com.flashops.api.pilotage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class ProvinceGeoNamesTest {

  @Test
  void katanga_sePlaceSelonLaVille() {
    assertEquals("Haut-Katanga", ProvinceGeoNames.resolve("KATANGA", "Lubumbashi"));
    assertEquals("Haut-Katanga", ProvinceGeoNames.resolve("LUBUMBASHI", "Lubumbashi"));
    assertEquals("Haut-Katanga", ProvinceGeoNames.resolve("HAUT KATANGA", "Lubumbashi"));
    assertEquals("Lualaba", ProvinceGeoNames.resolve("KATANGA", "Kolwezi"));
    assertEquals("Tanganyika", ProvinceGeoNames.resolve("katanga", "Kalemie"));
    assertEquals("Haut-Katanga", ProvinceGeoNames.resolve("KATANGA", "Bukavu"));
  }

  @Test
  void provinceDejaPrecise_ignoreLaVille() {
    assertEquals("Kinshasa", ProvinceGeoNames.resolve("KINSHASA", "Lubumbashi"));
    assertEquals("North Kivu", ProvinceGeoNames.resolve("NORD-KIVU", "Kinshasa"));
    assertEquals("South Kivu", ProvinceGeoNames.resolve("SUD KIVU", ""));
    assertEquals("Kongo-Central", ProvinceGeoNames.resolve("KONGO CENTRAL", "Kinshasa"));
    assertEquals("Kasai-Oriental", ProvinceGeoNames.resolve("KASAI ORIENTAL", "Mbuji-Mayi"));
  }

  @Test
  void anciensLibellesEtVilles() {
    assertEquals("Kongo-Central", ProvinceGeoNames.resolve("BAS CONGO", "Matadi"));
    assertEquals("Kongo-Central", ProvinceGeoNames.resolve("MATADI", "Matadi"));
    assertEquals("Maniema", ProvinceGeoNames.resolve("KINDU", "Kindu"));
    assertEquals("Tshopo", ProvinceGeoNames.resolve("PROVINCE ORIENTALE", "Kisangani"));
    assertEquals("Central Kasai", ProvinceGeoNames.resolve("KASAI OCCIDENTAL", "Kananga"));
    assertEquals("North Kivu", ProvinceGeoNames.resolve("EST", "Goma"));
    assertEquals("Ituri", ProvinceGeoNames.resolve("EST", "Bunia"));
    assertNull(ProvinceGeoNames.resolve("EST", "Kinshasa"));
    assertNull(ProvinceGeoNames.resolve("", "Lubumbashi"));
    assertNull(ProvinceGeoNames.resolve("0", "Lubumbashi"));
    assertEquals("Kinshasa", ProvinceGeoNames.resolve("KINSHASA\r", "Kinshasa"));
  }
}
