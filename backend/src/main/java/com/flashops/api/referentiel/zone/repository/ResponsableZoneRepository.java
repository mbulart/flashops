package com.flashops.api.referentiel.zone.repository;

import com.flashops.api.referentiel.zone.domain.ResponsableZone;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ResponsableZoneRepository extends JpaRepository<ResponsableZone, Integer> {

  List<ResponsableZone> findAllByOrderByNomAsc();

  Optional<ResponsableZone> findByCodeIgnoreCase(String code);

  boolean existsByCodeIgnoreCaseAndIdNot(String code, Integer id);
}
