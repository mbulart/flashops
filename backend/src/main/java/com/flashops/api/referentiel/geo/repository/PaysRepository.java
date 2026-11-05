package com.flashops.api.referentiel.geo.repository;

import com.flashops.api.referentiel.geo.domain.Pays;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaysRepository extends JpaRepository<Pays, Short> {

  List<Pays> findAllByActifTrueOrderByLibelleAsc();

  Optional<Pays> findByCodeIsoIgnoreCase(String codeIso);

  Optional<Pays> findByGeonameId(Long geonameId);
}
