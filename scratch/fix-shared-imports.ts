import * as fs from "fs";
import * as path from "path";

const SHARED_SRC = path.resolve("packages/shared/src");

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

async function fixImports() {
  const files = getAllFiles(SHARED_SRC);

  for (const file of files) {
    const absoluteFilePath = path.resolve(file);
    const content = fs.readFileSync(absoluteFilePath, "utf8");

    const newContent = content
      .replace(
        /(from|import|require)\s*\(['"]@\/(.*?)['"]\)/g,
        (match, type, importPath) => {
          const fileDir = path.dirname(absoluteFilePath);
          const targetPath = path.resolve(SHARED_SRC, importPath);
          let relativePath = path.relative(fileDir, targetPath);

          if (!relativePath.startsWith(".")) {
            relativePath = "./" + relativePath;
          }

          return `${type}('${relativePath}')`;
        },
      )
      .replace(/from\s+['"]@\/(.*?)['"]/g, (match, importPath) => {
        const fileDir = path.dirname(absoluteFilePath);
        const targetPath = path.resolve(SHARED_SRC, importPath);
        let relativePath = path.relative(fileDir, targetPath);

        if (!relativePath.startsWith(".")) {
          relativePath = "./" + relativePath;
        }

        return `from '${relativePath}'`;
      });

    if (content !== newContent) {
      console.log(`Fixing imports in ${file}`);
      fs.writeFileSync(absoluteFilePath, newContent);
    }
  }
}

fixImports().catch(console.error);
