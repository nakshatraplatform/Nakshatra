// Adapted from @next/eslint-plugin-next 16.3.4's
// no-location-assign-relative-destination rule. MIT; see NEXT-LICENSE.txt.
// Oxlint 1.88 does not yet implement this rule. Keep it until native parity exists.
import { findVariable, getStringIfConstant } from "@eslint-community/eslint-utils";

const absoluteUrl = /^(?:[a-z][\d+.a-z-]*:|\/\/)/i;
const globalPrefixes = new Set(["window", "globalThis", "document", "self"]);
const member = (node, name) => node.type === "MemberExpression" && (node.computed
  ? node.property.type === "Literal" && node.property.value === name
  : node.property.type === "Identifier" && node.property.name === name);

function locationRoot(node) {
  if (node.type === "Identifier" && node.name === "location") return node;
  if (member(node, "location") && node.object.type === "Identifier" && globalPrefixes.has(node.object.name)) return node.object;
  return null;
}

function stringPrefix(node, source, seen = new Set()) {
  if (seen.has(node)) return null;
  seen.add(node);
  const constant = getStringIfConstant(node, source.getScope(node));
  if (constant !== null) return constant;
  if (node.type === "TemplateLiteral" && node.quasis.length) return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  if (node.type === "BinaryExpression" && node.operator === "+") return stringPrefix(node.left, source, seen);
  if (node.type !== "Identifier") return null;
  const variable = findVariable(source.getScope(node), node);
  const definition = variable?.defs.at(-1);
  if (definition?.type !== "Variable") return null;
  let lastWrite = definition.node.init;
  for (const reference of variable.references) {
    if (reference.identifier.range[0] >= node.range[0]) break;
    if (reference.isWrite() && reference.writeExpr && reference.writeExpr !== definition.node.init) lastWrite = reference.writeExpr;
  }
  return lastWrite ? stringPrefix(lastWrite, source, seen) : null;
}

const relativeNavigation = {
  meta: {
    type: "problem",
    docs: { description: "Preserve Next.js internal navigation checks without its glob dependency." },
    schema: [],
    messages: { relative: "Use Next.js redirect() or router.push() for internal navigation instead of {{expression}}." },
  },
  create(context) {
    const source = context.sourceCode;
    if (!source.scopeManager) return {};
    function check(node, target, value, expression) {
      const root = locationRoot(target);
      if (!root) return;
      const variable = source.scopeManager.scopes[0].set.get(root.name);
      if (!variable || variable.defs.length || !variable.references.some(reference => reference.identifier === root)) return;
      const prefix = stringPrefix(value, source);
      if (prefix !== null && !absoluteUrl.test(prefix)) {
        context.report({ node, messageId: "relative", data: { expression } });
      }
    }
    return {
      CallExpression(node) {
        if (!member(node.callee, "assign") || !node.arguments.length || node.arguments[0].type === "SpreadElement") return;
        check(node, node.callee.object, node.arguments[0], `${source.getText(node.callee)}()`);
      },
      AssignmentExpression(node) {
        if (member(node.left, "href")) check(node, node.left.object, node.right, source.getText(node.left));
      },
    };
  },
};
export default relativeNavigation;
