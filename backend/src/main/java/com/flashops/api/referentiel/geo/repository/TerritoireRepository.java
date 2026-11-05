package com.flashops.api.referentiel.geo.repository;

import com.flashops.api.referentiel.geo.domain.Territoire;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TerritoireRepository extends JpaRepository<Territoire, Short> {

  List<Territoire> findByProvinceIdAndActifTrueOrderByLibelleAsc(Short provinceId);

  Optional<Territoire> findByGeonameId(Long geonameId);

  Optional<Territoire> findByProvinceIdAndCodeIgnoreCase(Short provinceId, String code);
}
