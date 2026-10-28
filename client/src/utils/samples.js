export const languages = [
  { id: 'auto', label: 'Auto-detect', monaco: 'javascript' },
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript' },
  { id: 'java', label: 'Java', monaco: 'java' },
  { id: 'python', label: 'Python', monaco: 'python' },
  { id: 'c', label: 'C', monaco: 'c' },
  { id: 'cpp', label: 'C++', monaco: 'cpp' },
  { id: 'html', label: 'HTML', monaco: 'html' },
  { id: 'css', label: 'CSS', monaco: 'css' },
  { id: 'sql', label: 'SQL', monaco: 'sql' },
];
export const samples = {
  javascript: `async function loadUser(id) {\n  const response = fetch('/api/users/' + id);\n  return response.json();\n}\n\nloadUser(location.hash.slice(1)).then(renderUser);`,
  java: `import java.io.*;\n\nclass Profile {\n  String load(File file) throws Exception {\n    FileReader reader = new FileReader(file);\n    return reader.read().toString();\n  }\n}`,
  python: `def average(values=[]):\n    values.append(10)\n    return sum(values) / len(values)\n\nprint(average())\nprint(average())`,
  c: `#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char name[8];\n    gets(name);\n    printf("Hello %s", name);\n    return 0;\n}`,
  cpp: `#include <iostream>\n#include <cstring>\n\nint main() {\n    char* name = new char[8];\n    std::strcpy(name, "unbounded input");\n    std::cout << name;\n    return 0;\n}`,
  html: `<!doctype html>\n<html><body>\n  <div id="profile"></div>\n  <script>\n    profile.innerHTML = location.hash.slice(1);\n  </script>\n</body></html>`,
  css: `.card {\n  color: #777;\n  outline: none;\n}\n\n@media (max-width: 800px) {\n  .card { width: 900px; }\n}`,
  sql: `-- User input is concatenated into a query\nSELECT * FROM users WHERE name = '" + userInput + "';\n\nDELETE FROM sessions;`,
};
