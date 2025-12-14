// Ensure JSX namespace is available for TypeScript in editors
// This file provides a minimal global declaration that maps JSX types
// to React's JSX types. It avoids changing the `JSX` name but ensures
// TypeScript sees it even when type resolution is flaky in some editors.

import * as React from "react";

declare global {
  // Re-export React's JSX namespace as the global JSX namespace
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    export type Element = React.JSX.Element;
    export type ElementClass = React.JSX.ElementClass;
    export type ElementAttributesProperty = React.JSX.ElementAttributesProperty;
    export type ElementChildrenAttribute = React.JSX.ElementChildrenAttribute;
    export type IntrinsicAttributes = React.JSX.IntrinsicAttributes;
    export type IntrinsicClassAttributes<T> =
      React.JSX.IntrinsicClassAttributes<T>;
    export type IntrinsicElements = React.JSX.IntrinsicElements;
  }
}

export {};
