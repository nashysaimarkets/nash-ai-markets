/** Lossless wire format experiment. Only object keys change: findings, source
 * roles, numeric values, field constraints and every required field survive. */
type Schema = {
  type?: string | readonly string[];
  properties?: Record<string, Schema>;
  required?: readonly string[];
  items?: Schema;
  description?: string;
  additionalProperties?: boolean;
  [key: string]: unknown;
};

export function createReportTransport(source: Schema) {
  function compile(node: Schema): Schema {
    if (node.properties) {
      const entries = Object.entries(node.properties);
      const names = new Map(entries.map(([key], index) => [key, `f${index.toString(36)}`]));
      return {
        ...node,
        properties: Object.fromEntries(entries.map(([key, child]) => [names.get(key)!, {
          ...compile(child), description: `${key}${child.description ? `: ${child.description}` : ""}`,
        }])),
        required: node.required?.map((key) => names.get(key)!),
      };
    }
    return node.items ? { ...node, items: compile(node.items) } : { ...node };
  }

  function convert(value: unknown, node: Schema, decoding: boolean): unknown {
    const type = Array.isArray(node.type) ? node.type : [node.type];
    if (value === null && type.includes("null")) return null;
    if (node.properties) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Report object missing");
      const record = value as Record<string, unknown>;
      const fields = Object.entries(node.properties).map(([key, child], index) => ({ key, child, alias: `f${index.toString(36)}` }));
      const allowed = new Set(fields.map((field) => decoding ? field.alias : field.key));
      if (Object.keys(record).some((key) => !allowed.has(key))) throw new Error("Unexpected report field");
      return Object.fromEntries(fields.flatMap(({ key, child, alias }) => {
        const input = decoding ? alias : key;
        if (!Object.hasOwn(record, input)) {
          if (node.required?.includes(key)) throw new Error(`Required report field missing: ${key}`);
          return [];
        }
        return [[decoding ? key : alias, convert(record[input], child, decoding)]];
      }));
    }
    if (node.items) {
      if (!Array.isArray(value)) throw new Error("Report array missing");
      if (typeof node.maxItems === "number" && value.length > node.maxItems) throw new Error("Report array too long");
      if (typeof node.minItems === "number" && value.length < node.minItems) throw new Error("Report array too short");
      return value.map((item) => convert(item, node.items!, decoding));
    }
    const actualType = typeof value;
    if (type.includes("integer") ? !Number.isInteger(value) : !type.includes(actualType)) throw new Error("Invalid report value type");
    if (actualType === "number" && (!Number.isFinite(value) || (typeof node.minimum === "number" && (value as number) < node.minimum) || (typeof node.maximum === "number" && (value as number) > node.maximum))) throw new Error("Invalid report number");
    if (typeof value === "string" && typeof node.maxLength === "number" && value.length > node.maxLength) throw new Error("Report text exceeds its limit");
    if (Array.isArray(node.enum) && !node.enum.includes(value)) throw new Error("Invalid report choice");
    return value;
  }

  return {
    schema: compile(source),
    encode: (value: unknown) => convert(value, source, false),
    decode: (value: unknown) => convert(value, source, true),
  };
}

export const reportTransportInstruction = "WIRE FORMAT: the output schema uses short keys. Every field description gives its original semantic name referenced in these instructions. Return all required short-key fields; preserve each distinct finding, source role and uncertainty. Do not omit, merge, approximate or replace any finding to save text.";
