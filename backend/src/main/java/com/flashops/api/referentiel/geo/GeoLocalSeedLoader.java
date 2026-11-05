package com.flashops.api.referentiel.geo;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flashops.api.referentiel.geo.domain.Commune;
import com.flashops.api.referentiel.geo.domain.Pays;
import com.flashops.api.referentiel.geo.domain.Province;
import com.flashops.api.referentiel.geo.domain.Territoire;
import com.flashops.api.referentiel.geo.domain.Ville;
import com.flashops.api.referentiel.geo.repository.CommuneRepository;
import com.flashops.api.referentiel.geo.repository.PaysRepository;
import com.flashops.api.referentiel.geo.repository.ProvinceRepository;
import com.flashops.api.referentiel.geo.repository.TerritoireRepository;
import com.flashops.api.referentiel.geo.repository.VilleRepository;
import com.flashops.api.web.dto.GeoDtos;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class GeoLocalSeedLoader {

  private static final Logger log = LoggerFactory.getLogger(GeoLocalSeedLoader.class);
  private static final String SEEDS_GLOB = "classpath:referentiels/geo/seeds/*.json";

  private final PaysRepository paysRepo;
  private final ProvinceRepository provinceRepo;
  private final VilleRepository villeRepo;
  private final TerritoireRepository territoireRepo;
  private final CommuneRepository communeRepo;
  private final ObjectMapper objectMapper;

  public GeoLocalSeedLoader(
      PaysRepository paysRepo,
      ProvinceRepository provinceRepo,
      VilleRepository villeRepo,
      TerritoireRepository territoireRepo,
      CommuneRepository communeRepo,
      ObjectMapper objectMapper) {
    this.paysRepo = paysRepo;
    this.provinceRepo = provinceRepo;
    this.villeRepo = villeRepo;
    this.territoireRepo = territoireRepo;
    this.communeRepo = communeRepo;
    this.objectMapper = objectMapper;
  }

  public GeoDtos.SyncResult seedAllMissing() {
    int totalProvinces = 0;
    int totalVilles = 0;
    int totalTerritoires = 0;
    int totalCommunes = 0;
    int files = 0;
    try {
      Resource[] resources = new PathMatchingResourcePatternResolver().getResources(SEEDS_GLOB);
      for (Resource resource : resources) {
        CountrySeed seed = readSeed(resource);
        if (seed == null) {
          continue;
        }
        if (!shouldSeed(seed.codeIso())) {
          continue;
        }
        GeoDtos.SyncResult one = applySeed(seed, false);
        totalProvinces += one.provinces();
        totalVilles += one.villes();
        totalTerritoires += one.territoires();
        totalCommunes += one.communes();
        files++;
      }
    } catch (IOException e) {
      throw new IllegalStateException("Lecture des seeds geo impossible", e);
    }
    if (files == 0) {
      return new GeoDtos.SyncResult(true, 0, 0, 0, 0, 0, "aucun_seed_a_charger");
    }
    return new GeoDtos.SyncResult(
        false, 0, totalProvinces, totalVilles, totalTerritoires, totalCommunes, "seed_local_ok");
  }

  public GeoDtos.SyncResult seedCountry(String codeIso, boolean force) {
    String path = "referentiels/geo/seeds/" + codeIso.toUpperCase() + ".json";
    CountrySeed seed;
    try (InputStream in = new ClassPathResource(path).getInputStream()) {
      seed = objectMapper.readValue(in, CountrySeed.class);
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "seed_local_introuvable");
    }
    if (!force && !shouldSeed(codeIso)) {
      return new GeoDtos.SyncResult(true, 0, 0, 0, 0, 0, "deja_charge");
    }
    return applySeed(seed, force);
  }

  private boolean shouldSeed(String codeIso) {
    Pays pays =
        paysRepo
            .findByCodeIsoIgnoreCase(codeIso)
            .orElse(null);
    if (pays == null) {
      return false;
    }
    return provinceRepo.findByPaysIdAndActifTrueOrderByOrdreTriAscLibelleAsc(pays.getId()).isEmpty();
  }

  private CountrySeed readSeed(Resource resource) throws IOException {
    try (InputStream in = resource.getInputStream()) {
      CountrySeed seed = objectMapper.readValue(in, CountrySeed.class);
      if (seed.codeIso() == null || seed.codeIso().isBlank()) {
        return null;
      }
      return seed;
    }
  }

  private GeoDtos.SyncResult applySeed(CountrySeed seed, boolean force) {
    Pays pays =
        paysRepo
            .findByCodeIsoIgnoreCase(seed.codeIso())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "pays_introuvable"));

    Map<String, Province> provincesByCode = new HashMap<>();
    int pCount = 0;
    for (ProvinceSeed row : nullSafe(seed.provinces())) {
      Province province =
          provinceRepo
              .findByPaysIdAndCodeIgnoreCase(pays.getId(), row.code())
              .orElseGet(Province::new);
      province.setPays(pays);
      province.setCode(row.code().toUpperCase());
      province.setLibelle(row.libelle());
      province.setLibelleFr(row.libelle());
      province.setLibelleDefaut(row.libelle());
      province.setOrdreTri(row.ordre());
      province.setSource("seed");
      province.setActif(true);
      provinceRepo.save(province);
      provincesByCode.put(province.getCode(), province);
      pCount++;
    }

    Map<String, Ville> villesByCode = new HashMap<>();
    int vCount = 0;
    for (VilleSeed row : nullSafe(seed.villes())) {
      Province province = resolveProvince(provincesByCode, row.provinceCode());
      Ville ville =
          villeRepo
              .findByProvinceIdAndCodeIgnoreCase(province.getId(), row.code())
              .orElseGet(Ville::new);
      ville.setProvince(province);
      ville.setCode(row.code().toUpperCase());
      ville.setLibelle(row.libelle());
      ville.setLibelleFr(row.libelle());
      ville.setLibelleDefaut(row.libelle());
      ville.setSource("seed");
      ville.setActif(true);
      villeRepo.save(ville);
      villesByCode.put(ville.getCode(), ville);
      vCount++;
    }

    Map<String, Territoire> territoiresByCode = new HashMap<>();
    int tCount = 0;
    for (TerritoireSeed row : nullSafe(seed.territoires())) {
      Province province = resolveProvince(provincesByCode, row.provinceCode());
      Territoire territoire =
          territoireRepo
              .findByProvinceIdAndCodeIgnoreCase(province.getId(), row.code())
              .orElseGet(Territoire::new);
      territoire.setProvince(province);
      territoire.setCode(row.code().toUpperCase());
      territoire.setLibelle(row.libelle());
      territoire.setLibelleFr(row.libelle());
      territoire.setLibelleDefaut(row.libelle());
      territoire.setSource("seed");
      territoire.setActif(true);
      territoireRepo.save(territoire);
      territoiresByCode.put(territoire.getCode(), territoire);
      tCount++;
    }

    int cCount = 0;
    for (CommuneSeed row : nullSafe(seed.communes())) {
      Ville ville = null;
      Territoire territoire = null;
      if (row.villeCode() != null && !row.villeCode().isBlank()) {
        ville = resolveVille(villesByCode, row.villeCode());
      } else if (row.territoireCode() != null && !row.territoireCode().isBlank()) {
        territoire = resolveTerritoire(territoiresByCode, row.territoireCode());
      } else {
        continue;
      }
      Commune commune;
      if (ville != null) {
        commune =
            communeRepo
                .findByVilleIdAndCodeIgnoreCase(ville.getId(), row.code())
                .orElseGet(Commune::new);
        commune.setVille(ville);
        commune.setTerritoire(null);
      } else {
        commune =
            communeRepo
                .findByTerritoireIdAndCodeIgnoreCase(territoire.getId(), row.code())
                .orElseGet(Commune::new);
        commune.setTerritoire(territoire);
        commune.setVille(null);
      }
      commune.setCode(row.code().toUpperCase());
      commune.setLibelle(row.libelle());
      commune.setLibelleFr(row.libelle());
      commune.setLibelleDefaut(row.libelle());
      commune.setSource("seed");
      commune.setActif(true);
      communeRepo.save(commune);
      cCount++;
    }

    log.info(
        "Seed local {} : {} provinces, {} villes, {} territoires, {} communes",
        seed.codeIso(),
        pCount,
        vCount,
        tCount,
        cCount);

    return new GeoDtos.SyncResult(
        false, 0, pCount, vCount, tCount, cCount, "seed_" + seed.codeIso().toUpperCase());
  }

  private static Province resolveProvince(Map<String, Province> map, String code) {
    Province p = map.get(code.toUpperCase());
    if (p == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "province_seed_inconnue");
    }
    return p;
  }

  private static Ville resolveVille(Map<String, Ville> map, String code) {
    Ville v = map.get(code.toUpperCase());
    if (v == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ville_seed_inconnue");
    }
    return v;
  }

  private static Territoire resolveTerritoire(Map<String, Territoire> map, String code) {
    Territoire t = map.get(code.toUpperCase());
    if (t == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "territoire_seed_inconnu");
    }
    return t;
  }

  private static <T> List<T> nullSafe(List<T> list) {
    return list == null ? List.of() : list;
  }

  public record CountrySeed(
      @JsonProperty("code_iso") String codeIso,
      List<ProvinceSeed> provinces,
      List<VilleSeed> villes,
      List<TerritoireSeed> territoires,
      List<CommuneSeed> communes) {}

  public record ProvinceSeed(String code, String libelle, short ordre) {}

  public record VilleSeed(
      @JsonProperty("province_code") String provinceCode, String code, String libelle) {}

  public record TerritoireSeed(
      @JsonProperty("province_code") String provinceCode, String code, String libelle) {}

  public record CommuneSeed(
      @JsonProperty("ville_code") String villeCode,
      @JsonProperty("territoire_code") String territoireCode,
      String code,
      String libelle) {}
}
