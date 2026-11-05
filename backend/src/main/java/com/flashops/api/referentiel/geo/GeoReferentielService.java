package com.flashops.api.referentiel.geo;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flashops.api.admin.AuditJournalService;
import com.flashops.api.referentiel.geo.GeoFeatureMapper.AdminLevel;
import com.flashops.api.referentiel.geo.GeoNamesClient.GeoPlace;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GeoReferentielService {

  private static final Logger log = LoggerFactory.getLogger(GeoReferentielService.class);
  private static final String SEED_PATH = "referentiels/geo/pays-prioritaires.json";

  private final PaysRepository paysRepo;
  private final ProvinceRepository provinceRepo;
  private final VilleRepository villeRepo;
  private final TerritoireRepository territoireRepo;
  private final CommuneRepository communeRepo;
  private final GeoNamesClient geoNames;
  private final GeoLocalSeedLoader localSeed;
  private final ObjectMapper objectMapper;
  private final AuditJournalService audit;

  public GeoReferentielService(
      PaysRepository paysRepo,
      ProvinceRepository provinceRepo,
      VilleRepository villeRepo,
      TerritoireRepository territoireRepo,
      CommuneRepository communeRepo,
      GeoNamesClient geoNames,
      GeoLocalSeedLoader localSeed,
      ObjectMapper objectMapper,
      AuditJournalService audit) {
    this.paysRepo = paysRepo;
    this.provinceRepo = provinceRepo;
    this.villeRepo = villeRepo;
    this.territoireRepo = territoireRepo;
    this.communeRepo = communeRepo;
    this.geoNames = geoNames;
    this.localSeed = localSeed;
    this.objectMapper = objectMapper;
    this.audit = audit;
  }

  @Transactional(readOnly = true)
  public List<GeoDtos.PaysRow> listPays() {
    return paysRepo.findAllByActifTrueOrderByLibelleAsc().stream().map(GeoDtos::toPaysRow).toList();
  }

  @Transactional(readOnly = true)
  public List<GeoDtos.ProvinceRow> listProvinces(Short paysId) {
    return provinceRepo.findByPaysIdAndActifTrueOrderByOrdreTriAscLibelleAsc(paysId).stream()
        .map(GeoDtos::toProvinceRow)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<GeoDtos.VilleRow> listVilles(Short provinceId) {
    return villeRepo.findByProvinceIdAndActifTrueOrderByLibelleAsc(provinceId).stream()
        .map(GeoDtos::toVilleRow)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<GeoDtos.TerritoireRow> listTerritoires(Short provinceId) {
    return territoireRepo.findByProvinceIdAndActifTrueOrderByLibelleAsc(provinceId).stream()
        .map(GeoDtos::toTerritoireRow)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<GeoDtos.CommuneRow> listCommunes(Short villeId, Short territoireId, Short provinceId) {
    if (villeId != null) {
      return communeRepo.findByVilleIdAndActifTrueOrderByLibelleAsc(villeId).stream()
          .map(GeoDtos::toCommuneRow)
          .toList();
    }
    if (territoireId != null) {
      return communeRepo.findByTerritoireIdAndActifTrueOrderByLibelleAsc(territoireId).stream()
          .map(GeoDtos::toCommuneRow)
          .toList();
    }
    if (provinceId != null) {
      return communeRepo.findByProvinceId(provinceId).stream().map(GeoDtos::toCommuneRow).toList();
    }
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "filtre_requis");
  }

  @Transactional
  public GeoDtos.SyncResult seedPaysIfEmpty() {
    if (paysRepo.count() > 0) {
      return new GeoDtos.SyncResult(true, 0, 0, 0, 0, 0, "pays_deja_initialises");
    }
    return upsertPaysFromSeed(false);
  }

  @Transactional
  public GeoDtos.SyncResult seedLocalHierarchiesIfMissing() {
    return localSeed.seedAllMissing();
  }

  @Transactional
  public GeoDtos.SyncResult seedLocalCountry(int actorId, String codeIso, boolean force) {
    GeoDtos.SyncResult result = localSeed.seedCountry(codeIso, force);
    audit.log(
        actorId,
        "referentiels.geo.seed",
        "referentiels",
        "Seed local " + codeIso.toUpperCase(),
        Map.of(
            "code_iso", codeIso.toUpperCase(),
            "provinces", result.provinces(),
            "villes", result.villes(),
            "territoires", result.territoires(),
            "communes", result.communes(),
            "force", force));
    return result;
  }

  @Transactional
  public GeoDtos.SyncResult syncPaysList(int actorId) {
    GeoDtos.SyncResult result = upsertPaysFromSeed(true);
    audit.log(
        actorId,
        "referentiels.geo.sync",
        "referentiels",
        "Synchronisation liste des pays",
        Map.of("pays", result.pays()));
    return result;
  }

  @Transactional
  public GeoDtos.SyncResult syncPaysHierarchy(int actorId, String codeIso) {
    Pays pays =
        paysRepo
            .findByCodeIsoIgnoreCase(codeIso)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "pays_introuvable"));
    if (pays.getGeonameId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "pays_sans_geoname_id");
    }

    SyncCounters counters = new SyncCounters();
    try {
      enrichPaysFromGeo(pays);
      syncProvincesForPays(pays, counters);
      List<Province> provinces =
          provinceRepo.findByPaysIdAndActifTrueOrderByOrdreTriAscLibelleAsc(pays.getId());
      for (Province province : provinces) {
        if (province.getGeonameId() == null) {
          continue;
        }
        syncUnderProvince(pays, province, counters);
        throttle();
      }
    } catch (ResponseStatusException ex) {
      throw ex;
    } catch (RuntimeException ex) {
      log.warn("Sync GeoNames interrompue pour {}: {}", codeIso, ex.getMessage());
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "sync_geonames_echouee");
    }

    GeoDtos.SyncResult result = counters.toResult(codeIso);
    audit.log(
        actorId,
        "referentiels.geo.sync",
        "referentiels",
        "Synchronisation hiérarchie " + codeIso.toUpperCase(),
        Map.of(
            "code_iso", codeIso.toUpperCase(),
            "provinces", result.provinces(),
            "villes", result.villes(),
            "territoires", result.territoires(),
            "communes", result.communes()));
    return result;
  }

  private GeoDtos.SyncResult upsertPaysFromSeed(boolean enrichGeo) {
    List<PaysSeedRow> rows = readSeedFile();
    int count = 0;
    for (PaysSeedRow row : rows) {
      upsertPaysRow(row, enrichGeo);
      count++;
    }
    return new GeoDtos.SyncResult(false, count, 0, 0, 0, 0, "ok");
  }

  private void upsertPaysRow(PaysSeedRow row, boolean enrichGeo) {
    Pays pays =
        paysRepo
            .findByCodeIsoIgnoreCase(row.codeIso())
            .orElseGet(Pays::new);
    pays.setCodeIso(row.codeIso().toUpperCase());
    pays.setLibelle(row.libelle());
    pays.setLibelleDefaut(row.libelle());
    pays.setLibelleFr(row.libelle());
    if (row.geonameId() != null) {
      pays.setGeonameId(row.geonameId());
    }
    pays.setSource("seed");
    pays.setActif(true);
    paysRepo.save(pays);
    if (enrichGeo && pays.getGeonameId() != null) {
      try {
        enrichPaysFromGeo(pays);
        paysRepo.save(pays);
        throttle();
      } catch (RuntimeException ex) {
        log.debug("Enrichissement pays {} ignoré: {}", row.codeIso(), ex.getMessage());
      }
    }
  }

  private void enrichPaysFromGeo(Pays pays) {
    GeoPlace place = geoNames.getPlace(pays.getGeonameId());
    applyPlaceLabels(pays::setLibelle, pays::setLibelleFr, pays::setLibelleDefaut, place);
    pays.setLatitude(place.latitude());
    pays.setLongitude(place.longitude());
    pays.setSource("geonames");
  }

  private void syncProvincesForPays(Pays pays, SyncCounters counters) {
    List<GeoPlace> children = geoNames.children(pays.getGeonameId());
    short order = 0;
    for (GeoPlace child : children) {
      if (GeoFeatureMapper.levelUnderCountry(child) != AdminLevel.PROVINCE) {
        continue;
      }
      upsertProvince(pays, child, order++);
      counters.provinces++;
    }
  }

  private void syncUnderProvince(Pays pays, Province province, SyncCounters counters) {
    List<GeoPlace> children = geoNames.children(province.getGeonameId());
    for (GeoPlace child : children) {
      AdminLevel level = GeoFeatureMapper.levelUnderProvince(child, pays.getCodeIso());
      switch (level) {
        case VILLE -> {
          Ville ville = upsertVille(province, child);
          counters.villes++;
          syncCommunesUnder(ville, null, counters);
        }
        case TERRITOIRE -> {
          Territoire territoire = upsertTerritoire(province, child);
          counters.territoires++;
          syncCommunesUnder(null, territoire, counters);
        }
        case COMMUNE -> {
          upsertCommuneOrphanUnderProvince(province, child);
          counters.communes++;
        }
        default -> {}
      }
      throttle();
    }
  }

  private void syncCommunesUnder(Ville ville, Territoire territoire, SyncCounters counters) {
    Long parentId = ville != null ? ville.getGeonameId() : territoire.getGeonameId();
    if (parentId == null) {
      return;
    }
    List<GeoPlace> children = geoNames.children(parentId);
    for (GeoPlace child : children) {
      if (GeoFeatureMapper.levelUnderVilleOrTerritoire(child) != AdminLevel.COMMUNE) {
        continue;
      }
      if (ville != null) {
        upsertCommune(ville, null, child);
      } else {
        upsertCommune(null, territoire, child);
      }
      counters.communes++;
    }
    throttle();
  }

  private Province upsertProvince(Pays pays, GeoPlace place, short order) {
    Province province =
        provinceRepo.findByGeonameId(place.geonameId()).orElseGet(Province::new);
    province.setPays(pays);
    province.setCode(GeoFeatureMapper.buildCode(place));
    applyPlaceLabels(province::setLibelle, province::setLibelleFr, province::setLibelleDefaut, place);
    province.setGeonameId(place.geonameId());
    province.setOrdreTri(order);
    province.setLatitude(place.latitude());
    province.setLongitude(place.longitude());
    province.setSource("geonames");
    province.setActif(true);
    return provinceRepo.save(province);
  }

  private Ville upsertVille(Province province, GeoPlace place) {
    Ville ville = villeRepo.findByGeonameId(place.geonameId()).orElseGet(Ville::new);
    ville.setProvince(province);
    ville.setCode(GeoFeatureMapper.buildCode(place));
    applyPlaceLabels(ville::setLibelle, ville::setLibelleFr, ville::setLibelleDefaut, place);
    ville.setGeonameId(place.geonameId());
    ville.setLatitude(place.latitude());
    ville.setLongitude(place.longitude());
    ville.setSource("geonames");
    ville.setActif(true);
    return villeRepo.save(ville);
  }

  private Territoire upsertTerritoire(Province province, GeoPlace place) {
    Territoire territoire =
        territoireRepo.findByGeonameId(place.geonameId()).orElseGet(Territoire::new);
    territoire.setProvince(province);
    territoire.setCode(GeoFeatureMapper.buildCode(place));
    applyPlaceLabels(
        territoire::setLibelle, territoire::setLibelleFr, territoire::setLibelleDefaut, place);
    territoire.setGeonameId(place.geonameId());
    territoire.setLatitude(place.latitude());
    territoire.setLongitude(place.longitude());
    territoire.setSource("geonames");
    territoire.setActif(true);
    return territoireRepo.save(territoire);
  }

  private void upsertCommuneOrphanUnderProvince(Province province, GeoPlace place) {
    Optional<Ville> villeOpt =
        villeRepo.findByProvinceIdAndActifTrueOrderByLibelleAsc(province.getId()).stream()
            .findFirst();
    if (villeOpt.isPresent()) {
      upsertCommune(villeOpt.get(), null, place);
      return;
    }
    Optional<Territoire> territoireOpt =
        territoireRepo.findByProvinceIdAndActifTrueOrderByLibelleAsc(province.getId()).stream()
            .findFirst();
    territoireOpt.ifPresent(t -> upsertCommune(null, t, place));
  }

  private Commune upsertCommune(Ville ville, Territoire territoire, GeoPlace place) {
    Commune commune = communeRepo.findByGeonameId(place.geonameId()).orElseGet(Commune::new);
    commune.setVille(ville);
    commune.setTerritoire(territoire);
    commune.setCode(GeoFeatureMapper.buildCode(place));
    applyPlaceLabels(commune::setLibelle, commune::setLibelleFr, commune::setLibelleDefaut, place);
    commune.setGeonameId(place.geonameId());
    commune.setLatitude(place.latitude());
    commune.setLongitude(place.longitude());
    commune.setSource("geonames");
    commune.setActif(true);
    return communeRepo.save(commune);
  }

  private static void applyPlaceLabels(
      java.util.function.Consumer<String> libelle,
      java.util.function.Consumer<String> libelleFr,
      java.util.function.Consumer<String> libelleDefaut,
      GeoPlace place) {
    String def = place.displayName();
    libelleDefaut.accept(def);
    libelleFr.accept(def);
    libelle.accept(def);
  }

  private List<PaysSeedRow> readSeedFile() {
    try (InputStream in = new ClassPathResource(SEED_PATH).getInputStream()) {
      return objectMapper.readValue(in, new TypeReference<>() {});
    } catch (IOException e) {
      throw new IllegalStateException("Impossible de lire " + SEED_PATH, e);
    }
  }

  private static void throttle() {
    try {
      Thread.sleep(250);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private record PaysSeedRow(
      @JsonProperty("code_iso") String codeIso,
      String libelle,
      @JsonProperty("geoname_id") Long geonameId) {}

  private static final class SyncCounters {
    int provinces;
    int villes;
    int territoires;
    int communes;

    GeoDtos.SyncResult toResult(String codeIso) {
      return new GeoDtos.SyncResult(
          false, 0, provinces, villes, territoires, communes, "sync_" + codeIso.toUpperCase());
    }
  }
}
