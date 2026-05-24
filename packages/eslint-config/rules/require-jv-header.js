/**
 * ESLint rule: require-jv-header
 *
 * Fails on any file under `packages/<pkg>/src/**\/*.tsx` that is missing the
 * shared JSDoc metadata block. Specifically required tags: @package, @peerDeps,
 * @demo. Sibling `*.demo.tsx` files are exempt because they are demos, not
 * library components.
 */
'use strict';

const REQUIRED_TAGS = ['@package', '@peerDeps', '@demo'];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require the shared JSDoc metadata block at the top of every @jv/* component file.',
    },
    schema: [],
    messages: {
      missingHeader:
        'Component is missing the @jv metadata header. Required tags: {{required}}. Missing: {{missing}}.',
    },
  },
  create(context) {
    const filename = context.getFilename();
    if (!/\/packages\/[^/]+\/src\//.test(filename)) return {};
    if (filename.endsWith('.demo.tsx') || filename.endsWith('.test.tsx')) return {};
    if (!filename.endsWith('.tsx')) return {};

    return {
      Program(node) {
        const source = context.getSourceCode();
        const leadingComments = source.getCommentsBefore(node.body[0] ?? node);
        const blockComments = (leadingComments || []).filter((c) => c.type === 'Block');
        const text = blockComments.map((c) => c.value).join('\n');
        const missing = REQUIRED_TAGS.filter((tag) => !text.includes(tag));
        if (missing.length > 0) {
          context.report({
            node,
            messageId: 'missingHeader',
            data: {
              required: REQUIRED_TAGS.join(', '),
              missing: missing.join(', '),
            },
          });
        }
      },
    };
  },
};
