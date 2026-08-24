import setGlobalContextVM from '@glimmer/global-context';
import { EnvironmentDelegate } from '@glimmer/runtime';
import { Option, Destructor } from '@glimmer/interfaces';
import { IteratorDelegate } from '@glimmer/reference';

import { isNativeIterable, NativeIterator } from './iterator';
import { DEBUG } from '@glimmer/env';
import toBool from './to-bool';

export function setGlobalContext(
  scheduleRevalidate: () => void,
  scheduleDestroy: <T extends object>(destroyable: T, destructor: Destructor<T>) => void,
  scheduleDestroyed: (fn: () => void) => void
): void {
  setGlobalContextVM({
    getProp(obj: Record<string, unknown>, key: string) {
      return obj[key];
    },

    setProp(obj: Record<string, unknown>, key: string, newValue: unknown) {
      obj[key] = newValue;
    },

    getPath(obj: Record<string, unknown>, key: string) {
      if (DEBUG && key.includes('.')) {
        throw new Error(
          'You attempted to get a path with a `.` in it, but Glimmer.js does not support paths with dots.'
        );
      }

      return obj[key];
    },

    setPath(obj: Record<string, unknown>, key: string, newValue: unknown) {
      if (DEBUG && key.includes('.')) {
        throw new Error(
          'You attempted to set a path with a `.` in it, but Glimmer.js does not support paths with dots.'
        );
      }

      obj[key] = newValue;
    },

    scheduleRevalidate,

    toBool,

    toIterator(value: unknown): Option<IteratorDelegate> {
      if (isNativeIterable(value)) {
        return NativeIterator.from(value);
      }

      return null;
    },

    scheduleDestroy,

    scheduleDestroyed,

    warnIfStyleNotTrusted() {
      // Do nothing
    },

    assert(test: unknown, msg: string) {
      if (!test) {
        throw new Error(msg);
      }
    },

    deprecate(msg: string, test: unknown) {
      if (!test) {
        console.warn(msg);
      }
    },
  });
}

/**
 * The environment delegate base class shared by both the client and SSR
 * environments. Contains shared definitions, but requires user to specify
 * `isInteractive` and a method for getting the protocols of URLs.
 *
 * @internal
 */
export abstract class BaseEnvDelegate implements EnvironmentDelegate {
  abstract isInteractive: boolean;
  abstract protocolForURL(url: string): string;

  enableDebugTooling = false;
  owner = {};

  scheduledDestructions: (() => void)[] = [];
  scheduledFinishDestruction: (() => void)[] = [];

  onTransactionCommit(): void {
    // Drain to QUIESCENCE, snapshotting each batch (ported from the 1.0.3 release line). Two
    // hazards, both measured there: a destructor can destroy another root, whose commit
    // re-enters this hook — iterating the live arrays re-ran the outer destructors; and a
    // destructor can schedule further destruction into the just-cleared arrays, which a single
    // snapshot would strand forever.
    while (this.scheduledDestructions.length > 0 || this.scheduledFinishDestruction.length > 0) {
      const destructions = this.scheduledDestructions;
      const finishers = this.scheduledFinishDestruction;
      this.scheduledDestructions = [];
      this.scheduledFinishDestruction = [];

      for (const destroy of destructions) {
        destroy();
      }

      finishers.forEach((fn) => fn());
    }
  }
}

/**
 * The client specific environment delegate.
 *
 * @internal
 */
export class ClientEnvDelegate extends BaseEnvDelegate {
  isInteractive = true;

  private uselessAnchor = self.document.createElement('a');

  protocolForURL = (url: string): string => {
    // TODO - investigate alternative approaches
    // e.g. see `installPlatformSpecificProtocolForURL` in Ember
    this.uselessAnchor.href = url;
    return this.uselessAnchor.protocol;
  };
}
