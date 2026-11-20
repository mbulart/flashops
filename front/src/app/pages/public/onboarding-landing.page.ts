import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-onboarding-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="public-page">
      <nav class="public-nav">
        <span class="brand">Flash</span>
        <a routerLink="/devenir-distributeur/suivi" class="btn btn-outline-dark btn-sm">
          Suivre ma candidature
        </a>
      </nav>

      <section class="hero">
        <div>
          <span class="eyebrow">Réseau de distribution</span>
          <h1>Devenir distributeur Flash</h1>
          <p>
            Déposez votre candidature en ligne, renseignez votre entreprise et vos points de
            vente, puis suivez l’avancement de votre dossier.
          </p>
          <div class="d-flex flex-wrap gap-2 mt-4">
            <a routerLink="/devenir-distributeur/candidature" class="btn btn-primary">
              Devenir distributeur
            </a>
            <a routerLink="/devenir-distributeur/suivi" class="btn btn-outline-dark">
              Suivre ma candidature
            </a>
          </div>
        </div>
        <div class="process-card">
          <h2>Votre candidature</h2>
          <ol>
            <li><span>1</span><div><strong>Préparez le dossier</strong><small>Entreprise, services, points de vente et documents.</small></div></li>
            <li><span>2</span><div><strong>Soumettez en ligne</strong><small>Votre brouillon est enregistré au fil des étapes.</small></div></li>
            <li><span>3</span><div><strong>Suivez le traitement</strong><small>Consultez le statut avec votre référence et votre jeton.</small></div></li>
          </ol>
        </div>
      </section>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: linear-gradient(140deg, #fff 55%, #fff7cc); color: #191919; }
    .public-page { max-width: 1120px; margin: auto; padding: 1.25rem 2rem 4rem; }
    .public-nav { display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 1.5rem; font-weight: 800; letter-spacing: -.04em; }
    .hero { min-height: calc(100vh - 7rem); display: grid; grid-template-columns: 1.2fr .8fr; gap: 4rem; align-items: center; }
    h1 { font-size: clamp(2.6rem, 6vw, 4.8rem); line-height: .98; max-width: 700px; margin: .7rem 0 1.4rem; letter-spacing: -.05em; }
    p { max-width: 650px; color: #555; font-size: 1.12rem; }
    .eyebrow { color: #6f5900; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; font-size: .78rem; }
    .process-card { background: #fff; border: 1px solid #e5e5e5; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,.08); }
    .process-card h2 { font-size: 1.1rem; margin-bottom: 1.25rem; }
    ol { list-style: none; padding: 0; margin: 0; display: grid; gap: 1.25rem; }
    li { display: flex; gap: .85rem; }
    li > span { width: 1.8rem; height: 1.8rem; display: grid; place-items: center; border-radius: 50%; background: var(--bs-primary); font-weight: 700; flex: 0 0 auto; }
    li div { display: grid; }
    li small { color: #707070; margin-top: .15rem; }
    @media (max-width: 760px) { .public-page { padding: 1rem; } .hero { grid-template-columns: 1fr; gap: 2rem; padding: 4rem 0; } }
  `,
})
export class OnboardingLandingPageComponent {}
