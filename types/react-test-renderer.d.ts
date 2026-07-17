declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestInstance {
    type: string | unknown;
    props: Record<string, unknown> & {
      children?: unknown;
      className?: string;
      onPress?: () => void;
      accessibilityState?: { expanded?: boolean };
    };
    findAll: (predicate: (node: ReactTestInstance) => boolean) => ReactTestInstance[];
  }

  export interface ReactTestRenderer {
    root: ReactTestInstance;
    toJSON: () => unknown;
    unmount: () => void;
  }

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void): void;
}
