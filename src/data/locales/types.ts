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
    readonly cookieSettings: string;
    readonly groupProduct: string;
    readonly linkOverview: string;
    readonly linkPricing: string;
    readonly linkFaq: string;
    readonly groupResources: string;
    readonly linkDocs: string;
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