package com.flashops.api.referentiel.zone.repository;

import com.flashops.api.referentiel.zone.domain.Region;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RegionRepository extends JpaRepository<Region, Integer> {

  List<Region> findAllByOrderByLibelleAsc();

  Optional<Region> findByCodeIgnoreCase(String code);

  boolean existsByCodeIgnoreCaseAndIdNot(String code, Integer id);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("UPDATE Region r SET r.parDefaut = false WHERE r.parDefaut = true")
  void clearDefaults();
}
