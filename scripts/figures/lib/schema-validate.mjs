import Ajv2020 from "ajv/dist/2020.js";
import { readJson } from "./io.mjs";

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});

export const loadSchema = async (schemaPath) => readJson(schemaPath);

export const validateJsonAgainstSchema = async ({
  data,
  schemaPath,
  label = "document",
}) => {
  const schema = await loadSchema(schemaPath);
  const schemaKey =
    (typeof schema?.$id === "string" && schema.$id.trim()) || schemaPath;
  const existing = ajv.getSchema(schemaKey);
  const validate = existing ?? ajv.compile(schema);
  const ok = validate(data);

  if (ok) {
    return { ok: true, message: `${label} passed schema validation.` };
  }

  const details = (validate.errors ?? [])
    .map((error) => {
      const path = error.instancePath || "(root)";
      return `${path} ${error.message}`;
    })
    .join("\n- ");

  return {
    ok: false,
    message: `${label} failed schema validation:\n- ${details}`,
  };
};
