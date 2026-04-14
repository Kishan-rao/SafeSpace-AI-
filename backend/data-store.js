const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile(filename, defaultValue) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);

  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeJsonFile(filename, defaultValue);
      return structuredClone(defaultValue);
    }
    throw error;
  }
}

async function writeJsonFile(filename, value) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

module.exports = {
  readJsonFile,
  writeJsonFile,
};
