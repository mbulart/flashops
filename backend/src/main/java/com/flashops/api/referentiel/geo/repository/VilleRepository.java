package com.flashops.api.referentiel.geo.repository;

import com.flashops.api.referentiel.geo.domain.Ville;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VilleRepository extends JpaRepository<Ville, Short> {

  List<Ville> findByProvinceIdAndActifTrueOrderByLibelleAsc(Short provinceId);

  Optional<Ville> findByGeonameId(Long geonameId);

  Optional<Ville> findByProvinceIdAndCodeIgnoreCase(Short provinceId, String code);
}
