import { normalizeLocale } from './locale';

/**
 * Supported locale codes for the application.
 */
export type SupportedLocale = 'en' | 'es' | 'ar';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'es', 'ar'];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * UI string definitions used across the application.
 */
export interface UIStrings {
  readonly a11y: {
    readonly skipToContent: string;
    readonly languageSwitcher: string;
    readonly currentLanguage: string;
  };
  readonly nav: {
    readonly home: string;
    readonly docs: string;
    readonly apps: string;
    readonly product: string;
    readonly pricing: string;
  };
  readonly auth: {
    readonly signIn: string;
    readonly startFree: string;
  };
  readonly hero: {
    readonly title: string;
    readonly lede: string;
    readonly startFree: string;
    readonly seeApps: string;
    readonly note: string;
  };
  readonly actions: {
    readonly close: string;
    readonly submit: string;
  };
  readonly greetings: {
    readonly welcomeUser: string;
  };
  readonly finalCta: {
    readonly title: string;
    readonly lede: string;
    readonly startFree: string;
    readonly readDocs: string;
    readonly meta: string;
  };
  readonly socialProof: {
    readonly eyebrow: string;
    readonly title: string;
    readonly quote1: string;
    readonly role1: string;
    readonly quote2: string;
    readonly role2: string;
    readonly quote3: string;
    readonly role3: string;
  };
  readonly featureTrio: {
    readonly eyebrow: string;
    readonly title: string;
    readonly lede: string;
    readonly authTitle: string;
    readonly authLede: string;
    readonly dbTitle: string;
    readonly dbLede: string;
    readonly privacyTitle: string;
    readonly privacyLede: string;
  };
  readonly logoStrip: {
    readonly label: string;
    readonly ariaLabel: string;
  };
  readonly faq: {
    readonly eyebrow: string;
    readonly title: string;
    readonly q1: string;
    readonly a1: string;
    readonly q2: string;
    readonly a2: string;
    readonly q3: string;
    readonly a3: string;
    readonly q4: string;
    readonly a4: string;
    readonly q5: string;
    readonly a5: string;
  };
  readonly canvasWindows: {
    readonly eyebrow: string;
    readonly title: string;
    readonly lede: string;
  };
  readonly screenGallery: {
    readonly title: string;
    readonly lede: string;
    readonly crmDealsTitle: string;
    readonly crmDealsNote: string;
    readonly crmPipelineTitle: string;
    readonly crmPipelineNote: string;
    readonly crmCalendarTitle: string;
    readonly crmCalendarNote: string;
    readonly crmGalleryTitle: string;
    readonly crmGalleryNote: string;
    readonly crmForecastTitle: string;
    readonly crmForecastNote: string;
    readonly dashboardTitle: string;
    readonly dashboardNote: string;
    readonly mapTitle: string;
    readonly mapNote: string;
    readonly timelineTitle: string;
    readonly timelineNote: string;
    readonly splitTitle: string;
    readonly splitNote: string;
    readonly analyticsTitle: string;
    readonly analyticsNote: string;
    readonly themesTitle: string;
    readonly themesNote: string;
  };
  readonly backendArchitecture: {
    readonly eyebrow: string;
    readonly title: string;
    readonly lede: string;
  };
  readonly studioNetwork: {
    readonly legendOrg: string;
    readonly legendTeam: string;
    readonly legendPublic: string;
    readonly assistantPrompt: string;
    readonly stepEnginesTitle: string;
    readonly stepEnginesBody: string;
    readonly stepAppsTitle: string;
    readonly stepAppsBody: string;
    readonly stepSpacesTitle: string;
    readonly stepSpacesBody: string;
    readonly stepAssistantTitle: string;
    readonly stepAssistantBody: string;
  };
  readonly stackShowcase: {
    readonly title: string;
    readonly lede: string;
    readonly tabServicesName: string;
    readonly tabServicesProblem: string;
    readonly tabScalingName: string;
    readonly tabScalingProblem: string;
    readonly tabWhyName: string;
    readonly tabWhyProblem: string;
  };
  whySlide: {
    readonly title: string;
    readonly problem1: string;
    readonly answer1: string;
    readonly problem2: string;
    readonly answer2: string;
    readonly problem3: string;
    readonly answer3: string;
    readonly problem4: string;
    readonly answer4: string;
    readonly problem5: string;
    readonly answer5: string;
  };
  readonly footer: {
    readonly tagline: string;
    readonly newsletterLabel: string;
    readonly newsletterButton: string;
    readonly newsletterConsent: string;
    readonly newsletterMeta: string;
    readonly groupProduct: string;
    readonly linkOverview: string;
    readonly linkPricing: string;
    readonly linkFaq: string;
    readonly groupResources: string;
    readonly linkDocs: string;
    readonly groupCompany: string;
    readonly linkGithub: string;
    readonly groupLegal: string;
    readonly linkPrivacy: string;
    readonly linkTerms: string;
    readonly linkCookies: string;
    readonly linkDataRights: string;
    readonly copyright: string;
    readonly gdprContact: string;
  };
readonly appTour: {
    readonly title: string;
    readonly lede: string;
    readonly worksWith: string;
    readonly pocketTitle: string;
    readonly pocketLede: string;
    readonly appDocsName: string;
    readonly appDocsHint: string;
    readonly appDocsSummary: string;
    readonly appDatabaseName: string;
    readonly appDatabaseHint: string;
    readonly appDatabaseSummary: string;
    readonly appBoardName: string;
    readonly appBoardHint: string;
    readonly appBoardSummary: string;
    readonly appCalendarName: string;
    readonly appCalendarHint: string;
    readonly appCalendarSummary: string;
    readonly appMailName: string;
    readonly appMailHint: string;
    readonly appMailSummary: string;
    readonly appWhiteboardName: string;
    readonly appWhiteboardHint: string;
    readonly appWhiteboardSummary: string;
  };
  readonly pricing: {
    readonly eyebrow: string;
    readonly title: string;
    readonly lede: string;
    readonly mostPopular: string;
    readonly freeName: string;
    readonly freePrice: string;
    readonly freeCadence: string;
    readonly freeSummary: string;
    readonly freeFeature1: string;
    readonly freeFeature2: string;
    readonly freeFeature3: string;
    readonly freeFeature4: string;
    readonly freeCta: string;
    readonly teamName: string;
    readonly teamPrice: string;
    readonly teamCadence: string;
    readonly teamSummary: string;
    readonly teamFeature1: string;
    readonly teamFeature2: string;
    readonly teamFeature3: string;
    readonly teamFeature4: string;
    readonly teamCta: string;
    readonly selfName: string;
    readonly selfPrice: string;
    readonly selfCadence: string;
    readonly selfSummary: string;
    selfFeature1: string;
    readonly selfFeature2: string;
    readonly selfFeature3: string;
    readonly selfFeature4: string;
    readonly selfCta: string;
  };
  readonly docsTeaser: {
    readonly eyebrow: string;
    readonly title: string;
    readonly lede: string;
    readonly openDocs: string;
    readonly copy: string;
    readonly copied: string;
    readonly linkQuickstart: string;
    readonly linkAuth: string;
    readonly linkPostgrest: string;
    readonly linkGdpr: string;
  };
}

export type TranslationDictionary = Record<SupportedLocale, UIStrings>;

export const DICTIONARY: TranslationDictionary = {
  en: {
    a11y: {
      skipToContent: 'Skip to content',
      languageSwitcher: 'Change language',
      currentLanguage: 'Current language',
    },
    nav: {
      home: 'Home',
      docs: 'Docs',
      apps: 'Apps',
      product: 'Product',
      pricing: 'Pricing',
    },
    auth: {
      signIn: 'Sign in',
      startFree: 'Start free',
    },
    hero: {
      title: 'All your business apps, connected in one space.',
      lede: 'Pages, databases, boards, calendar, mail and whiteboards that link to each other, so every client, task and date lives in one place.',
      startFree: 'Start free',
      seeApps: 'See every app',
      note: 'No credit card. Self-host whenever you want.',
    },
    actions: {
      close: 'Close',
      submit: 'Submit',
    },
    greetings: {
      welcomeUser: 'Welcome, {name}!',
    },
    finalCta: {
      title: 'Start with one page. Connect the rest as you grow.',
      lede: 'Open source, GDPR-ready, and yours to host.',
      startFree: 'Start free',
      readDocs: 'Read the docs',
      meta: 'No credit card. Self-host whenever you want.',
    },
    logoStrip: {
      label: 'Trusted by product teams everywhere',
      ariaLabel: 'Trusted by teams at',
    },
    socialProof: {
      eyebrow: 'What teams say',
      title: 'Built by people shipping every week.',
      quote1: '“We replaced four SaaS subscriptions with one Compose file. Onboarding now takes a day, not a sprint.”',
      role1: 'Staff Engineer',
      quote2: '“The GDPR plumbing alone saved us six weeks. The mascot is a bonus.”',
      role2: 'Head of Product',
      quote3: '“Self-hosted, audited, owned. Exactly what our security team asked for.”',
      role3: 'CTO',
    },
    docsTeaser: {
      eyebrow: 'Built for engineers',
      title: 'Read the docs. Ship in an afternoon.',
      lede: 'Every endpoint typed. Every recipe runnable. Every page versioned.',
      openDocs: 'Open the docs',
      copy: 'Copy',
      copied: 'Copied',
      linkQuickstart: 'Quickstart',
      linkAuth: 'Auth & sessions',
      linkPostgrest: 'PostgREST recipes',
      linkGdpr: 'GDPR runbook',
    },
    featureTrio: {
      eyebrow: 'What you get',
      title: 'A backend stack you would have built — already built.',
      lede: 'Three primitives, one Docker Compose file, full keys to the kingdom.',
      authTitle: 'Auth that just works',
      authLede: 'Auth with GoTrue under the hood, social providers, magic links, and Turnstile-protected sign-ups out of the box.',
      dbTitle: 'PostgREST + Postgres',
      dbLede: 'Your schema is your API. Row-level security, typed queries, instant realtime — no glue code.',
      privacyTitle: 'GDPR by default',
      privacyLede: 'GDPR by default: consent ledger, DSAR exports, breach response runbook, and EU data residency baked in.',
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'Answers, before you ask.',
      q1: 'Can I really self-host the whole stack?',
      a1: 'Yes. The entire backend infrastructure repo is MIT licensed: Kong, GoTrue, PostgREST, Postgres, MailHog. One docker compose up and you are running locally; the same images deploy to any VPS.',
      q2: 'Where does my data live?',
      a2: 'Wherever you put it. The hosted tier runs in EU regions (Paris and Frankfurt). Self-hosted means your machines, your jurisdiction, your DPA — we never see the data.',
      q3: 'How does pricing work as I grow?',
      a3: 'You pay per active project, not per seat. Move from Free → Team in one click. If you outgrow Team, self-host: same code, no migration.',
      q4: 'How do I migrate from another BaaS?',
      a4: 'PostgREST means your schema is the API. Most teams import their existing dump, point Kong at it, and ship in under a day. We have migration recipes for Supabase, Firebase and Hasura.',
      q5: 'What about security audits?',
      a5: 'Auth flows ship with Turnstile, rate-limit and CSP defaults. The repo includes a published threat model, breach-response runbook, and OWASP ASVS L2 mapping in /docs/gdpr/.',
    },
    canvasWindows: {
      eyebrow: 'Workspace anatomy',
      title: 'One canvas, many windows.',
      lede: 'Notes, auth, metrics, Postgres rows, email events, and product workflows all live in one place without losing the backend wiring underneath.',
    },
    screenGallery: {
      title: 'Screens from the running app',
      lede: 'Unedited screenshots of osionos on two demo workspaces, a sales CRM and a product catalog, shown the ways your team needs them.',
      crmDealsTitle: 'A CRM from two databases',
      crmDealsNote: 'Deals with formulas for weighted value and health, coloured by stage and odds.',
      crmPipelineTitle: 'The pipeline as a board',
      crmPipelineNote: 'One column per stage, each card a deal with its amount, owner and close date.',
      crmCalendarTitle: 'Next steps on a calendar',
      crmCalendarNote: 'The same deals by follow-up date, coloured by stage.',
      crmGalleryTitle: 'Big deals as cards',
      crmGalleryNote: 'One filter turns the table into a gallery of deals above 60,000.',
      crmForecastTitle: 'Forecast and regions',
      crmForecastNote: 'Deals closing soon, win odds and accounts on a map, read from the same rows.',
      dashboardTitle: 'Dashboards over your rows',
      dashboardNote: 'Totals, charts and breakdowns, next to every database the workspace reads.',
      mapTitle: 'Rows on a map',
      mapNote: 'Each product pinned at its warehouse address, coloured by category.',
      timelineTitle: 'Projects on a timeline',
      timelineNote: 'Start and end dates drawn as bars, labelled with their status.',
      splitTitle: 'Two views side by side',
      splitNote: 'Split the editor to keep the board and the numbers in sight.',
      analyticsTitle: 'Same data, any theme',
      analyticsNote: 'The analytics view in Midnight, one of nine colour themes.',
      themesTitle: 'Set up the way you work',
      themesNote: 'Light or dark, an accent colour, density, corners and text size.',
    },
    backendArchitecture: {
      eyebrow: 'Inside the studio',
      title: 'One network for every database, app and team.',
      lede: 'Prismatica joins your databases into one network. Each team builds on the part it is allowed to reach, and the tablet below lets you run the backend yourself.',
    },
    studioNetwork: {
      legendOrg: 'Organisation',
      legendTeam: 'Sales team',
      legendPublic: 'Public space',
      assistantPrompt: 'Make a space for the sales team: a pipeline map, shared notes, Postgres and Redis.',
      stepEnginesTitle: 'Connect every engine',
      stepEnginesBody: 'Ten engines, from Postgres and MongoDB to Redis, DynamoDB and any HTTP API, join one network. Create, read, update and delete through a single typed API.',
      stepAppsTitle: 'Build on the same data',
      stepAppsBody: 'Diagrams, views, maps and notes read the live records. The LLM trace draws how a model moves through your data, step by step.',
      stepSpacesTitle: 'Decide who reaches what',
      stepSpacesBody: 'Organisations, teams and public spaces are subnetworks. Attribute-based rules decide which engines and apps each one can reach.',
      stepAssistantTitle: 'Ask for a space',
      stepAssistantBody: 'Tell the assistant what your team needs. It lays out the engines, apps and rules, and you adjust the result.',
    },
    stackShowcase: {
      title: 'Run the stack yourself',
      lede: 'The real grobase backend on a tablet: start and stop any of its services, watch a request cross it, then see how it grows.',
      tabServicesName: 'Services',
      tabServicesProblem: 'Every new app needs its own backend. Here are 55 services, already wired.',
      tabScalingName: 'Scaling',
      tabScalingProblem: 'Growing usually means re-platforming. Here the same stack scales out.',
      tabWhyName: 'Why us',
      tabWhyProblem: 'Work and data scattered across tools, and what replaces them.',
    },
    whySlide: {
      title: 'What Prismatica takes off your plate',
      problem1: 'Your team\'s tools don\'t talk to each other.',
      answer1: '6 apps share one workspace: pages, databases, boards, calendars, mail and whiteboards.',
      problem2: 'Your data is split across databases.',
      answer2: 'One network reaches 10 engines, from Postgres to DynamoDB, through one API.',
      problem3: 'Every new app rebuilds sign-in, permissions and webhooks.',
      answer3: '55 services come wired: sign-in, a permission check on every query, signed webhooks and live updates.',
      problem4: 'Growing means a rewrite.',
      answer4: 'The same images run on a laptop and on Kubernetes, from one data plane to 10.',
      problem5: 'Owning your data is hard to prove.',
      answer5: 'Open source under MIT and self-hosted, with GDPR export and erasure built in.',
    },
    footer: {
      tagline: 'Open-source backend for product teams.',
      newsletterLabel: 'Get release notes',
      newsletterButton: 'Subscribe',
      newsletterConsent: 'I agree to receive release emails and can unsubscribe from any footer.',
      newsletterMeta: 'One email per release. No tracking pixels.',
      groupProduct: 'Product',
      linkOverview: 'Overview',
      linkPricing: 'Pricing',
      linkFaq: 'FAQ',
      groupResources: 'Resources',
      linkDocs: 'Docs',
      groupCompany: 'Company',
      linkGithub: 'GitHub',
      groupLegal: 'Legal',
      linkPrivacy: 'Privacy policy',
      linkTerms: 'Terms',
      linkCookies: 'Cookies',
      linkDataRights: 'Data rights',
      copyright: '© {year} Prismatica · Open source under MIT',
      gdprContact: 'GDPR contact:',
    },
    pricing: {
      eyebrow: 'Pricing',
      title: 'Pick a tier. Switch anytime.',
      lede: 'No seat counts. No vendor lock-in. Self-host whenever you want.',
      mostPopular: 'Most popular',
      freeName: 'Free',
      freePrice: '€0',
      freeCadence: 'forever',
      freeSummary: 'For solo builders and side projects.',
      freeFeature1: '1 project · 5K MAU',
      freeFeature2: 'Auth, Database, Storage',
      freeFeature3: 'Community support',
      freeFeature4: 'EU data residency',
      freeCta: 'Start free',
      teamName: 'Team',
      teamPrice: '€39',
      teamCadence: 'per project · month',
      teamSummary: 'For teams with users in production.',
      teamFeature1: '10 projects · 50K MAU',
      teamFeature2: 'Realtime, Edge Functions',
      teamFeature3: 'SSO + audit logs',
      teamFeature4: 'Email support, 24h SLA',
      teamCta: 'Start 14-day trial',
      selfName: 'Self-hosted',
      selfPrice: 'Free',
      selfCadence: 'forever · MIT',
      selfSummary: 'Run the whole stack on your VPS.',
      selfFeature1: 'Unlimited everything',
      selfFeature2: 'Docker Compose + Helm',
      selfFeature3: 'Audited GDPR runbooks',
      selfFeature4: 'Optional paid support',
      selfCta: 'See the docs',
    },
    appTour: {
      title: 'Six apps that already talk to each other.',
      lede: 'Each one is a block you can drop into any page. They read the same data, so a client added in the database shows up on the board, in the calendar and in your mail.',
      worksWith: 'Works with',
      pocketTitle: 'Your workspace in your pocket.',
      pocketLede: "The same pages, boards and inbox on your phone, synced as you work. Check today's tasks on the way in, answer a client from the train.",
      appDocsName: 'Page',
      appDocsHint: 'Notes, plans and wikis',
      appDocsSummary: 'Write plans, notes and wikis. Mention a client, a task or an email and it stays linked, wherever it moves.',
      appDatabaseName: 'Database',
      appDatabaseHint: 'Clients, orders, stock',
      appDatabaseSummary: 'Keep clients, orders or stock in tables. Every row opens as a page, and every view reads the same data.',
      appBoardName: 'Board',
      appBoardHint: 'Work moving through stages',
      appBoardSummary: 'Move work across stages. Cards are rows of your database, not copies, so nothing goes stale.',
      appCalendarName: 'Calendar',
      appCalendarHint: 'Deadlines and meetings',
      appCalendarSummary: 'See deadlines and meetings in one week. Dates come straight from your boards and your mail.',
      appMailName: 'Mail',
      appMailHint: 'Your inbox, next to the work',
      appMailSummary: 'Read mail next to the work it is about. Turn any email into a task in one step.',
      appWhiteboardName: 'Whiteboard',
      appWhiteboardHint: 'Sketch flows and ideas',
      appWhiteboardSummary: 'Sketch flows and ideas together, then drop the drawing into any page.',
    },
  },
  es: {
    a11y: {
      skipToContent: 'Saltar al contenido',
      languageSwitcher: 'Cambiar idioma',
      currentLanguage: 'Idioma actual',
    },
    nav: {
      home: 'Inicio',
      docs: 'Documentación',
      apps: 'Aplicaciones',
      product: 'Producto',
      pricing: 'Precios',
    },
    auth: {
      signIn: 'Iniciar sesión',
      startFree: 'Empezar gratis',
    },
    hero: {
      title: 'Todas tus aplicaciones de negocio, conectadas en un solo espacio.',
      lede: 'Páginas, bases de datos, tableros, calendario, correo y pizarras vinculadas entre sí, para que cada cliente, tarea y fecha viva en un solo lugar.',
      startFree: 'Empezar gratis',
      seeApps: 'Ver todas las apps',
      note: 'Sin tarjeta de crédito. Autoalojable cuando quieras.',
    },
    actions: {
      close: 'Cerrar',
      submit: 'Enviar',
    },
    greetings: {
      welcomeUser: '¡Bienvenido, {name}!',
    },
    finalCta: {
      title: 'Empieza con una página. Conecta el resto a medida que creces.',
      lede: 'Código abierto, preparado para RGPD y listo para autoalojar.',
      startFree: 'Empezar gratis',
      readDocs: 'Leer la documentación',
      meta: 'Sin tarjeta de crédito. Autoalojable cuando quieras.',
    },
    logoStrip: {
      label: 'De la confianza de equipos de producto en todo el mundo',
      ariaLabel: 'De la confianza de equipos en',
    },
socialProof: {
      eyebrow: 'Lo que dicen los equipos',
      title: 'Construido por personas que entregan cada semana.',
      quote1: '“Reemplazamos cuatro suscripciones SaaS con un solo archivo Compose. La incorporación ahora lleva un día, no un sprint.”',
      role1: 'Ingeniera Principal',
      quote2: '“La infraestructura de GDPR por sí sola nos ahorró seis semanas. La mascota es un extra.”',
      role2: 'Jefe de Producto',
      quote3: '“Autoalojado, auditado y propio. Exactamente lo que pidió nuestro equipo de seguridad.”',
      role3: 'Director de Tecnología',
    },
    docsTeaser: {
      eyebrow: 'Construido para ingenieros',
      title: 'Lee la documentación. Entrega en una tarde.',
      lede: 'Cada endpoint tipado. Cada receta ejecutable. Cada página versionada.',
      openDocs: 'Abrir la documentación',
      copy: 'Copiar',
      copied: 'Copiado',
      linkQuickstart: 'Guía rápida',
      linkAuth: 'Autenticación y sesiones',
      linkPostgrest: 'Recetas de PostgREST',
      linkGdpr: 'Manual de RGPD',
    },
    featureTrio: {
      eyebrow: 'Lo que obtienes',
      title: 'El stack de backend que habrías construido — ya listo.',
      lede: 'Tres primitivas, un archivo Docker Compose, las llaves completas del reino.',
      authTitle: 'Autenticación que simplemente funciona',
      authLede: 'Autenticación con GoTrue por debajo, proveedores sociales, enlaces mágicos y registros protegidos con Turnstile de fábrica.',
      dbTitle: 'PostgREST + Postgres',
      dbLede: 'Tu esquema es tu API. Seguridad a nivel de fila, consultas tipadas y tiempo real instantáneo — sin código pegamento.',
      privacyTitle: 'RGPD por defecto',
      privacyLede: 'RGPD por defecto: registro de consentimientos, exportaciones ARCO/DSAR, guía de respuesta a brechas y residencia de datos en la UE.',
    },
faq: {
      eyebrow: 'Preguntas frecuentes',
      title: 'Respuestas, antes de que preguntes.',
      q1: '¿Realmente puedo autoalojar todo el stack?',
      a1: 'Sí. Todo el repositorio de infraestructura backend tiene licencia MIT: Kong, GoTrue, PostgREST, Postgres, MailHog. Un docker compose up y funciona en local; las mismas imágenes se despliegan en cualquier VPS.',
      q2: '¿Dónde residen mis datos?',
      a2: 'Donde tú decida. El plan alojado opera en regiones de la UE (París y Fráncfort). Autoalojado significa tus máquinas, tu jurisdicción, tu DPA — nunca vemos los datos.',
      q3: '¿Cómo funciona el precio a medida que crezco?',
      a3: 'Pagas por proyecto activo, no por usuario. Pasa de Free a Team con un solo clic. Si superas Team, autoaloja: el mismo código, sin migración.',
      q4: '¿Cómo migro desde otro BaaS?',
      a4: 'Con PostgREST tu esquema es tu API. La mayoría de equipos importa su volcado existente, conecta Kong y lo publica en menos de un día. Tenemos recetas de migración para Supabase, Firebase y Hasura.',
      q5: '¿Qué hay de las auditorías de seguridad?',
      a5: 'Los flujos de autenticación incluyen Turnstile, límites de tasa y CSP por defecto. El repositorio incluye un modelo de amenazas publicado, guía de respuesta a brechas y correspondencia con OWASP ASVS L2 en /docs/gdpr/.',
    },
    canvasWindows: {
      eyebrow: 'Anatomía del espacio de trabajo',
      title: 'Un lienzo, múltiples ventanas.',
      lede: 'Notas, autenticación, métricas, filas de Postgres, eventos de email y flujos de producto conviven en un solo lugar sin perder la conexión con el backend subyacente.',
    },
    screenGallery: {
      title: 'Capturas de la aplicación en ejecución',
      lede: 'Capturas sin editar de osionos en dos espacios de demostración: un CRM de ventas y un catálogo de productos, mostrados según las necesidades de tu equipo.',
      crmDealsTitle: 'Un CRM a partir de dos bases de datos',
      crmDealsNote: 'Oportunidades con fórmulas para valor ponderado y salud, coloreadas por etapa y probabilidad.',
      crmPipelineTitle: 'El pipeline en formato tablero',
      crmPipelineNote: 'Una columna por etapa, cada tarjeta una oportunidad con su importe, responsable y fecha de cierre.',
      crmCalendarTitle: 'Próximos pasos en un calendario',
      crmCalendarNote: 'Las mismas oportunidades ordenadas por fecha de seguimiento, coloreadas por etapa.',
      crmGalleryTitle: 'Grandes operaciones en tarjetas',
      crmGalleryNote: 'Un solo filtro convierte la tabla en una galería de oportunidades superiores a 60.000.',
      crmForecastTitle: 'Previsión y regiones',
      crmForecastNote: 'Operaciones próximas a cerrar, probabilidades de éxito y cuentas en un mapa, leídas de las mismas filas.',
      dashboardTitle: 'Cuadros de mando sobre tus filas',
      dashboardNote: 'Totales, gráficos y desgloses, junto a cada base de datos que lee el espacio de trabajo.',
      mapTitle: 'Filas en un mapa',
      mapNote: 'Cada producto ubicado en la dirección de su almacén, coloreado por categoría.',
      timelineTitle: 'Proyectos en una línea temporal',
      timelineNote: 'Fechas de inicio y fin representadas como barras, etiquetadas con su estado.',
      splitTitle: 'Dos vistas en paralelo',
      splitNote: 'Divide el editor para mantener el tablero y las cifras a la vista.',
      analyticsTitle: 'Los mismos datos, cualquier tema',
      analyticsNote: 'La vista analítica en Medianoche, uno de los nueve temas de color.',
      themesTitle: 'Configurado a tu forma de trabajar',
      themesNote: 'Claro u oscuro, color de acento, densidad, esquinas y tamaño de texto.',
    },
    backendArchitecture: {
      eyebrow: 'Dentro del estudio',
      title: 'Una red para cada base de datos, app y equipo.',
      lede: 'Prismatica une tus bases de datos en una sola red. Cada equipo construye sobre la parte a la que tiene acceso permitido, y la tableta inferior te permite ejecutar el backend tú mismo.',
    },
    studioNetwork: {
      legendOrg: 'Organización',
      legendTeam: 'Equipo de ventas',
      legendPublic: 'Espacio público',
      assistantPrompt: 'Crea un espacio para el equipo de ventas: un mapa de embudo, notas compartidas, Postgres y Redis.',
      stepEnginesTitle: 'Conecta cada motor',
      stepEnginesBody: 'Diez motores, desde Postgres y MongoDB hasta Redis, DynamoDB y cualquier API HTTP, se unen en una red. Crea, lee, actualiza y elimina mediante una única API tipada.',
      stepAppsTitle: 'Construye sobre los mismos datos',
      stepAppsBody: 'Diagramas, vistas, mapas y notas leen los registros en vivo. El rastreo de LLM dibuja cómo se mueve un modelo a través de tus datos, paso a paso.',
      stepSpacesTitle: 'Decide quién accede a qué',
      stepSpacesBody: 'Organizaciones, equipos y espacios públicos son subredes. Reglas basadas en atributos deciden a qué motores y aplicaciones puede acceder cada uno.',
      stepAssistantTitle: 'Pide un espacio',
      stepAssistantBody: 'Dile al asistente lo que tu equipo necesita. Diseña los motores, aplicaciones y reglas, y tú ajustas el resultado.',
    },
    stackShowcase: {
      title: 'Ejecuta la infraestructura tú mismo',
      lede: 'El backend real de grobase en una tableta: inicia y detén cualquiera de sus servicios, observa cómo viaja una petición y mira cómo escala.',
      tabServicesName: 'Servicios',
      tabServicesProblem: 'Cada nueva aplicación necesita su propio backend. Aquí hay 55 servicios, ya interconectados.',
      tabScalingName: 'Escalabilidad',
      tabScalingProblem: 'Crecer suele requerir cambiar de plataforma. Aquí la misma arquitectura escala horizontalmente.',
      tabWhyName: 'Por qué nosotros',
      tabWhyProblem: 'Trabajo y datos dispersos entre herramientas, y cómo unificarlos.',
    },
    whySlide: {
      title: 'Lo que Prismatica resuelve por ti',
      problem1: 'Las herramientas de tu equipo no se comunican entre sí.',
      answer1: '6 aplicaciones comparten un único espacio: páginas, bases de datos, tableros, calendarios, correo y pizarras.',
      problem2: 'Tus datos están divididos entre múltiples bases de datos.',
      answer2: 'Una sola red conecta 10 motores, desde Postgres hasta DynamoDB, a través de una sola API.',
      problem3: 'Cada nueva app vuelve a crear inicio de sesión, permisos y webhooks.',
      answer3: '55 servicios ya conectados: inicio de sesión, verificación de permisos en cada consulta, webhooks firmados y actualizaciones en tiempo real.',
      problem4: 'Crecer significa reescribir código.',
      answer4: 'Las mismas imágenes se ejecutan en un portátil y en Kubernetes, desde un plano de datos hasta 10.',
      problem5: 'Demostrar que eres dueño de tus datos es difícil.',
      answer5: 'Código abierto bajo licencia MIT y autoalojado, con exportación y borrado GDPR integrados.',
    },
    footer: {
      tagline: 'Backend de código abierto para equipos de producto.',
      newsletterLabel: 'Recibe notas de versiones',
      newsletterButton: 'Suscribirse',
      newsletterConsent: 'Acepto recibir correos sobre nuevas versiones y puedo cancelar la suscripción desde cualquier pie de página.',
      newsletterMeta: 'Un correo por lanzamiento. Sin píxeles de seguimiento.',
      groupProduct: 'Producto',
      linkOverview: 'Visión general',
      linkPricing: 'Precios',
      linkFaq: 'FAQ',
      groupResources: 'Recursos',
      linkDocs: 'Documentación',
      groupCompany: 'Compañía',
      linkGithub: 'GitHub',
      groupLegal: 'Legal',
      linkPrivacy: 'Política de privacidad',
      linkTerms: 'Términos',
      linkCookies: 'Cookies',
      linkDataRights: 'Derechos de datos',
      copyright: '© {year} Prismatica · Código abierto bajo MIT',
      gdprContact: 'Contacto GDPR:',
    },
    appTour: {
      title: 'Seis aplicaciones que ya se comunican entre sí.',
      lede: 'Cada una es un bloque que puedes insertar en cualquier página. Leen los mismos datos, por lo que un cliente agregado en la base de datos aparece en el tablero, en el calendario y en tu correo.',
      worksWith: 'Funciona con',
      pocketTitle: 'Tu espacio de trabajo en tu bolsillo.',
      pocketLede: 'Las mismas páginas, tableros y bandeja de entrada en tu teléfono, sincronizados mientras trabajas. Revisa las tareas del día de camino o responde a un cliente desde el tren.',
      appDocsName: 'Página',
      appDocsHint: 'Notas, planes y wikis',
      appDocsSummary: 'Escribe planes, notas y wikis. Menciona un cliente, una tarea o un correo y se mantendrá vinculado, donde sea que se mueva.',
      appDatabaseName: 'Base de datos',
      appDatabaseHint: 'Clientes, pedidos, stock',
      appDatabaseSummary: 'Mantén clientes, pedidos o existencias en tablas. Cada fila se abre como una página y cada vista lee los mismos datos.',
      appBoardName: 'Tablero',
      appBoardHint: 'El trabajo avanzando por etapas',
      appBoardSummary: 'Mueve el trabajo a través de etapas. Las tarjetas son filas de tu base de datos, no copias, por lo que nada queda desactualizado.',
      appCalendarName: 'Calendario',
      appCalendarHint: 'Plazos y reuniones',
      appCalendarSummary: 'Consulta plazos y reuniones en una sola semana. Las fechas provienen directamente de tus tableros y tu correo.',
      appMailName: 'Correo',
      appMailHint: 'Tu bandeja de entrada, junto al trabajo',
      appMailSummary: 'Lee el correo junto al trabajo correspondiente. Convierte cualquier correo en una tarea en un solo paso.',
      appWhiteboardName: 'Pizarra',
      appWhiteboardHint: 'Esboza flujos e ideas',
      appWhiteboardSummary: 'Esboza flujos e ideas en equipo y luego inserta el dibujo en cualquier página.',
    },
    pricing: {
      eyebrow: 'Precios',
      title: 'Elige un plan. Cambia cuando quieras.',
      lede: 'Sin recuento de usuarios. Sin permanencia. Autoaloja cuando quieras.',
      mostPopular: 'Más popular',
      freeName: 'Gratis',
      freePrice: '€0',
      freeCadence: 'para siempre',
      freeSummary: 'Para desarrolladores independientes y proyectos secundarios.',
      freeFeature1: '1 proyecto · 5K MAU',
      freeFeature2: 'Autenticación, Base de datos, Almacenamiento',
      freeFeature3: 'Soporte comunitario',
      freeFeature4: 'Residencia de datos en la UE',
      freeCta: 'Empezar gratis',
      teamName: 'Equipo',
      teamPrice: '€39',
      teamCadence: 'por proyecto · mes',
      teamSummary: 'Para equipos con usuarios en producción.',
      teamFeature1: '10 proyectos · 50K MAU',
      teamFeature2: 'Tiempo real, Funciones Edge',
      teamFeature3: 'SSO + registros de auditoría',
      teamFeature4: 'Soporte por email, SLA 24h',
      teamCta: 'Iniciar prueba de 14 días',
      selfName: 'Autoalojado',
      selfPrice: 'Gratis',
      selfCadence: 'para siempre · MIT',
      selfSummary: 'Ejecuta todo el stack en tu VPS.',
      selfFeature1: 'Ilimitado en todo',
      selfFeature2: 'Docker Compose + Helm',
      selfFeature3: 'Manuales de RGPD auditados',
      selfFeature4: 'Soporte de pago opcional',
      selfCta: 'Ver la documentación',
    },
  },
  ar: {
    a11y: {
      skipToContent: 'الانتقال إلى المحتوى',
      languageSwitcher: 'تغيير اللغة',
      currentLanguage: 'اللغة الحالية',
    },
    nav: {
      home: 'الرئيسية',
      docs: 'التوثيق',
      apps: 'تطبيقات',
      product: 'المنتج',
      pricing: 'الأسعار',
    },
    auth: {
      signIn: 'تسجيل الدخول',
      startFree: 'ابدأ مجاناً',
    },
    hero: {
      title: 'جميع تطبيقات أعمالك، متصلة في مساحة واحدة.',
      lede: 'صفحات وقواعد بيانات ولوحات وتقويم وبريد ولوحات بيضاء مترابطة، بحيث يعيش كل عميل ومهمة وتاريخ في مكان واحد.',
      startFree: 'ابدأ مجاناً',
      seeApps: 'عرض جميع التطبيقات',
      note: 'بدون بطاقة ائتمان. استضفها بنفسك متى شئت.',
    },
    actions: {
      close: 'إغلاق',
      submit: 'إرسال',
    },
    greetings: {
      welcomeUser: 'مرحباً، {name}!',
    },
    finalCta: {
      title: 'ابدأ بصفحة واحدة. واربط الباقي مع نمو أعمالك.',
      lede: 'مفتوح المصدر، متوافق مع GDPR، وجاهز للاستضافة الذاتية.',
      startFree: 'ابدأ مجاناً',
      readDocs: 'اقرأ التوثيق',
      meta: 'لا حاجة لبطاقة ائتمان. استضافة ذاتية متى شئت.',
    },
    logoStrip: {
      label: 'موثوق به من قِبل فرق المنتجات في كل مكان',
      ariaLabel: 'موثوق به من فرق عمل في',
    },
    socialProof: {
      eyebrow: 'ما تقوله فرق العمل',
      title: 'صُمم بأيدي أشخاص يطلقون الإنتاج أسبوعياً.',
      quote1: '“استبدلنا أربعة اشتراكات SaaS بملف Compose واحد. أصبح انضمام الفريق يستغرق يوماً واحداً لا مرحلة كاملة.”',
      role1: 'مهندسة رئيسية',
      quote2: '“بنية GDPR التحتية وحدها وفرت علينا ستة أسابيع. والتميمة ميزة إضافية.”',
      role2: 'رئيس المنتجات',
      quote3: '“مستضيف ذاتياً، مُدقَّق، ومملوك بالكامل. تماماً ما طلبه فريق الأمان لدينا.”',
      role3: 'المدير التنفيذي للتكنولوجيا',
    },
    docsTeaser: {
      eyebrow: 'صُمم للمهندسين',
      title: 'اقرأ التوثيق. أطلق في ظهيرة واحدة.',
      lede: 'كل نقطة نهاية منمطة. كل وصفة جاهزة للتشغيل. كل صفحة مؤرخة بإصدار.',
      openDocs: 'افتح التوثيق',
      copy: 'نسخ',
      copied: 'تم النسخ',
      linkQuickstart: 'البدء السريع',
      linkAuth: 'المصادقة والجلسات',
      linkPostgrest: 'وصفات PostgREST',
      linkGdpr: 'دليل إجراءات GDPR',
    },
    featureTrio: {
      eyebrow: 'ما تحصل عليه',
      title: 'بنية تحتية برمجية كما كنت لتبنيها — مبنية وجاهزة بالفعل.',
      lede: 'ثلاث لبنات أساسية، ملف Docker Compose واحد، والمفاتيح الكاملة لملكك.',
      authTitle: 'نظام مصادقة يعمل بسلاسة',
      authLede: 'مصادقة مدعومة بـ GoTrue، مع تسجيل دخول اجتماعي، وروابط سحرية، وحماية Turnstile مدمجة عند التسجيل.',
      dbTitle: 'PostgREST + Postgres',
      dbLede: 'مخطط بياناتك هو واجهة برمجة تطبيقاتك (API). أمان على مستوى الصف، استعلامات منمطة، وبث فوري دون كود وسيط.',
      privacyTitle: 'متوافق مع GDPR افتراضياً',
      privacyLede: 'توافق تام مع GDPR افتراضياً: سجل للموافقات، تصدير طلبات DSAR، دليل استجابة للخروقات، وإقامة بيانات في الاتحاد الأوروبي.',
    },
faq: {
      eyebrow: 'الأسئلة الشائعة',
      title: 'إجابات، قبل أن تسأل.',
      q1: 'هل يمكنني حقاً استضافة كامل البنية التحتية ذاتياً؟',
      a1: 'نعم. مستودع البنية التحتية backend بأكمله مرخص بموجب MIT: Kong و GoTrue و PostgREST و Postgres و MailHog. أمر واحد: docker compose up وستعمل محلياً؛ كما تُنشر الصور ذاتها على أي VPS.',
      q2: 'أين تستقر بياناتي؟',
      a2: 'أينما تضعها. الخطة السحابية المستضافة تعمل في مناطق الاتحاد الأوروبي (باريس وفرانكفورت). والاستضافة الذاتية تعني أجهزتك، اختصاصك القضائي، واتفاقية DPA الخاصة بك — نحن لا نرى البيانات أبداً.',
      q3: 'كيف يعمل التسعير مع نمو مشروعي؟',
      a3: 'أنت تدفع لكل مشروع نشط، وليس لكل مستخدم. انتقل من Free إلى Team بنقرة واحدة. وإذا تجاوزت Team، استضف ذاتياً: نفس الكود وبدون أي ترحيل.',
      q4: 'كيف يمكنني الترحيل من BaaS آخر؟',
      a4: 'بفضل PostgREST مخطط بياناتك هو واجهة API نفسها. معظم فرق تستورد قاعدة بياناتها الحالية، وتوجه Kong إليها، وتطلق الإنتاج في أقل من يوم. لدينا إرشادات ترحيل من Supabase و Firebase و Hasura.',
      q5: 'ماذا عن تدقيق الأمان والامتثال؟',
      a5: 'مسارات المصادقة تأتي مدمجة مع Turnstile وحدود الاستخدام وسياسات CSP افتراضياً. يتضمن المستودع نموذج تهديد منشور، ودليل استجابة للخروقات، ومطابقة مع معيار OWASP ASVS L2 في /docs/gdpr/.',
    },
    canvasWindows: {
      eyebrow: 'تشريح مساحة العمل',
      title: 'لوحة واحدة، نوافذ متعددة.',
      lede: 'الملاحظات والمصادقة والمقاييس وصفوف Postgres وأحداث البريد الإلكتروني ومسارات العمل كلها في مكان واحد دون فقدان الربط بالبنية الخلفية.',
    },
    screenGallery: {
      title: 'لقطات من التطبيق أثناء التشغيل',
      lede: 'لقطات غير معدلة لـ osionos في مساحتي عمل تجريبيتين: CRM للمبيعات وكتالوج منتجات، معروضة بالطريقة التي يحتاجها فريقك.',
      crmDealsTitle: 'نظام CRM مبني على قاعدتي بيانات',
      crmDealsNote: 'صفقات مع معادلات للقيمة المرجحة ومستوى النجاح، ملونة بحسب المرحلة والاحتمالية.',
      crmPipelineTitle: 'مسار المبيعات كلوحة مهام',
      crmPipelineNote: 'عمود واحد لكل مرحلة، كل بطاقة تمثل صفقة بقيمتها ومسؤولها وتاريخ إغلاقها.',
      crmCalendarTitle: 'الخطوات التالية على التقويم',
      crmCalendarNote: 'الصفقات ذاتها مرتبة حسب تاريخ المتابعة وملونة بحسب المرحلة.',
      crmGalleryTitle: 'الصفقات الكبرى كبطاقات',
      crmGalleryNote: 'مرشح واحد يحول الجدول إلى معرض للصفقات التي تتجاوز 60,000.',
      crmForecastTitle: 'التوقعات والمناطق',
      crmForecastNote: 'صفقات تقترب من الإغلاق، واحتمالات الفوز والحسابات على الخريطة، مستخرجة من الصفوف نفسها.',
      dashboardTitle: 'لوحات معلومات أعلى صفوفك',
      dashboardNote: 'إجماليات ورسوم بيانية وتفاصيل، بجانب كل قاعدة بيانات تقرؤها مساحة العمل.',
      mapTitle: 'الصفوف على خريطة',
      mapNote: 'كل منتج مثبت في موقع مستودعه، ملون بحسب الفئة.',
      timelineTitle: 'المشاريع على خط زمني',
      timelineNote: 'تواريخ البدء والانتهاء مرسومة كأشرطة، وموسومة بحالتها.',
      splitTitle: 'عرضان جنباً إلى جنب',
      splitNote: 'قسّم المحرر لإبقاء اللوحة والأرقام في مرمى بصرك.',
      analyticsTitle: 'نفس البيانات، بأي مظهر',
      analyticsNote: 'عرض التحليلات بمظهر منتصف الليل، وهو أحد سمات الألوان التسع.',
      themesTitle: 'مهيأ حسب أسلوب عملك',
      themesNote: 'فاتح أو داكن، لون تمييز، كثافة، حواف وحجم النص.',
    },
    backendArchitecture: {
      eyebrow: 'داخل الاستوديو',
      title: 'شبكة واحدة لكل قاعدة بيانات وتطبيق وفريق.',
      lede: 'تدمج برزماتيكا قواعد بياناتك في شبكة واحدة. يبني كل فريق على الجزء المصرح له بالوصول إليه، ويتيح لك الجهاز اللوحي أدناه تشغيل الواجهة الخلفية بنفسك.',
    },
    studioNetwork: {
      legendOrg: 'المؤسسة',
      legendTeam: 'فريق المبيعات',
      legendPublic: 'المساحة العامة',
      assistantPrompt: 'أنشئ مساحة لفريق المبيعات: خريطة للمسار، ملاحظات مشتركة، وبوستغرس وريديس.',
      stepEnginesTitle: 'اربط كل محرك',
      stepEnginesBody: 'عشرة محركات، من بوستغرس ومونغو إلى ريديس ودينامو وأي واجهة HTTP، تنضم لشبكة واحدة. أنشئ واقرأ وحدّث واحذف عبر واجهة برمجية موحدة ومكتوبة الأنواع.',
      stepAppsTitle: 'ابنِ على نفس البيانات',
      stepAppsBody: 'تقرأ المخططات والعروض والخرائط والملاحظات السجلات الحية. يوضح تتبع النموذج اللغوي كيف يتحرك النموذج عبر بياناتك خطوة بخطوة.',
      stepSpacesTitle: 'حدد من يصل إلى ماذا',
      stepSpacesBody: 'المؤسسات وفرق العمل والمساحات العامة هي شبكات فرعية. تحدد rules المبنية على السمات المحركات والتطبيقات التي يمكن لكل منها الوصول إليها.',
      stepAssistantTitle: 'اطلب مساحة',
      stepAssistantBody: 'أخبر المساعد بما يحتاجه فريقك. سيقوم بترتيب المحركات والتطبيقات والقواعد، وتقوم أنت بضبط النتيجة.',
    },
    stackShowcase: {
      title: 'شغّل الحزمة التقنية بنفسك',
      lede: 'خادم grobase الحقيقي على جهاز لوحي: شغّل وأوقف أي خدمة، راقب الطلب، وانظر كيف ينمو.',
      tabServicesName: 'الخدمات',
      tabServicesProblem: 'يحتاج كل تطبيق جديد إلى خلفية خاصة به. إليك 55 خدمة متصلة وجاهزة.',
      tabScalingName: 'التوسع',
      tabScalingProblem: 'النمو يعني عادة إعادة بناء المنصة. هنا تتوسع نفس الحزمة بسلاسة.',
      tabWhyName: 'لماذا برزماتيكا',
      tabWhyProblem: 'العمل والبيانات مشتتة عبر الأدوات، والبديل الموحد لها.',
    },
    whySlide: {
      title: 'ما توفره عليك برزماتيكا',
      problem1: 'أدوات فريقك لا تتواصل مع بعضها البعض.',
      answer1: '6 تطبيقات تشترك في مساحة عمل واحدة: الصفحات وقواعد البيانات واللوحات والتقويم والبريد والسبورات.',
      problem2: 'بياناتك موزعة عبر قواعد بيانات متعددة.',
      answer2: 'شبكة واحدة تصل إلى 10 محركات، من بوستغرس إلى دينامو، عبر واجهة برمجية واحدة.',
      problem3: 'كل تطبيق جديد يعيد بناء تسجيل الدخول والصلاحيات وخطافات الويب.',
      answer3: '55 خدمة جاهزة ومترابطة: تسجيل الدخول، فحص الصلاحيات مع كل استعلام، خطافات ويب موقعة وتحديثات حية.',
      problem4: 'النمو يعني إعادة كتابة الكود.',
      answer4: 'تعمل الحاويات نفسها على حاسوبك وعلى كوبرنيتيس، من مستوى بيانات واحد إلى 10.',
      problem5: 'إثبات ملكيتك لبياناتك أمر معقد.',
      answer5: 'مفتوح المصدر بترخيص MIT ومستضاف ذاتياً، مع إمكانية التصدير والحذف وفق معايير GDPR.',
    },
    footer: {
      tagline: 'خلفية برمجية مفتوحة المصدر لفرق المنتجات.',
      newsletterLabel: 'احصل على ملاحظات الإصدارات',
      newsletterButton: 'اشتراك',
      newsletterConsent: 'أوافق على تلقي رسائل البريد الإلكتروني الخاصة بالإصدارات ويمكنني إلغاء الاشتراك من أي تذييل.',
      newsletterMeta: 'رسالة واحدة لكل إصدار. دون بكسلات تتبع.',
      groupProduct: 'المنتج',
      linkOverview: 'نظرة عامة',
      linkPricing: 'الأسعار',
      linkFaq: 'الأسئلة الشائعة',
      groupResources: 'المصادر',
      linkDocs: 'التوثيق',
      groupCompany: 'الشركة',
      linkGithub: 'GitHub',
      groupLegal: 'قانوني',
      linkPrivacy: 'سياسة الخصوصية',
      linkTerms: 'الشروط',
      linkCookies: 'ملفات تعريف الارتباط',
      linkDataRights: 'حقوق البيانات',
      copyright: '© {year} برزماتيكا · مفتوح المصدر بموجب ترخيص MIT',
      gdprContact: 'مسؤول حماية البيانات GDPR:',
    },
    pricing: {
      eyebrow: 'الأسعار',
      title: 'اختر خطتك. وبدّل في أي وقت.',
      lede: 'بدون حساب للمقاعد. بدون قيود مزودين. استضفها بنفسك متى شئت.',
      mostPopular: 'الأكثر طلباً',
      freeName: 'مجاني',
      freePrice: '€0',
      freeCadence: 'للأبد',
      freeSummary: 'للمطورين المستقلين والمشاريع الجانبية.',
      freeFeature1: 'مشروع واحد · 5 آلاف مستخدم نشط',
      freeFeature2: 'مصادقة، قواعد بيانات، تخزين',
      freeFeature3: 'دعم المجتمع',
      freeFeature4: 'إقامة البيانات في الاتحاد الأوروبي',
      freeCta: 'ابدأ مجاناً',
      teamName: 'فريق',
      teamPrice: '€39',
      teamCadence: 'لكل مشروع · شهرياً',
      teamSummary: 'للفرق التي لديها مستخدمون في الإنتاج.',
      teamFeature1: '10 مشاريع · 50 ألف مستخدم نشط',
      teamFeature2: 'تفاعل فوري، دوال طرفية (Edge)',
      teamFeature3: 'تسجيل دخول موحد (SSO) وسجلات تدقيق',
      teamFeature4: 'دعم عبر البريد، اتفاقية مستوى خدمة 24 ساعة',
      teamCta: 'ابدأ تجربة 14 يوماً',
      selfName: 'استضافة ذاتية',
      selfPrice: 'مجاني',
      selfCadence: 'للأبد · MIT',
      selfSummary: 'شغّل البنية بالكامل على خادم VPS الخاص بك.',
      selfFeature1: 'كل شيء غير محدود',
      selfFeature2: 'Docker Compose + Helm',
      selfFeature3: 'دليل إجراءات GDPR مدقق',
      selfFeature4: 'دعم مدفوع اختياري',
      selfCta: 'شاهد التوثيق',
    },
    appTour: {
      title: 'ستة تطبيقات تتواصل مع بعضها البعض بالفعل.',
      lede: 'كل منها عبارة عن قالب يمكنك إدراجه في أي صفحة. تقرأ البيانات نفسها، لذا فإن العميل المضاف في قاعدة البيانات يظهر في اللوحة والتقويم والبريد.',
      worksWith: 'يعمل مع',
      pocketTitle: 'مساحة عملك في جيبك.',
      pocketLede: 'نفس الصفحات واللوحات والبريد على هاتفك، متزامنة أثناء عملك. راجع مهام اليوم في طريقك، وأجب العميل من القطار.',
      appDocsName: 'صفحة',
      appDocsHint: 'ملاحظات وخطط وويكي',
      appDocsSummary: 'اكتب الخطط والملاحظات وويكي. اذكر عميلاً أو مهمة أو بريداً وسيظل مرتبطاً أينما انتقل.',
      appDatabaseName: 'قاعدة بيانات',
      appDatabaseHint: 'عملاء، طلبات، مخزون',
      appDatabaseSummary: 'احتفظ بالعملاء أو الطلبات أو المخزون في جداول. يفتح كل صف كصفحة، وكل عرض يقرأ نفس البيانات.',
      appBoardName: 'لوحة',
      appBoardHint: 'مراحل سير العمل',
      appBoardSummary: 'انقل العمل عبر المراحل. البطاقات هي صفوف من قاعدة بياناتك وليست نسخاً، فلا شيء يفقد تحديثه.',
      appCalendarName: 'تقويم',
      appCalendarHint: 'مواعيد ولقاءات',
      appCalendarSummary: 'شاهد المواعيد والاجتماعات في أسبوع واحد. التواريخ تأتي مباشرة من لوحاتك وبريدك.',
      appMailName: 'بريد',
      appMailHint: 'بريدك بجانب مهامك',
      appMailSummary: 'اقرأ البريد بجانب العمل المتعلق به. حوّل أي رسالة إلى مهمة في خطوة واحدة.',
      appWhiteboardName: 'سبورة',
      appWhiteboardHint: 'ارسم مسارات وأفكار',
      appWhiteboardSummary: 'ارسم التدفقات والأفكار معاً، ثم أدرج الرسم في أي صفحة.',
    },
  },
};

/**
 * Translates a localized string key for a given locale.
 * Performs case-insensitive locale normalization and falls back to default locale.
 * @param locale - The locale string (e.g. 'en', 'es', 'ar', 'pt-BR')
 * @param key - The dot-separated translation key (e.g. 'a11y.skipToContent')
 * @param params - Optional params for interpolation (e.g. { name: 'Alice' })
 * @returns The translated string value
 */
export function t(
  locale: string,
  key: string,
  params?: Record<string, string | number>
): string {
  const targetLocale = normalizeLocale(locale, {
    defaultLocale: DEFAULT_LOCALE,
    supportedLocales: SUPPORTED_LOCALES,
  });

  const keys = key.split('.');
  let value = DICTIONARY[targetLocale as SupportedLocale] as any;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      value = undefined;
      break;
    }
  }

  if (value === undefined || typeof value !== 'string') {
    value = DICTIONARY[DEFAULT_LOCALE];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }
  }

  if (value === undefined || typeof value !== 'string') {
    value = key;
  }

  if (params !== undefined) {
    return value.replace(/{([a-zA-Z0-9_]+)}/g, (_match: string, paramName: string) => {
      return String(params[paramName] ?? `{${paramName}}`);
    });
  }

  return value;
}