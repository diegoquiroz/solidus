import type { createSolidusFacade, SolidusFacadeOptions } from "../facade/index.ts";
import type { SolidusModels } from "../sequelize/initialize-models.ts";
import type { RepositoryBundle } from "../sequelize/auto-wire.ts";

export type SolidusFacade = ReturnType<typeof createSolidusFacade>;

interface GlobalState {
  facade: SolidusFacade | null;
  isConfigured: boolean;
}

const globalState: GlobalState = {
  facade: null,
  isConfigured: false,
};

export class SolidusNotConfiguredError extends Error {
  constructor() {
    super(
      "Solidus has not been configured. Call Solidus.configure() before using the global facade or model mixins.",
    );
    this.name = "SolidusNotConfiguredError";
  }
}

export class SolidusAlreadyConfiguredError extends Error {
  constructor() {
    super(
      "Solidus has already been configured. configure() can only be called once.",
    );
    this.name = "SolidusAlreadyConfiguredError";
  }
}

export interface GlobalSolidusConfig extends SolidusFacadeOptions {
  createFacade: (options: SolidusFacadeOptions) => SolidusFacade;
  models?: SolidusModels;
  createRepositoryBundle?: (models: SolidusModels) => RepositoryBundle;
}

export function configure(config: GlobalSolidusConfig): void {
  if (globalState.isConfigured) {
    throw new SolidusAlreadyConfiguredError();
  }

  const { createFacade, models, createRepositoryBundle, ...facadeOptions } = config;
  
  // Auto-wire repositories if models are provided
  let resolvedFacadeOptions = facadeOptions;
  if (models !== undefined && createRepositoryBundle !== undefined) {
    const bundle = createRepositoryBundle(models);
    resolvedFacadeOptions = {
      ...facadeOptions,
      repositories: {
        ...facadeOptions.repositories,
        ...bundle.facade,
      },
      ownerCustomers: facadeOptions.ownerCustomers ?? bundle.core.customers,
      webhookRepositories: {
        ...facadeOptions.webhookRepositories,
      },
    };
  }
  
  globalState.facade = createFacade(resolvedFacadeOptions);
  globalState.isConfigured = true;
}

export function getGlobalFacade(): SolidusFacade {
  if (!globalState.isConfigured || globalState.facade === null) {
    throw new SolidusNotConfiguredError();
  }

  return globalState.facade;
}

export function isConfigured(): boolean {
  return globalState.isConfigured;
}

export function resetConfiguration(): void {
  globalState.facade = null;
  globalState.isConfigured = false;
}

export const Solidus = {
  configure,
  getFacade: getGlobalFacade,
  isConfigured,
  reset: resetConfiguration,
} as const;
