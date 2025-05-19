export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonSchemaType = {
  type:
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'array'
    | 'object'
    | 'null';
  description?: string;
  required?: boolean;
  default?: JsonValue;
  properties?: Record<string, JsonSchemaType>;
  items?: JsonSchemaType;
};

export type JsonObject = { [key: string]: JsonValue };

export type DataType =
  | 'string'
  | 'number'
  | 'bigint'
  | 'boolean'
  | 'symbol'
  | 'undefined'
  | 'object'
  | 'function'
  | 'array'
  | 'null';

export function getDataType(value: JsonValue): DataType {
  //1
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

export function tryParseJson(str: string): {
  //1
  success: boolean;
  data: JsonValue;
} {
  const trimmed = str.trim();
  if (
    !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
    !(trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return { success: false, data: str };
  }
  try {
    return { success: true, data: JSON.parse(str) };
  } catch {
    return { success: false, data: str };
  }
}
