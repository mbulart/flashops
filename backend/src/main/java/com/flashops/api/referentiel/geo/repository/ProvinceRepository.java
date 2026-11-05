package com.flashops.api.referentiel.geo.repository;

import com.flashops.api.referentiel.geo.domain.Province;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProvinceRepository extends JpaRepository<Province, Short> {

  List<Province> findByPaysIdAndActifTrueOrderByOrdreTriAscLibelleAsc(Short paysId);

  Optional<Province> findByGeonameId(Long geonameId);

  Optional<Province> findByPaysIdAndCodeIgnoreCase(Short paysId, String code);
}
