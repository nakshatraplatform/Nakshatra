import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/** JSDOM cannot execute async Server Components; resolve only those nodes.
 * Client components still render through React (and retain their real hooks).
 * Streaming timing is exercised separately through the actual Next server.
 */
export async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (!isValidElement<{ children?: ReactNode }>(node)) return node;
  if (typeof node.type === "function" && node.type.constructor.name === "AsyncFunction") {
    const serverComponent = node.type as (props: unknown) => Promise<ReactElement>;
    return resolveServerTree(await serverComponent(node.props));
  }
  if (!node.props.children) return node;
  const children = await Promise.all(Children.toArray(node.props.children).map(resolveServerTree));
  return cloneElement(node, undefined, ...children);
}
