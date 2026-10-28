export const languageConfig = Object.freeze({
  javascript: { extensions: ['.js', '.jsx', '.mjs', '.cjs'], structuralNodes: ['function_declaration', 'method_definition', 'class_declaration'] },
  java: { extensions: ['.java'], structuralNodes: ['method_declaration', 'constructor_declaration', 'class_declaration'] },
  python: { extensions: ['.py'], structuralNodes: ['function_definition', 'class_definition'] },
  c: { extensions: ['.c', '.h'], structuralNodes: ['function_definition', 'struct_specifier'] },
  cpp: { extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'], structuralNodes: ['function_definition', 'class_specifier', 'struct_specifier'] },
  html: { extensions: ['.html', '.htm'], structuralNodes: ['element'] },
  css: { extensions: ['.css'], structuralNodes: ['rule_set'] },
  sql: { extensions: ['.sql'], structuralNodes: ['statement'] },
});
