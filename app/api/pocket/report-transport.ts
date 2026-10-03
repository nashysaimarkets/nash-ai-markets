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

const numberText = /^-?(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,17})?(?:[eE][+-]?[0-9]{1,3})?$/;

export function createReportTransport(source: Schema, options: { boundedNumbers?: boolean; aliasKeys?: boolean } = {}) {
  const name = (key: string, index: number) => options.aliasKeys === false ? key : `f${index.toString(36)}`;
  function compile(node: Schema): Schema {
    if (options.boundedNumbers && (node.type === 'number' || node.type === 'integer')) {
      return { type: 'string', pattern: numberText.source, maxLength: 40, description: `${node.description ?? ''} Exact numeric value as bounded JSON-number text; use scientific notation for very small or large values.`, ...(Array.isArray(node.enum) ? { enum: node.enum.map(String) } : {}) };
    }
    if (node.properties) {
      const entries = Object.entries(node.properties);
      const names = new Map(entries.map(([key], index) => [key, name(key, index)]));
      return {
        ...node,
        properties: Object.fromEntries(entries.map(([key, child]) => {
          const compiled = compile(child);
          return [names.get(key)!, { ...compiled, description: `${key}${compiled.description ? `: ${compiled.description}` : ""}` }];
        })),
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
      const fields = Object.entries(node.properties).map(([key, child], index) => ({ key, child, alias: name(key, index) }));
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
    if (options.boundedNumbers && (node.type === 'number' || node.type === 'integer')) {
      if (decoding) {
        if (typeof value !== 'string' || value.length > 40 || !numberText.test(value)) throw new Error('Invalid bounded report number');
        const decoded = Number(value);
        if (decoded === 0 && /[1-9]/.test(value.split(/[eE]/)[0])) throw new Error('Report number underflow');
        value = decoded;
      }
    }
    const actualType = typeof value;
    if (type.includes("integer") ? !Number.isInteger(value) : !type.includes(actualType)) throw new Error("Invalid report value type");
    if (actualType === "number" && (!Number.isFinite(value) || (typeof node.minimum === "number" && (value as number) < node.minimum) || (typeof node.maximum === "number" && (value as number) > node.maximum))) throw new Error("Invalid report number");
    if (typeof value === "string" && typeof node.maxLength === "number" && value.length > node.maxLength) throw new Error("Report text exceeds its limit");
    if (Array.isArray(node.enum) && !node.enum.includes(value)) throw new Error("Invalid report choice");
    return options.boundedNumbers && !decoding && (node.type === 'number' || node.type === 'integer') ? String(value) : value;
  }

  return {
    schema: compile(source),
    encode: (value: unknown) => convert(value, source, false),
    decode: (value: unknown) => convert(value, source, true),
  };
}

export const reportTransportInstruction = "WIRE FORMAT: the output schema uses short keys. Every field description gives its original semantic name referenced in these instructions. Return all required short-key fields; preserve each distinct finding, source role and uncertainty. Do not omit, merge, approximate or replace any finding to save text.";
