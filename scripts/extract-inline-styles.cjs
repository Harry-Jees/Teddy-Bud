const fs = require('node:fs');
const path = require('node:path');
const parser = require(require.resolve('@babel/parser', { paths: [path.join(__dirname, '../client')] }));
const traverse = require(require.resolve('@babel/traverse', { paths: [path.join(__dirname, '../client')] })).default;
const t = require(require.resolve('@babel/types', { paths: [path.join(__dirname, '../client')] }));

const filePath = path.join(__dirname, '../client/App.tsx');
let source = fs.readFileSync(filePath, 'utf8');
const ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const groups = new Map();
const edits = [];
let groupNumber = 0;

traverse(ast, {
  JSXAttribute(attributePath) {
    if (!t.isJSXIdentifier(attributePath.node.name, { name: 'style' })) return;
    const valuePath = attributePath.get('value');
    if (!valuePath.isJSXExpressionContainer()) return;
    const expressionPath = valuePath.get('expression');
    if (!expressionPath.isObjectExpression()) return;

    const functionPath = attributePath.getFunctionParent();
    if (!functionPath) {
      throw new Error('Found an inline JSX style outside a function; refusing an unsafe rewrite.');
    }

    const conciseArrow = functionPath.isArrowFunctionExpression()
      && !functionPath.get('body').isBlockStatement();
    let groupKey;
    let group;

    if (conciseArrow) {
      groupKey = 'arrow:' + functionPath.node.start;
      group = groups.get(groupKey);
      if (!group) {
        group = { kind: 'arrow', functionPath, items: [], id: groupNumber++ };
        groups.set(groupKey, group);
      }
    } else {
      const blockPath = attributePath.findParent(parent => parent.isBlockStatement());
      if (!blockPath || blockPath.node.start < functionPath.node.start || blockPath.node.end > functionPath.node.end) {
        throw new Error('Could not identify the lexical block for an inline style.');
      }
      groupKey = 'block:' + blockPath.node.start;
      group = groups.get(groupKey);
      if (!group) {
        group = { kind: 'block', blockPath, items: [], id: groupNumber++ };
        groups.set(groupKey, group);
      }
    }

    const property = 'style' + group.items.length;
    group.items.push({
      property,
      expression: source.slice(expressionPath.node.start, expressionPath.node.end),
      expressionPath,
    });
    edits.push({
      start: valuePath.node.start,
      end: valuePath.node.end,
      replacement: '{' + '__STYLE_REF_' + group.id + '_' + property + '__}',
    });
  },
});

function directStatementFor(bindingPath, blockPath) {
  let current = bindingPath;
  while (current.parentPath && current.parentPath.node !== blockPath.node) {
    current = current.parentPath;
  }
  return current.parentPath && current.parentPath.node === blockPath.node
    ? current
    : null;
}

function referencedBindings(items) {
  const bindings = [];
  for (const item of items) {
    item.expressionPath.traverse({
      ReferencedIdentifier(referencePath) {
        const binding = referencePath.scope.getBinding(referencePath.node.name);
        if (binding) bindings.push(binding);
      },
    });
  }
  return bindings;
}

function styleDeclaration(group, indent) {
  const variable = '__teddyBudExtractedStyles' + group.id;
  const properties = group.items.map(item =>
    indent + '  ' + item.property + ': (' + item.expression + ') as const,'
  );
  return {
    variable,
    code: 'const ' + variable + ' = StyleSheet.create({\n'
      + properties.join('\n') + '\n'
      + indent + '});\n' + indent,
  };
}

for (const group of groups.values()) {
  const declarationName = '__teddyBudExtractedStyles' + group.id;
  for (const edit of edits) {
    if (edit.replacement.startsWith('{__STYLE_REF_' + group.id + '_')) {
      const property = edit.replacement.match(/_(style\d+)__/)[1];
      edit.replacement = '{' + declarationName + '.' + property + '}';
    }
  }

  if (group.kind === 'arrow') {
    const body = group.functionPath.node.body;
    const lineStart = source.lastIndexOf('\n', group.functionPath.node.start - 1) + 1;
    const baseIndent = (source.slice(lineStart, group.functionPath.node.start).match(/^\s*/) || [''])[0];
    const indent = baseIndent + '  ';
    const declaration = styleDeclaration(group, indent);
    edits.push({
      start: body.start,
      end: body.start,
      replacement: '{\n' + indent + declaration.code.trimStart() + 'return ',
    });
    edits.push({
      start: body.end,
      end: body.end,
      replacement: ';\n' + baseIndent + '}',
    });
    continue;
  }

  const blockPath = group.blockPath;
  const statements = blockPath.get('body');
  let lastDependencyIndex = -1;
  for (const binding of referencedBindings(group.items)) {
    const node = binding.path.node;
    if (node.start < blockPath.node.start || node.end > blockPath.node.end) continue;
    const statementPath = directStatementFor(binding.path, blockPath);
    if (!statementPath) continue;
    const index = statements.findIndex(statement => statement.node === statementPath.node);
    if (index > lastDependencyIndex) lastDependencyIndex = index;
  }

  const nextStatement = statements[lastDependencyIndex + 1];
  if (!nextStatement) {
    throw new Error('Could not place extracted styles before their JSX use; refusing an unsafe rewrite.');
  }
  const insertionPoint = nextStatement.node.start;
  const lineStart = source.lastIndexOf('\n', insertionPoint - 1) + 1;
  const indent = (source.slice(lineStart, insertionPoint).match(/^\s*/) || [''])[0];
  const declaration = styleDeclaration(group, indent);
  edits.push({
    start: insertionPoint,
    end: insertionPoint,
    replacement: declaration.code,
  });
}

// Apply source edits from right to left so original Babel offsets remain valid.
edits.sort((left, right) => right.start - left.start || right.end - left.end);
for (const edit of edits) {
  source = source.slice(0, edit.start) + edit.replacement + source.slice(edit.end);
}

// Remove the one remaining no-void expression without changing its handled promise chain.
source = source.replace('void navigator.clipboard.writeText(message.text)', 'navigator.clipboard.writeText(message.text)');

parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
fs.writeFileSync(filePath, source);
console.log('Extracted ' + edits.filter(edit => edit.replacement.includes('__teddyBudExtractedStyles')).length + ' JSX style references into StyleSheet.create blocks.');
