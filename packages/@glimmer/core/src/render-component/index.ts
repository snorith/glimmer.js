import {
  clientBuilder,
  renderComponent as glimmerRenderComponent,
  runtimeContext,
  EnvironmentDelegate,
  renderSync,
  rehydrationBuilder,
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

import { ClientEnvDelegate, setGlobalContext } from '../environment/delegates';
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

class RenderManager {
  private results: RenderResult[] = [];
  private scheduled = false;
  private renderNotifiers: Array<[ResolveFn, RejectFn]> = [];

  constructor() {
    setGlobalContext(() => this.scheduleRevalidate());
  }

  registerResult(result: RenderResult): void {
    this.results.push(result);
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
    for (const result of this.results) {
      const { env } = result;
      env.begin();
      result.rerender();
      env.commit();
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
}

const MANAGER = new RenderManager();

export function didRender(): Promise<void> {
  return MANAGER.didRender();
}

export type ComponentDefinition = object;

async function renderComponent(
  ComponentClass: ComponentDefinition,
  options: RenderComponentOptions
): Promise<void>;
async function renderComponent(
  ComponentClass: ComponentDefinition,
  element: HTMLElement
): Promise<void>;
async function renderComponent(
  ComponentClass: ComponentDefinition,
  optionsOrElement: RenderComponentOptions | HTMLElement
): Promise<void> {
  const options: RenderComponentOptions =
    optionsOrElement instanceof HTMLElement ? { element: optionsOrElement } : optionsOrElement;

  const { element, args, owner } = options;
  const document = self.document as unknown as SimpleDocument;

  const { env, iterator } = getTemplateIterator(
    ComponentClass,
    element,
    { document },
    new ClientEnvDelegate(),
    args,
    owner,
    options.rehydrate ? rehydrationBuilder : clientBuilder
  );
  const result = renderSync(env, iterator);
  MANAGER.registerResult(result);
}

export default renderComponent;

export function scheduleRevalidate(): void {
  MANAGER.scheduleRevalidate();
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
