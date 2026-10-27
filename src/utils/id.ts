import { customAlphabet, nanoid } from "nanoid";

export const generateCustomId = (size: number = 5): string => {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const nanoid = customAlphabet(alphabet, size);
  return nanoid();
};

export const generateId = (size: number = 21): string => {
  return nanoid(size);
};

export const generatePrefixId = (prefix: string, size: number = 5): string => {
  return `${prefix}-${nanoid(size)}`;
};
