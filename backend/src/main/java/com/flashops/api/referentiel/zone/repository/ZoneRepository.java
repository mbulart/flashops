package com.flashops.api.referentiel.zone.repository;

import com.flashops.api.referentiel.zone.domain.Zone;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ZoneRepository extends JpaRepository<Zone, Integer> {

  @Query(
      """
      SELECT z FROM Zone z
      LEFT JOIN FETCH z.responsableZone
      LEFT JOIN FETCH z.regionRef
      ORDER BY z.libelle ASC
      """)
  List<Zone> findAllWithResponsable();

  Optional<Zone> findByCodeIgnoreCase(String code);

  boolean existsByCodeIgnoreCaseAndIdNot(String code, Integer id);

  Optional<Zone> findFirstByResponsableZoneId(Integer responsableZoneId);

  boolean existsByRegionRefId(Integer regionId);

  @Query(
      """
      SELECT z FROM Zone z
      LEFT JOIN FETCH z.responsableZone
      LEFT JOIN FETCH z.regionRef
      WHERE z.id = :id
      """)
  Optional<Zone> findByIdWithResponsable(Integer id);
}
