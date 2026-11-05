package com.flashops.api.referentiel.geo.repository;

import com.flashops.api.referentiel.geo.domain.Commune;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommuneRepository extends JpaRepository<Commune, Integer> {

  List<Commune> findByVilleIdAndActifTrueOrderByLibelleAsc(Short villeId);

  List<Commune> findByTerritoireIdAndActifTrueOrderByLibelleAsc(Short territoireId);

  Optional<Commune> findByGeonameId(Long geonameId);

  Optional<Commune> findByVilleIdAndCodeIgnoreCase(Short villeId, String code);

  Optional<Commune> findByTerritoireIdAndCodeIgnoreCase(Short territoireId, String code);

  @Query(
      """
      SELECT c FROM Commune c
      LEFT JOIN FETCH c.ville v
      LEFT JOIN FETCH v.province
      LEFT JOIN FETCH c.territoire t
      LEFT JOIN FETCH t.province
      WHERE c.actif = true
        AND (v.province.id = :provinceId OR t.province.id = :provinceId)
      ORDER BY c.libelle ASC
      """)
  List<Commune> findByProvinceId(@Param("provinceId") Short provinceId);
}
