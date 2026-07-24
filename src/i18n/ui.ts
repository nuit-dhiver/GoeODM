export const languages = {
  de: 'Deutsch',
  en: 'English',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'en';

export const ui = {
  de: {
    // Navigation
    'nav.home': 'Startseite',
    'nav.brunnen': 'Brunnen',
    'nav.denkmale': 'Denkmäler',
    'nav.kunstwerke': 'Kunstwerke',
    'nav.cities': 'Städte',
    'nav.about': 'Über',

    // Homepage
    'home.title': 'Open Museum',
    'home.tagline': 'Entdecken Sie Denkmäler, Brunnen und Kunstwerke im öffentlichen Raum — in 3D.',
    'home.featured': 'Entdecken in 3D',
    'home.featured.cta': 'Werk ansehen',
    'home.slideshow.title': 'Impressionen',

    // Categories
    'category.brunnen': 'Brunnen',
    'category.brunnen.desc': 'Historische und moderne Brunnen im Stadtgebiet',
    'category.denkmal': 'Denkmäler',
    'category.denkmal.desc': 'Denkmäler und Gedenkstätten in Göttingen',
    'category.kunstwerk': 'Kunstwerke',
    'category.kunstwerk.desc': 'Skulpturen und Kunstinstallationen im öffentlichen Raum',

    // Work detail
    'work.photos': 'Fotos',
    'work.location': 'Standort',
    'work.artist': 'Künstler',
    'work.year': 'Jahr',
    'work.material': 'Material',
    'work.modelCreator': '3D-Rekonstruktion von',
    'work.back': 'Zurück zur Kategorie',
    'work.view3d': '3D-Modell ansehen',
    'work.viewAR': 'In AR ansehen',
    'work.download': 'Herunterladen',
    'work.share': 'Teilen',
    'work.shareTwitter': 'Auf X teilen',
    'work.shareFacebook': 'Auf Facebook teilen',
    'work.shareInstagram': 'Für Instagram kopieren',
    'work.shareCopyLink': 'Link kopieren',
    'work.shareWith': 'Teilen über',
    'work.shareCopied': 'Link wurde in die Zwischenablage kopiert.',
    'work.downloadGLB': 'GLB herunterladen',
    'work.downloadUSDZ': 'USDZ herunterladen',
    'work.licenseTitle': 'Lizenzhinweis',
    'work.licenseNotice': 'Mit dem Herunterladen bestätige ich, dass diese Datei unter der',
    'work.licenseLink': 'Creative Commons Namensnennung – Nicht kommerziell 4.0 (CC BY-NC 4.0)',
    'work.licenseNoticeAfter': 'lizenziert ist und ausschließlich für nicht-kommerzielle Zwecke genutzt werden darf.',
    'work.licenseAuthorizedNotice': 'Mit dem Herunterladen bestätige ich, dass diese Datei nur im Rahmen einer ausdrücklichen Nutzungserlaubnis des Rechteinhabers bereitgestellt wird. Jede Nutzung außerhalb dieser Erlaubnis kann geistige Eigentumsrechte verletzen.',
    'work.licenseDownloadWith': 'Herunterladen als',
    'work.ipStatus.label': 'IP-Status',
    'work.ipStatus.moreInfo': 'Mehr Informationen',
    'work.ipStatus.publicDomain': 'Public Domain',
    'work.ipStatus.fop': 'Freedom of Panorama',
    'work.ipStatus.authorizedUse': 'Autorisierte Nutzung',
    'work.ipStatus.publicDomain.title': 'Public Domain + CC BY-NC Download',
    'work.ipStatus.publicDomain.body': 'Dieses Werk wird als Public Domain präsentiert. Die hier bereitgestellte 3D-Datei ist unter CC BY-NC 4.0 für nicht-kommerzielle Nutzung verfügbar. Bitte beachten Sie die Lizenzbedingungen vor einer Weiterverwendung.',
    'work.ipStatus.fop.title': 'Freedom of Panorama — Nur Ansicht',
    'work.ipStatus.fop.body': 'Dieses Werk wird im Rahmen der Panoramafreiheit zu Zwecken der kulturellen Dokumentation angezeigt. Da die Rechtslage bei 3D-Rekonstruktionen je nach Kontext unklar sein kann, ist das Modell ausschließlich zur Ansicht verfügbar. Downloads, Vervielfältigung und abgeleitete Werke sind untersagt. Etwaige Rechtsfolgen trägt ausschließlich der Verletzer.',
    'work.ipStatus.authorizedUse.title': 'Nutzung mit spezieller Erlaubnis',
    'work.ipStatus.authorizedUse.body': 'Dieses Werk wird auf Grundlage einer spezifischen Nutzungserlaubnis des Urhebers oder Rechteinhabers gezeigt. Die Download-Verfügbarkeit kann je nach erteilter Erlaubnis variieren. Weiterverwendung außerhalb der erlaubten Bedingungen kann Rechte Dritter verletzen.',
    'work.ipStatus.downloadProhibited': 'Downloads sind für dieses Werk untersagt (nur Ansicht).',
    'work.ipStatus.takedown': 'Urheberrechts- oder Takedown-Hinweis:',

    // Photo Render
    'work.renderPhoto': 'Foto Rendern',
    'render.backToModel': 'Zurück zum Modell',

    // Stats section
    'stats.title': 'Zahlen & Fakten',
    'stats.models': 'Werke',
    'stats.cities': 'Städte',
    'stats.monuments': 'Denkmäler',
    'stats.artworks': 'Kunstwerke',
    'stats.fountains': 'Brunnen',
    'stats.artists': 'Dokumentierte Künstler',

    // Sponsor
    'sponsor.title': 'Sponsor werden',
    'sponsor.body': 'Open Museum ist kostenlos und quelloffen. Der Betrieb ist mit realen Kosten verbunden – für Hosting, Entwicklung und 3D-Digitalisierung. Jede Unterstützung hilft, das Projekt am Leben zu erhalten.',
    'sponsor.cta': 'Auf GitHub sponsern',

    // Footer
    'footer.contact': 'Kontakt',
    'footer.address': 'Adresse',
    'footer.email': 'E-Mail',
    'footer.social': 'Soziale Medien',
    'footer.about': 'Über Open Museum',
    'footer.rights': '© 2026 Open Museum. Alle Rechte vorbehalten.',
    'footer.project': 'Open Museum ist ein innovatives Projekt mit dem Ziel, weltweites Kulturerbe als detaillierte 3D-Modelle zu erfassen und zu präsentieren.',
    'footer.disclaimer': 'Die auf dieser Plattform gezeigten Werke können urheberrechtlich geschützt sein und werden ausschließlich zur Kulturerbe-Dokumentation und Bildungszwecken präsentiert. Die Ansicht ist erlaubt. Vervielfältigung, Bearbeitung, abgeleitete Werke oder kommerzielle Nutzung können Rechte der jeweiligen Inhaber verletzen. Open Museum übernimmt keine Haftung für eine missbräuchliche Nutzung durch Dritte.',
    'footer.takedownPolicy': 'Für Takedown-Anfragen oder urheberrechtliche Hinweise kontaktieren Sie bitte',

    // 404
    '404.title': 'Seite nicht gefunden',
    '404.message': 'Die angeforderte Seite existiert nicht.',
    '404.back': 'Zur Startseite',

    // City page
    'city.description': (city: string, count: number) => `Entdecken Sie ${count} Denkmäler, Brunnen und Kunstwerke in ${city} — interaktiv in 3D auf Open Museum.`,

    // Tour
    'tour.play': 'Tour starten',
    'tour.exit': 'Tour beenden',
    'tour.step': 'Schritt',
    'tour.of': 'von',
    'tour.loading': 'Tour wird geladen…',

    // Misc
    'loading': 'Wird geladen…',
    'noworks': 'Noch keine Werke in dieser Kategorie.',
    'noworks.city': 'Noch keine Werke in dieser Stadt.',
  },
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.brunnen': 'Fountains',
    'nav.denkmale': 'Monuments',
    'nav.kunstwerke': 'Artworks',
    'nav.cities': 'Cities',
    'nav.about': 'About',

    // Homepage
    'home.title': 'Open Museum',
    'home.tagline': 'Discover monuments, fountains, and artworks in public spaces — in 3D.',
    'home.featured': 'Explore in 3D',
    'home.featured.cta': 'View work',
    'home.slideshow.title': 'Impressions',

    // Categories
    'category.brunnen': 'Fountains',
    'category.brunnen.desc': 'Historic and modern fountains across the city',
    'category.denkmal': 'Monuments',
    'category.denkmal.desc': 'Monuments and memorials in Göttingen',
    'category.kunstwerk': 'Artworks',
    'category.kunstwerk.desc': 'Sculptures and public art installations',

    // Work detail
    'work.photos': 'Photos',
    'work.location': 'Location',
    'work.artist': 'Artist',
    'work.year': 'Year',
    'work.material': 'Material',
    'work.modelCreator': '3D reconstruction by',
    'work.back': 'Back to category',
    'work.view3d': 'View 3D model',
    'work.viewAR': 'View in AR',
    'work.download': 'Download',
    'work.share': 'Share',
    'work.shareTwitter': 'Share on X',
    'work.shareFacebook': 'Share on Facebook',
    'work.shareInstagram': 'Copy for Instagram',
    'work.shareCopyLink': 'Copy link',
    'work.shareWith': 'Share via',
    'work.shareCopied': 'Link copied to clipboard.',
    'work.downloadGLB': 'Download GLB',
    'work.downloadUSDZ': 'Download USDZ',
    'work.licenseTitle': 'License Notice',
    'work.licenseNotice': 'By downloading this file, I acknowledge it is released under',
    'work.licenseLink': 'Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)',
    'work.licenseNoticeAfter': 'and may only be used for non-commercial purposes.',
    'work.licenseAuthorizedNotice': 'By downloading this file, I acknowledge it is made available only under a specific authorization from the rights holder. Any use beyond that authorization may violate intellectual property rights.',
    'work.licenseDownloadWith': 'Download as',
    'work.ipStatus.label': 'IP Status',
    'work.ipStatus.moreInfo': 'More Information',
    'work.ipStatus.publicDomain': 'Public Domain',
    'work.ipStatus.fop': 'Freedom of Panorama',
    'work.ipStatus.authorizedUse': 'Authorized Use',
    'work.ipStatus.publicDomain.title': 'Public Domain + CC BY-NC Download',
    'work.ipStatus.publicDomain.body': 'This work is presented as public domain. The downloadable 3D file on this page is offered under CC BY-NC 4.0 for non-commercial use. Please review the license terms before reusing the file.',
    'work.ipStatus.fop.title': 'Freedom of Panorama - View Only',
    'work.ipStatus.fop.body': 'This work is shown under Freedom of Panorama for cultural heritage documentation. Because legal treatment of 3D reconstructions may vary by context, this model is available for viewing only. Downloading, reproduction, and derivative works are prohibited. Any legal consequences are solely the responsibility of the violator.',
    'work.ipStatus.authorizedUse.title': 'Specific Authorized Use',
    'work.ipStatus.authorizedUse.body': 'This work is displayed based on a specific permission from the creator or rights holder. Download availability depends on the granted authorization. Reuse beyond the permitted scope may infringe third-party rights.',
    'work.ipStatus.downloadProhibited': 'Downloads are prohibited for this work (view-only).',
    'work.ipStatus.takedown': 'For copyright concerns or takedown requests:',

    // Photo Render
    'work.renderPhoto': 'Render Photo',
    'render.backToModel': 'Back to model',

    // Stats section
    'stats.title': 'By the Numbers',
    'stats.models': 'Works',
    'stats.cities': 'Cities',
    'stats.monuments': 'Monuments',
    'stats.artworks': 'Artworks',
    'stats.fountains': 'Fountains',
    'stats.artists': 'Documented Artists',

    // Sponsor
    'sponsor.title': 'Become a Sponsor',
    'sponsor.body': 'Open Museum is free and open source. Running it has real costs — hosting, development, and 3D digitization. Your support helps keep the project alive.',
    'sponsor.cta': 'Sponsor on GitHub',

    // Footer
    'footer.contact': 'Contact',
    'footer.address': 'Address',
    'footer.email': 'Email',
    'footer.social': 'Social Media',
    'footer.about': 'About Open Museum',
    'footer.rights': '© 2026 Open Museum. All rights reserved.',
    'footer.project': 'Open Museum is an innovative project dedicated to capturing and displaying cultural heritage from around the world as detailed 3D models.',
    'footer.disclaimer': 'Works displayed on this platform may be subject to copyright and are presented solely for cultural heritage preservation and educational purposes. Viewing is permitted. Reproduction, modification, derivative works, or commercial use may violate the intellectual property rights of the respective owners. Open Museum assumes no liability for third-party misuse.',
    'footer.takedownPolicy': 'For takedown notices or copyright concerns, please contact',

    // 404
    '404.title': 'Page not found',
    '404.message': 'The requested page does not exist.',
    '404.back': 'Back to home',

    // City page
    'city.description': (city: string, count: number) => `Explore ${count} monuments, fountains, and artworks in ${city} — interactive in 3D on Open Museum.`,

    // Tour
    'tour.play': 'Play Tour',
    'tour.exit': 'Exit Tour',
    'tour.step': 'Step',
    'tour.of': 'of',
    'tour.loading': 'Loading tour…',

    // Misc
    'loading': 'Loading…',
    'noworks': 'No works in this category yet.',
    'noworks.city': 'No works in this city yet.',
  },
} as const;

export type UIKey = keyof typeof ui.de;

/**
 * Get the current locale from a URL pathname.
 */
export function getLangFromUrl(url: URL): Lang {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = url.pathname.replace(base, '').replace(/^\//, '');
  const [firstSegment] = path.split('/');
  if (firstSegment in ui) return firstSegment as Lang;
  return defaultLang;
}

/**
 * Return a translation function for the given locale.
 */
export function useTranslations(lang: Lang) {
  return function t(key: UIKey): string {
    return (ui[lang][key] || ui[defaultLang][key]) as string;
  };
}

/**
 * Convert a city display name to a URL slug.
 * e.g. "Göttingen" → "goettingen"
 */
export function cityNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ä/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, '-');
}

/**
 * Get the localized path for a city page.
 */
export function getCityPath(lang: Lang, citySlug: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${lang}/cities/${citySlug}/`;
}

/**
 * Get the localized path for category pages.
 */
export function getCategoryPath(lang: Lang, category: 'brunnen' | 'denkmal' | 'kunstwerk'): string {
  const base = import.meta.env.BASE_URL;
  const categorySlugs = {
    brunnen: 'fountains',
    denkmal: 'monuments',
    kunstwerk: 'artworks',
  };
  return `${base}${lang}/${categorySlugs[category]}/`;
}

/**
 * Get the localized path for the About page.
 */
export function getAboutPath(lang: Lang): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${lang}/about/`;
}

/**
 * Get the localized path for a work detail page.
 */
export function getWorkPath(lang: Lang, slug: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${lang}/${slug}/`;
}

/**
 * Get the equivalent path in the other language.
 */
export function getAlternateLanguagePath(currentPath: string, currentLang: Lang): string {
  const base = import.meta.env.BASE_URL;
  const path = currentPath.replace(base, '').replace(/^\//, '');

  if (currentLang === 'de') {
    // DE -> EN
    if (path === 'de' || path === 'de/' || path === '' || path === '/') return `${base}en/`;
    if (path.startsWith('de/')) return `${base}en/${path.slice('de/'.length)}`;

    // Legacy paths
    if (path.startsWith('brunnen')) return `${base}en/fountains/${path.slice('brunnen/'.length)}`;
    if (path.startsWith('denkmale')) return `${base}en/monuments/${path.slice('denkmale/'.length)}`;
    if (path.startsWith('kunstwerke')) return `${base}en/artworks/${path.slice('kunstwerke/'.length)}`;
    if (path.startsWith('werke/')) return `${base}en/${path.slice('werke/'.length)}`;
    if (path.startsWith('staedte/')) return `${base}en/cities/${path.slice('staedte/'.length)}`;
    return `${base}en/${path}`;
  } else {
    // EN -> DE
    if (path === '' || path === '/' || path === 'en/' || path === 'en') return `${base}de/`;
    if (path.startsWith('en/')) return `${base}de/${path.slice('en/'.length)}`;

    // Legacy paths
    if (path.startsWith('works/')) return `${base}de/${path.slice('works/'.length)}`;
    if (path.startsWith('cities/')) return `${base}de/cities/${path.slice('cities/'.length)}`;
    return `${base}de/${path}`;
  }
}
