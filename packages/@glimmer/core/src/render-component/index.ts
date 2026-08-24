import {
  clientBuilder,
  renderComponent as glimmerRenderComponent,
  runtimeContext,
  EnvironmentDelegate,
  renderSync,
  rehydrationBuilder,
  destroy,
  isDestroying,
  isDestroyed,
  inTransaction,
} from '@glimmer/runtime';
import {
  Cursor as GlimmerCursor,
  RenderResult,
  Dict,
  TemplateIterator,
  EnvironmentOptions,
  Environment,
  ElementBuilder,
} from '@glimmer/interfaces';
import { artifacts } from '@glimmer/program';
import { programCompilationContext } from '@glimmer/opcode-compiler';

import { DEBUG } from '@glimmer/env';
import { setTrackingTransactionEnv } from '@glimmer/validator';

import { ClientEnvDelegate, BaseEnvDelegate, setGlobalContext } from '../environment/delegates';
import { CompileTimeResolver, RuntimeResolver } from './resolvers';

import { SimpleElement, SimpleDocument } from '@simple-dom/interface';

if (DEBUG) {
  setTrackingTransactionEnv!({
    debugMessage(obj: unknown, keyName?: string): string {
      let objName: string;

      if (typeof obj === 'function') {
        objName = (obj as { name?: string }).name || '(anonymous function)';
      } else if (typeof obj === 'object' && obj !== null) {
        const constructor = (obj as { constructor?: { name?: string } }).constructor;
        const className = constructor?.name || '(unknown class)';

        // Try to get component-specific debug info
        const debugInfo = [];
        debugInfo.push(className);

        // Include the constructor's module if available
        if (constructor && constructor.toString) {
          const source = constructor.toString();
          const templateMatch = source.match(/static\s+template/);
          if (templateMatch) {
            debugInfo.push('(GlimmerX component)');
          }
        }

        objName = debugInfo.join(' ');
      } else if (obj === undefined) {
        objName = '(an unknown tag)';
      } else {
        objName = String(obj);
      }

      const dirtyString = keyName ? `\`${keyName}\` on \`${objName}\`` : `\`${objName}\``;

      return (
        `You attempted to update ${dirtyString}, but it had already been used ` +
        `previously in the same computation.\n\n` +
        `Attempting to update a value after using it in a computation can cause ` +
        `logical errors, infinite revalidation bugs, and performance issues, ` +
        `and is not supported.\n\n` +
        `TIP: Check the \`${keyName || '(unknown)'}\` property on your component ` +
        `class \`${objName}\`. This error typically occurs when a tracked property ` +
        `is read during rendering and then modified in the same render cycle ` +
        `(e.g., in a getter that has side effects, or a helper that mutates state).`
      );
    },
  });
}

export interface RenderComponentOptions {
  element: Element;
  args?: Dict<unknown>;
  owner?: object;
  rehydrate?: boolean;
}

type ResolveFn = () => void;
type RejectFn = (error: Error) => void;
let ACTIVE_ENV_DELEGATE: BaseEnvDelegate | null = null;

class RenderManager {
  private results: RenderResult[] = [];
  private scheduled = false;
  private isRevalidating = false;
  private needsAnotherPass = false;
  private renderNotifiers: Array<[ResolveFn, RejectFn]> = [];
  private envDelegate: BaseEnvDelegate;

  constructor(envDelegate: BaseEnvDelegate) {
    this.envDelegate = envDelegate;
  }

  registerResult(result: RenderResult): void {
    this.results.push(result);
  }

  unregisterResult(result: RenderResult): void {
    const index = this.results.indexOf(result);
    if (index !== -1) {
      this.results.splice(index, 1);
    }
  }

  scheduleRevalidate(): void {
    if (this.scheduled) {
      return;
    }

    this.scheduled = true;
    setTimeout(() => {
      this.scheduled = false;
      try {
        this.revalidate();
        this.renderNotifiers.forEach(([resolve]) => resolve());
      } catch (err) {
        this.renderNotifiers.forEach(([, reject]) => reject(err as Error));
      }

      this.renderNotifiers = [];
    }, 0);
  }

  private revalidate(): void {
    const MAX_PASSES = 10;
    let passes = 0;
    let hasDirtyResults = this.results.length > 0;

    while (hasDirtyResults && passes < MAX_PASSES) {
      passes++;
      this.needsAnotherPass = false;
      this.isRevalidating = true;

      runWithEnvDelegate(this.envDelegate, () => {
        for (const result of this.results) {
          const { env } = result;
          env.begin();
          result.rerender();
          env.commit();
        }
      });

      this.isRevalidating = false;
      hasDirtyResults = this.needsAnotherPass;
    }

    if (DEBUG && passes === MAX_PASSES && hasDirtyResults) {
      console.warn(
        'Infinite revalidation detected. Glimmer stopped revalidating after 10 passes. ' +
          'This usually happens when a tracked property is mutated during the rendering process.'
      );
    }
  }

  didRender(): Promise<void> {
    if (this.scheduled) {
      return new Promise((resolve, reject) => {
        this.renderNotifiers.push([resolve, reject]);
      });
    }
    return Promise.resolve();
  }

  requestRevalidate(): void {
    if (this.isRevalidating) {
      this.needsAnotherPass = true;
      return;
    }

    this.scheduleRevalidate();
  }
}

let MANAGER: RenderManager | null = null;
let ENV_DELEGATE: ClientEnvDelegate | null = null;

setGlobalContext(
  () => MANAGER?.requestRevalidate(),
  (d, dest) => {
    if (ACTIVE_ENV_DELEGATE) {
      ACTIVE_ENV_DELEGATE.scheduledDestructions.push(() => dest(d));
      return;
    }

    dest(d);
  },
  (fn) => {
    if (ACTIVE_ENV_DELEGATE) {
      ACTIVE_ENV_DELEGATE.scheduledFinishDestruction.push(fn);
      return;
    }

    fn();
  }
);

export function runWithEnvDelegate<T>(envDelegate: BaseEnvDelegate, callback: () => T): T {
  const previousEnvDelegate = ACTIVE_ENV_DELEGATE;
  ACTIVE_ENV_DELEGATE = envDelegate;

  try {
    return callback();
  } finally {
    ACTIVE_ENV_DELEGATE = previousEnvDelegate;
  }
}

function getManager(): RenderManager {
  if (!MANAGER) {
    ENV_DELEGATE = new ClientEnvDelegate();
    MANAGER = new RenderManager(ENV_DELEGATE);
  }

  return MANAGER;
}

export function didRender(): Promise<void> {
  return MANAGER ? MANAGER.didRender() : Promise.resolve();
}

export type ComponentDefinition = object;

async function renderComponent(
  ComponentClass: ComponentDefinition,
  options: RenderComponentOptions
): Promise<RenderResult>;
async function renderComponent(
  ComponentClass: ComponentDefinition,
  element: HTMLElement
): Promise<RenderResult>;
async function renderComponent(
  ComponentClass: ComponentDefinition,
  optionsOrElement: RenderComponentOptions | HTMLElement
): Promise<RenderResult> {
  const options: RenderComponentOptions =
    optionsOrElement instanceof HTMLElement ? { element: optionsOrElement } : optionsOrElement;

  const { element, args, owner } = options;
  const document = self.document as unknown as SimpleDocument;
  const manager = getManager();

  const { env, iterator } = getTemplateIterator(
    ComponentClass,
    element,
    { document },
    ENV_DELEGATE!,
    args,
    owner,
    options.rehydrate ? rehydrationBuilder : clientBuilder
  );
  const result = runWithEnvDelegate(ENV_DELEGATE!, () => renderSync(env, iterator));
  manager.registerResult(result);
  return result;
}

export default renderComponent;

/**
 * Destroy a render result previously returned by `renderComponent`: runs the component tree's
 * destructors (`willDestroy` etc.), clears the rendered DOM, and removes the result from the
 * revalidation list so it no longer re-renders.
 *
 * Runs under the active env delegate inside a transaction (`inTransaction` reuses one that is
 * already open — a destructor or a render-time callback may itself destroy another root), so
 * scheduled destructions drain through `onTransactionCommit` before this returns. Idempotent:
 * destroying an already-destroyed (or currently-destroying) result is a no-op, so per-test
 * destruction composes with a blanket destroy-all in an `afterEach`.
 *
 * Ported from the 1.0.3 release line (fp-1690-teardown-1.0.3), where the webapp's test harness
 * consumes it; see that branch for the regression tests covering nested and mid-drain destroys.
 */
export function destroyRenderResult(result: RenderResult): void {
  MANAGER?.unregisterResult(result);

  if (isDestroying(result) || isDestroyed(result)) {
    return;
  }

  const { env } = result;
  const run = (): void => inTransaction(env, () => destroy(result));
  if (ENV_DELEGATE) {
    runWithEnvDelegate(ENV_DELEGATE, run);
  } else {
    run();
  }
}

export function scheduleRevalidate(): void {
  MANAGER?.scheduleRevalidate();
}

const resolver = new RuntimeResolver();
const sharedArtifacts = artifacts();
const context = programCompilationContext(sharedArtifacts, new CompileTimeResolver());

export function getTemplateIterator(
  ComponentClass: ComponentDefinition,
  element: Element | SimpleElement,
  envOptions: EnvironmentOptions,
  envDelegate: EnvironmentDelegate,
  componentArgs: Dict<unknown> = {},
  owner: object = {},
  builderFactory: (env: Environment, cursor: GlimmerCursor) => ElementBuilder = clientBuilder
): { iterator: TemplateIterator; env: Environment } {
  const runtime = runtimeContext(envOptions, envDelegate, sharedArtifacts, resolver);
  const builder = builderFactory(runtime.env, {
    element,
    nextSibling: null,
  } as GlimmerCursor);

  return {
    iterator: glimmerRenderComponent(
      runtime,
      builder,
      context,
      owner,
      ComponentClass,
      componentArgs
    ),
    env: runtime.env,
  };
}
