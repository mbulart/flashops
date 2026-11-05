package com.flashops.api.referentiel.zone;

import com.flashops.api.referentiel.zone.domain.Region;
import com.flashops.api.referentiel.zone.domain.ResponsableZone;
import com.flashops.api.referentiel.zone.domain.Zone;
import com.flashops.api.referentiel.zone.repository.RegionRepository;
import com.flashops.api.referentiel.zone.repository.ResponsableZoneRepository;
import com.flashops.api.referentiel.zone.repository.ZoneRepository;
import com.flashops.api.web.dto.ZoneReferentielDtos;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ZoneReferentielService {

  private final ResponsableZoneRepository responsables;
  private final ZoneRepository zones;
  private final RegionRepository regions;

  public ZoneReferentielService(
      ResponsableZoneRepository responsables, ZoneRepository zones, RegionRepository regions) {
    this.responsables = responsables;
    this.zones = zones;
    this.regions = regions;
  }

  @Transactional(readOnly = true)
  public List<ZoneReferentielDtos.ResponsableZoneRow> listResponsables() {
    return responsables.findAllByOrderByNomAsc().stream()
        .map(
            r ->
                ZoneReferentielDtos.toResponsableRow(
                    r,
                    zones
                        .findFirstByResponsableZoneId(r.getId())
                        .map(Zone::getLibelle)
                        .orElse(null)))
        .toList();
  }

  @Transactional(readOnly = true)
  public List<ZoneReferentielDtos.RegionRow> listRegions() {
    return regions.findAllByOrderByLibelleAsc().stream().map(ZoneReferentielDtos::toRegionRow).toList();
  }

  @Transactional
  public ZoneReferentielDtos.RegionRow createRegion(ZoneReferentielDtos.RegionInput input) {
    if (regions.findByCodeIgnoreCase(input.code()).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "code_deja_utilise");
    }
    Region row = new Region();
    applyRegion(row, input);
    regions.save(row);
    return ZoneReferentielDtos.toRegionRow(row);
  }

  @Transactional
  public ZoneReferentielDtos.RegionRow updateRegion(int id, ZoneReferentielDtos.RegionInput input) {
    Region row =
        regions.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "introuvable"));
    if (regions.existsByCodeIgnoreCaseAndIdNot(input.code(), id)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "code_deja_utilise");
    }
    applyRegion(row, input);
    regions.save(row);
    zones.findAllWithResponsable().stream()
        .filter(z -> z.getRegionRef() != null && id == z.getRegionRef().getId())
        .forEach(z -> z.setRegion(row.getLibelle()));
    return ZoneReferentielDtos.toRegionRow(row);
  }

  @Transactional
  public void deleteRegion(int id) {
    Region row =
        regions.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "introuvable"));
    if (zones.existsByRegionRefId(id)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "region_liee_a_une_zone");
    }
    regions.delete(row);
  }

  @Transactional(readOnly = true)
  public List<ZoneReferentielDtos.ZoneRow> listZones() {
    return zones.findAllWithResponsable().stream().map(ZoneReferentielDtos::toZoneRow).toList();
  }

  @Transactional
  public ZoneReferentielDtos.ResponsableZoneRow createResponsable(ZoneReferentielDtos.ResponsableZoneInput input) {
    if (responsables.findByCodeIgnoreCase(input.code()).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "code_deja_utilise");
    }
    ResponsableZone row = new ResponsableZone();
    applyResponsable(row, input);
    responsables.save(row);
    return ZoneReferentielDtos.toResponsableRow(row, null);
  }

  @Transactional
  public ZoneReferentielDtos.ResponsableZoneRow updateResponsable(
      int id, ZoneReferentielDtos.ResponsableZoneInput input) {
    ResponsableZone row =
        responsables
            .findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "introuvable"));
    if (responsables.existsByCodeIgnoreCaseAndIdNot(input.code(), id)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "code_deja_utilise");
    }
    applyResponsable(row, input);
    responsables.save(row);
    String zoneLibelle =
        zones.findFirstByResponsableZoneId(id).map(Zone::getLibelle).orElse(null);
    return ZoneReferentielDtos.toResponsableRow(row, zoneLibelle);
  }

  @Transactional
  public void deleteResponsable(int id) {
    ResponsableZone row =
        responsables
            .findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "introuvable"));
    zones.findFirstByResponsableZoneId(id)
        .ifPresent(
            z -> {
              throw new ResponseStatusException(HttpStatus.CONFLICT, "responsable_lie_a_une_zone");
            });
    responsables.delete(row);
  }

  @Transactional
  public ZoneReferentielDtos.ZoneRow createZone(ZoneReferentielDtos.ZoneInput input) {
    if (zones.findByCodeIgnoreCase(input.code()).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "code_deja_utilise");
    }
    Zone row = new Zone();
    applyZone(row, input);
    zones.save(row);
    return zones
        .findByIdWithResponsable(row.getId())
        .map(ZoneReferentielDtos::toZoneRow)
        .orElseThrow();
  }

  @Transactional
  public ZoneReferentielDtos.ZoneRow updateZone(int id, ZoneReferentielDtos.ZoneInput input) {
    Zone row =
        zones.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "introuvable"));
    if (zones.existsByCodeIgnoreCaseAndIdNot(input.code(), id)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "code_deja_utilise");
    }
    applyZone(row, input);
    zones.save(row);
    return zones
        .findByIdWithResponsable(id)
        .map(ZoneReferentielDtos::toZoneRow)
        .orElseThrow();
  }

  @Transactional
  public void deleteZone(int id) {
    Zone row =
        zones.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "introuvable"));
    zones.delete(row);
  }

  private void applyResponsable(ResponsableZone row, ZoneReferentielDtos.ResponsableZoneInput input) {
    row.setCode(input.code().trim().toUpperCase());
    row.setNom(input.nom().trim());
    row.setPerimetre(input.perimetre().trim());
    row.setActif(input.actif());
  }

  private void applyRegion(Region row, ZoneReferentielDtos.RegionInput input) {
    if (input.parDefaut()) {
      regions.clearDefaults();
    }
    row.setCode(input.code().trim().toUpperCase());
    row.setLibelle(input.libelle().trim());
    row.setParDefaut(input.parDefaut());
    row.setActif(input.actif());
  }

  private void applyZone(Zone row, ZoneReferentielDtos.ZoneInput input) {
    row.setCode(input.code().trim().toUpperCase());
    row.setLibelle(input.libelle().trim());
    row.setPerimetre(input.perimetre().trim());
    if (input.regionId() != null && input.regionId() > 0) {
      Region region =
          regions
              .findById(input.regionId())
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "region_introuvable"));
      row.setRegionRef(region);
      row.setRegion(region.getLibelle());
    } else {
      row.setRegionRef(null);
      row.setRegion(input.region() == null ? "" : input.region().trim());
    }
    row.setNbCommunes(Math.max(0, input.nbCommunes()));
    row.setNbVilles(Math.max(0, input.nbVilles()));
    row.setActif(input.actif());
    if (input.responsableZoneId() == null) {
      row.setResponsableZone(null);
    } else {
      ResponsableZone rz =
          responsables
              .findById(input.responsableZoneId())
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "responsable_introuvable"));
      row.setResponsableZone(rz);
    }
  }
}
